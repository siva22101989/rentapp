'use client';

import { useState, useTransition, useEffect } from 'react';
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
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import type { DryingRecord, HamaliCharge } from '@/lib/definitions';
import { doc, updateDoc } from 'firebase/firestore';
import { format } from 'date-fns';
import { toDate, cleanForFirestore, formatCurrency } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { useFirestore } from '@/firebase';

const UpdateSchema = z.object({
  bagsPacked: z.coerce.number().nonnegative('Number of bags must be a non-negative number.').nullable(),
  packingDate: z.string().refine((val) => !isNaN(Date.parse(val)), { message: 'Packing date is required.' }),
  additionalHamaliPerBag: z.coerce.number().nonnegative().optional().nullable(),
});

type UpdateFormData = z.infer<typeof UpdateSchema>;

export function ManageDryingChargesDialog({ record, children }: { record: DryingRecord; children: React.ReactNode }) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const firestore = useFirestore();
  const isBilled = record.status === 'Billed';

  // New local state to directly control the inputs
  const [bagsPackedLocal, setBagsPackedLocal] = useState<string | number>('');
  const [additionalHamaliLocal, setAdditionalHamaliLocal] = useState<string | number>('');


  const form = useForm<UpdateFormData>({
    resolver: zodResolver(UpdateSchema),
    defaultValues: {
      bagsPacked: null,
      packingDate: format(new Date(), 'yyyy-MM-dd'),
      additionalHamaliPerBag: null,
    },
  });

  useEffect(() => {
    if (isOpen) {
      const additionalHamali = (record.hamaliCharges || []).find(c => c.description.toLowerCase().includes('additional drying'));
      const additionalHamaliPerBag = additionalHamali && record.bagsForDrying > 0 ? additionalHamali.amount / record.bagsForDrying : null;

      // Set local state for inputs
      setBagsPackedLocal(record.bagsPacked ?? '');
      setAdditionalHamaliLocal(additionalHamaliPerBag ?? '');
      
      // Reset react-hook-form state
      form.reset({
        bagsPacked: record.bagsPacked ?? null,
        packingDate: record.packingDate ? format(toDate(record.packingDate), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
        additionalHamaliPerBag: additionalHamaliPerBag ?? null,
      });
    }
  }, [isOpen, record, form]);

  const onSubmit = (data: UpdateFormData) => {
    if (!firestore || isBilled) {
      toast({ title: 'Error', description: 'Cannot update a billed record.', variant: 'destructive' });
      return;
    }

    startTransition(async () => {
      try {
        const packingDate = new Date(data.packingDate);
        const bagsPacked = data.bagsPacked ?? 0;

        const initialCustomerCharges = (record.hamaliCharges || []).filter(
            c => c.description.toLowerCase().includes('unloading') || c.description.toLowerCase().includes('drying day 1')
        );

        const newCustomerCharges: HamaliCharge[] = [...initialCustomerCharges];
        
        let additionalHamaliAmount = 0;
        const additionalHamaliRate = data.additionalHamaliPerBag ?? 0;
        
        if (additionalHamaliRate > 0) {
            additionalHamaliAmount = additionalHamaliRate * record.bagsForDrying;
            newCustomerCharges.push({
                description: 'Additional Drying Hamali',
                amount: additionalHamaliAmount,
                date: packingDate,
            });
        }
        
        const totalDryingHamali = newCustomerCharges.reduce((acc, charge) => acc + (charge.amount || 0), 0);
        
        const initialUnloadingHamaliPortion = (record.hamaliCharges || []).find(c => c.description.toLowerCase().includes('unloading'))?.amount || 0;
        
        const initialDay1CustomerHamali = (record.hamaliCharges || []).find(c => c.description.toLowerCase().includes('drying day 1'))?.amount || 0;
        const initialWorkerHamali = (record.totalDryingWorkerHamali || 0) > initialUnloadingHamaliPortion 
            ? (record.totalDryingWorkerHamali || 0) - initialUnloadingHamaliPortion
            : initialDay1CustomerHamali;
        
        const totalDryingWorkerHamali = initialUnloadingHamaliPortion + initialWorkerHamali + additionalHamaliAmount;

        const recordRef = doc(firestore, 'dryingRecords', record.id);
        await updateDoc(recordRef, cleanForFirestore({
          bagsPacked,
          packingDate,
          status: 'Packing',
          hamaliCharges: newCustomerCharges,
          totalDryingHamali,
          totalDryingWorkerHamali,
        }));

        toast({ title: 'Success', description: 'Packing & charge information updated.' });
        setIsOpen(false);
      } catch (error) {
        console.error(error);
        toast({ title: 'Error', description: 'Failed to update record.', variant: 'destructive' });
      }
    });
  };

  const bagsDifference = bagsPackedLocal !== '' ? record.bagsForDrying - Number(bagsPackedLocal) : null;

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
                          value={bagsPackedLocal}
                          onChange={(e) => {
                            const val = e.target.value;
                            setBagsPackedLocal(val);
                            field.onChange(val === '' ? null : Number(val));
                          }}
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
                        <Input type="date" disabled={isBilled} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              {bagsDifference !== null && bagsDifference !== 0 && (
                <p className="text-sm text-center font-medium text-destructive">
                  Note: There is a difference of {Math.abs(bagsDifference)} bag{Math.abs(bagsDifference) > 1 ? 's' : ''} ({bagsDifference > 0 ? 'less' : 'more'}) after packing.
                </p>
              )}

              <FormField
                control={form.control}
                name="additionalHamaliPerBag"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Additional Hamali (per bag)</FormLabel>
                    <FormDescription className="text-xs">For extra drying days.</FormDescription>
                    <FormControl>
                      <Input 
                        type="number" 
                        step="0.01" 
                        placeholder="0.00" 
                        disabled={isBilled} 
                        value={additionalHamaliLocal}
                        onChange={(e) => {
                            const val = e.target.value;
                            setAdditionalHamaliLocal(val);
                            field.onChange(val === '' ? null : Number(val));
                        }}
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
