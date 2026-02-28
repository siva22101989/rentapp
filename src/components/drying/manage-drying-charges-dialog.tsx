'use client';

import { useState, useTransition, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Save, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import type { DryingRecord, HamaliCharge } from '@/lib/definitions';
import { doc, updateDoc } from 'firebase/firestore';
import { format, differenceInDays } from 'date-fns';
import { toDate, cleanForFirestore } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { useFirestore } from '@/firebase';

const PackingSchema = z.object({
  bagsPacked: z.coerce.number().nonnegative('Bags packed must be a non-negative number.').optional(),
  packingDate: z.string().refine(val => !isNaN(Date.parse(val)), { message: "Invalid date" }),
  additionalHamaliPerBagPerDay: z.coerce.number().nonnegative('Rate must be non-negative.').optional(),
});

type PackingFormData = z.infer<typeof PackingSchema>;

export function ManageDryingChargesDialog({ record, children }: { record: DryingRecord; children: React.ReactNode }) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const firestore = useFirestore();
  const isBilled = record.status === 'Billed';

  const form = useForm<PackingFormData>({
    resolver: zodResolver(PackingSchema),
    defaultValues: {
        bagsPacked: undefined,
        packingDate: format(new Date(), 'yyyy-MM-dd'),
        additionalHamaliPerBagPerDay: undefined,
    }
  });

  const bagsPacked = form.watch('bagsPacked');
  const packingDate = form.watch('packingDate');
  
  const bagsDifference = useMemo(() => {
    const packed = Number(bagsPacked);
    if (!isNaN(packed) && bagsPacked !== undefined) {
      return record.bagsForDrying - packed;
    }
    return null;
  }, [bagsPacked, record.bagsForDrying]);

  const dryingDaysInfo = useMemo(() => {
    if (packingDate && record.dryingStartDate) {
        const start = toDate(record.dryingStartDate);
        const end = new Date(packingDate);
        const totalDays = differenceInDays(end, start) + 1;
        const extraDays = totalDays > 1 ? totalDays - 1 : 0;
        return { total: totalDays > 0 ? totalDays : 0, extra: extraDays };
    }
    return { total: 0, extra: 0 };
  }, [packingDate, record.dryingStartDate]);

  useEffect(() => {
    if (isOpen) {
      let savedRate = '';
      const pkDate = record.packingDate ? format(toDate(record.packingDate), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd');
      const additionalHamaliCharge = (record.hamaliCharges || []).find(c => c.description.toLowerCase().includes('additional drying'));

      if (additionalHamaliCharge) {
        const start = toDate(record.dryingStartDate);
        const end = toDate(record.packingDate || pkDate);
        const totalDays = differenceInDays(end, start) + 1;
        const extraDays = totalDays > 1 ? totalDays - 1 : 0;
        
        if (record.bagsForDrying > 0 && extraDays > 0) {
            const rate = additionalHamaliCharge.amount / record.bagsForDrying / extraDays;
            savedRate = rate.toFixed(2);
        }
      }
      
      form.reset({
        bagsPacked: record.bagsPacked ?? '',
        packingDate: pkDate,
        additionalHamaliPerBagPerDay: savedRate ? Number(savedRate) : '',
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, record]);
  

  const onSubmit = (data: PackingFormData) => {
    if (!firestore || isBilled) {
      toast({ title: 'Error', description: 'Cannot update a billed record.', variant: 'destructive' });
      return;
    }
    
    startTransition(async () => {
      try {
        const finalPackingDate = new Date(data.packingDate);
        const packedBagsValue = data.bagsPacked ?? record.bagsPacked ?? 0;
        const additionalHamaliRateValue = data.additionalHamaliPerBagPerDay ?? 0;
        
        // --- Customer Charges Calculation ---
        const initialCustomerCharges = (record.hamaliCharges || []).filter(
            c => !c.description.toLowerCase().includes('additional drying')
        );

        const newCustomerCharges: HamaliCharge[] = [...initialCustomerCharges];
        const newAdditionalHamaliAmount = additionalHamaliRateValue * record.bagsForDrying * dryingDaysInfo.extra;
        
        if (newAdditionalHamaliAmount > 0) {
            newCustomerCharges.push({
                description: `Additional Drying Hamali (${dryingDaysInfo.extra} extra days)`,
                amount: newAdditionalHamaliAmount,
                date: finalPackingDate,
            });
        }
        
        const newTotalDryingHamali = newCustomerCharges.reduce((acc, charge) => acc + (charge.amount || 0), 0);
        
        // --- Worker Payable Calculation ---
        const previousAdditionalHamali = (record.hamaliCharges || []).find(c => c.description.toLowerCase().includes('additional drying'))?.amount || 0;
        const baseWorkerHamali = (record.totalDryingWorkerHamali || record.totalDryingHamali) - previousAdditionalHamali;
        const newTotalDryingWorkerHamali = baseWorkerHamali + newAdditionalHamaliAmount;

        // --- Update Firestore ---
        const recordRef = doc(firestore, 'dryingRecords', record.id);
        await updateDoc(recordRef, cleanForFirestore({
          bagsPacked: packedBagsValue,
          packingDate: finalPackingDate,
          status: 'Packing',
          hamaliCharges: newCustomerCharges,
          totalDryingHamali: newTotalDryingHamali,
          totalDryingWorkerHamali: newTotalDryingWorkerHamali,
        }));

        toast({ title: 'Success', description: 'Packing & charge information updated.' });
        setIsOpen(false);
      } catch (error) {
        console.error(error);
        toast({ title: 'Error', description: 'Failed to update record.', variant: 'destructive' });
      }
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <DialogHeader>
              <DialogTitle>Update Packing & Charges</DialogTitle>
              <DialogDescription>
                Enter final packed bags and any additional charges for this lot.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4">
              <Alert variant="default" className="bg-secondary/50">
                <Info className="h-4 w-4" />
                <AlertTitle>Bags Sent for Drying</AlertTitle>
                <AlertDescription>
                  <span className="font-bold text-xl">{record.bagsForDrying}</span> bags
                </AlertDescription>
              </Alert>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                    control={form.control}
                    name="bagsPacked"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Bags Packed</FormLabel>
                            <FormControl>
                                <Input
                                type="number"
                                placeholder="0"
                                disabled={isBilled}
                                {...field}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="packingDate"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Packing Date</FormLabel>
                            <FormControl>
                                <Input 
                                    type="date" 
                                    disabled={isBilled}
                                    {...field}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
              </div>
              
              <div className="text-sm text-center text-muted-foreground">
                Total Drying Days: <span className="font-bold text-foreground">{dryingDaysInfo.total}</span> | Extra Days (after Day 1): <span className="font-bold text-foreground">{dryingDaysInfo.extra}</span>
              </div>
              
              {bagsDifference !== null && bagsDifference !== 0 && (
                <p className="text-sm text-center font-medium text-destructive">
                  Note: There is a difference of {Math.abs(bagsDifference)} bag{Math.abs(bagsDifference) > 1 ? 's' : ''} ({bagsDifference > 0 ? 'less' : 'more'}) after packing.
                </p>
              )}

              <FormField
                  control={form.control}
                  name="additionalHamaliPerBagPerDay"
                  render={({ field }) => (
                      <FormItem>
                          <FormLabel>Additional Hamali (per bag, per extra day)</FormLabel>
                          <FormControl>
                              <Input 
                                  type="number" 
                                  step="0.01" 
                                  placeholder="0.00" 
                                  disabled={isBilled} 
                                  {...field}
                              />
                          </FormControl>
                          <FormMessage />
                      </FormItem>
                  )}
              />
            </div>
            <DialogFooter>
              <DialogClose asChild><Button variant="outline" type="button">Cancel</Button></DialogClose>
              {!isBilled && (
                <Button type="submit" disabled={isPending}>
                  {isPending ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>
                  ) : (
                    <><Save className="mr-2 h-4 w-4" /> Save and Update</>
                  )}
                </Button>
              )}
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
