
'use client';

import { useState, useTransition, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Save } from 'lucide-react';
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
import type { DryingRecord, UnloadingRecord, HamaliChargeItem } from '@/lib/definitions';
import { format, differenceInDays } from 'date-fns';
import { toDate, cleanForFirestore, formatCurrency } from '@/lib/utils';
import { useFirestore } from '@/firebase/provider';
import { updateDryingRecord } from '@/lib/data';
import { Separator } from '../ui/separator';

const EditDryingSchema = z.object({
  dryingStartDate: z.string().refine(val => !isNaN(Date.parse(val))),
  packingDate: z.string().optional(),
  bagsForDrying: z.coerce.number().int().nonnegative(),
  bagsPacked: z.coerce.number().int().nonnegative().optional(),
  customerHamaliPerBag: z.coerce.number().nonnegative().optional(),
  workerHamaliPerBag: z.coerce.number().nonnegative().optional(),
  pavHamaliPerBag: z.coerce.number().nonnegative().optional(),
  cuppaHamaliPerBag: z.coerce.number().nonnegative().optional(),
}).refine(data => {
    if (data.packingDate) {
        return new Date(data.packingDate) >= new Date(data.dryingStartDate)
    }
    return true;
}, {
    message: "Packing Date must be on or after Drying Start Date.",
    path: ["packingDate"],
}).refine(data => {
    if(data.bagsPacked !== undefined) {
        return data.bagsPacked <= data.bagsForDrying;
    }
    return true;
}, {
    message: "Bags packed cannot be more than bags for drying.",
    path: ["bagsPacked"],
});

type EditDryingFormData = z.infer<typeof EditDryingSchema>;

export function EditDryingDialog({ record, unloadingRecord, children }: { record: DryingRecord; unloadingRecord?: UnloadingRecord; children: React.ReactNode }) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const firestore = useFirestore();
  const isBilled = record.status === 'Billed';

  const form = useForm<EditDryingFormData>({
    resolver: zodResolver(EditDryingSchema),
    defaultValues: {},
  });

  useEffect(() => {
    if (isOpen) {
      const getRate = (desc: string) => record.hamaliDetails?.find(d => d.description.toLowerCase().includes(desc))?.rate;
      
      form.reset({
        dryingStartDate: format(toDate(record.dryingStartDate), 'yyyy-MM-dd'),
        packingDate: record.packingDate ? format(toDate(record.packingDate), 'yyyy-MM-dd') : '',
        bagsForDrying: record.bagsForDrying,
        bagsPacked: record.bagsPacked ?? undefined,
        customerHamaliPerBag: getRate('customer'),
        pavHamaliPerBag: getRate('pav'),
        cuppaHamaliPerBag: getRate('cuppa'),
        workerHamaliPerBag: 0, // Cannot derive worker rate easily, user must re-enter if they want to change worker payable.
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, record]);
  
  const formValues = form.watch();

  const calculatedHamali = useMemo(() => {
    if (!unloadingRecord) return null;

    const { dryingStartDate, packingDate, bagsForDrying, customerHamaliPerBag, workerHamaliPerBag, pavHamaliPerBag, cuppaHamaliPerBag } = formValues;

    const unloadingHamaliDetail = record.hamaliDetails?.find(d => d.description === 'Unloading Hamali');
    const proportionalUnloadingHamali = unloadingHamaliDetail?.amount || 0;

    const day1CustomerHamali = (Number(bagsForDrying) || 0) * (Number(customerHamaliPerBag) || 0);

    let extraDryingDays = 0;
    if (dryingStartDate && packingDate) {
        const start = new Date(dryingStartDate);
        const end = new Date(packingDate);
        if (end >= start) {
            const days = differenceInDays(end, start);
            extraDryingDays = days > 0 ? days : 0;
        }
    }
    
    const pavHamali = (Number(bagsForDrying) || 0) * (Number(pavHamaliPerBag) || 0) * extraDryingDays;
    const cuppaHamali = (Number(bagsForDrying) || 0) * (Number(cuppaHamaliPerBag) || 0) * extraDryingDays;
    const totalCustomerCharge = proportionalUnloadingHamali + day1CustomerHamali + pavHamali + cuppaHamali;
    
    const day1WorkerHamali = (Number(bagsForDrying) || 0) * (Number(workerHamaliPerBag) || 0);
    const totalWorkerPayable = proportionalUnloadingHamali + day1WorkerHamali + pavHamali + cuppaHamali;

    return {
        proportionalUnloadingHamali,
        day1CustomerHamali,
        pavHamali,
        cuppaHamali,
        totalCustomerCharge,
        extraDryingDays,
        totalWorkerPayable: workerHamaliPerBag !== undefined ? totalWorkerPayable : undefined,
    }

  }, [formValues, record.hamaliDetails, unloadingRecord]);

  const onSubmit = (data: EditDryingFormData) => {
    if (!firestore || isBilled) {
      toast({ title: 'Error', description: 'Cannot update a billed record.', variant: 'destructive' });
      return;
    }
    
    startTransition(async () => {
      try {
        if (!unloadingRecord || !calculatedHamali) {
          toast({ title: 'Error', description: 'Source unloading record not found.', variant: 'destructive' });
          return;
        }

        const hamaliDetails: HamaliChargeItem[] = [];
        const unloadingHamaliDetail = record.hamaliDetails?.find(d => d.description === 'Unloading Hamali');
        if(unloadingHamaliDetail) hamaliDetails.push(unloadingHamaliDetail);
        if(calculatedHamali.day1CustomerHamali > 0) hamaliDetails.push({ description: 'Customer Hamali', bags: data.bagsForDrying || 0, rate: data.customerHamaliPerBag || 0, amount: calculatedHamali.day1CustomerHamali });
        if(calculatedHamali.pavHamali > 0) hamaliDetails.push({ description: `Pav Hamali (${calculatedHamali.extraDryingDays} extra day${calculatedHamali.extraDryingDays !== 1 ? 's' : ''})`, bags: data.bagsForDrying || 0, rate: data.pavHamaliPerBag || 0, amount: calculatedHamali.pavHamali });
        if(calculatedHamali.cuppaHamali > 0) hamaliDetails.push({ description: `Cuppa Hamali (${calculatedHamali.extraDryingDays} extra day${calculatedHamali.extraDryingDays !== 1 ? 's' : ''})`, bags: data.bagsForDrying || 0, rate: data.cuppaHamaliPerBag || 0, amount: calculatedHamali.cuppaHamali });
        
        const updateData: Partial<DryingRecord> = {
          dryingStartDate: new Date(data.dryingStartDate),
          packingDate: data.packingDate ? new Date(data.packingDate) : null,
          bagsForDrying: data.bagsForDrying,
          bagsPacked: data.bagsPacked,
          status: data.packingDate ? 'Packing' : 'Drying',
          hamaliDetails,
          totalDryingHamali: calculatedHamali.totalCustomerCharge,
        };
        
        if (calculatedHamali.totalWorkerPayable !== undefined) {
            updateData.workerHamaliPayable = calculatedHamali.totalWorkerPayable;
        }
        
        await updateDryingRecord(firestore, record.id, record.bagsForDrying, updateData);

        toast({ title: 'Success', description: 'Drying record has been updated.' });
        setIsOpen(false);
      } catch (error) {
        console.error(error);
        toast({ title: 'Error', description: error instanceof Error ? error.message : 'Failed to update record.', variant: 'destructive' });
      }
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <DialogHeader>
              <DialogTitle>Edit Drying Record</DialogTitle>
              <DialogDescription>
                Update the details for this drying process.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4 max-h-[70vh] overflow-y-auto pr-4">
                <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="dryingStartDate" render={({ field }) => (
                        <FormItem><FormLabel>Drying Start Date</FormLabel><FormControl><Input type="date" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                    )}/>
                    <FormField control={form.control} name="packingDate" render={({ field }) => (
                        <FormItem><FormLabel>Packing Date (Optional)</FormLabel><FormControl><Input type="date" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                    )}/>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="bagsForDrying" render={({ field }) => (
                        <FormItem><FormLabel>Bags Plotted for Drying</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                    )}/>
                    <FormField control={form.control} name="bagsPacked" render={({ field }) => (
                        <FormItem><FormLabel>Bags Packed (Optional)</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                    )}/>
                </div>
                <p className="text-xs text-muted-foreground">
                    Bags available on source unloading bill: {unloadingRecord ? (unloadingRecord.bagsUnloaded - (unloadingRecord.bagsSentToDrying || 0) + record.bagsForDrying) : 'N/A'}
                </p>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <FormField control={form.control} name="customerHamaliPerBag" render={({ field }) => (
                        <FormItem><FormLabel>Cust. Hamali/Bag</FormLabel><FormControl><Input type="number" step="0.01" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                    )}/>
                    <FormField control={form.control} name="workerHamaliPerBag" render={({ field }) => (
                        <FormItem><FormLabel>Worker Hamali/Bag</FormLabel><FormControl><Input type="number" step="0.01" {...field} value={field.value ?? ''} placeholder="Re-enter to update" /></FormControl><FormMessage /></FormItem>
                    )}/>
                    <FormField control={form.control} name="pavHamaliPerBag" render={({ field }) => (
                        <FormItem><FormLabel>Pav Hamali/Bag/Day</FormLabel><FormControl><Input type="number" step="0.01" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                    )}/>
                    <FormField control={form.control} name="cuppaHamaliPerBag" render={({ field }) => (
                        <FormItem><FormLabel>Cuppa Hamali/Bag/Day</FormLabel><FormControl><Input type="number" step="0.01" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                    )}/>
                </div>
                
                {calculatedHamali && (
                    <div className="space-y-2 p-3 border rounded-md text-sm">
                        <h5 className="font-medium">Live Summary</h5>
                        <div className="flex justify-between"><span className="text-muted-foreground">Unloading Hamali:</span> <span className="font-mono">{formatCurrency(calculatedHamali.proportionalUnloadingHamali)}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Day 1 Hamali:</span> <span className="font-mono">{formatCurrency(calculatedHamali.day1CustomerHamali)}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Pav Hamali ({calculatedHamali.extraDryingDays} extra day{calculatedHamali.extraDryingDays !== 1 ? 's' : ''}):</span> <span className="font-mono">{formatCurrency(calculatedHamali.pavHamali)}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Cuppa Hamali ({calculatedHamali.extraDryingDays} extra day{calculatedHamali.extraDryingDays !== 1 ? 's' : ''}):</span> <span className="font-mono">{formatCurrency(calculatedHamali.cuppaHamali)}</span></div>
                        <Separator/>
                        <div className="flex justify-between font-semibold"><span >Total Hamali for Customer:</span> <span className="font-mono">{formatCurrency(calculatedHamali.totalCustomerCharge)}</span></div>
                         {calculatedHamali.totalWorkerPayable !== undefined && <div className="flex justify-between font-semibold"><span >Total Payable to Worker:</span> <span className="font-mono">{formatCurrency(calculatedHamali.totalWorkerPayable)}</span></div>}
                    </div>
                )}
            </div>
            <DialogFooter>
              <DialogClose asChild><Button variant="outline" type="button">Cancel</Button></DialogClose>
              {!isBilled && (
                <Button type="submit" disabled={isPending}>
                  {isPending ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>
                  ) : (
                    <><Save className="mr-2 h-4 w-4" /> Save Changes</>
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
