
'use client';

import { useState, useTransition, useEffect } from 'react';
import { useForm, useFieldArray, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Plus, Trash2, Equal } from 'lucide-react';
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
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase';
import type { DryingRecord, HamaliCharge, UnloadingRecord } from '@/lib/definitions';
import { doc, updateDoc } from 'firebase/firestore';
import { format } from 'date-fns';
import { formatCurrency, toDate, cleanForFirestore } from '@/lib/utils';
import { Separator } from '../ui/separator';

const HamaliChargeFormSchema = z.object({
  description: z.string().min(1, 'Description is required.'),
  amount: z.coerce.number().nonnegative(),
  workerAmount: z.coerce.number().nonnegative().optional(),
  date: z.string().refine(val => !isNaN(Date.parse(val)), { message: "Invalid date" }),
  // Add per-bag rates for the form
  amountPerBag: z.coerce.number().nonnegative('Rate must be non-negative.').optional(),
  workerAmountPerBag: z.coerce.number().nonnegative('Rate must be non-negative.').optional(),
});

const ManageHamaliSchema = z.object({
  charges: z.array(HamaliChargeFormSchema),
});

type ManageHamaliFormData = z.infer<typeof ManageHamaliSchema>;

export function ManageHamaliDialog({ record, unloadingRecord, children }: { record: DryingRecord; unloadingRecord?: UnloadingRecord; children: React.ReactNode }) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const firestore = useFirestore();
  const isBilled = record.status === 'Billed';

  const form = useForm<ManageHamaliFormData>({
    resolver: zodResolver(ManageHamaliSchema),
    defaultValues: {
      charges: (record.hamaliCharges || []).map(charge => ({
        ...charge,
        amount: charge.amount || 0,
        workerAmount: charge.workerAmount || 0,
        date: format(toDate(charge.date), 'yyyy-MM-dd'),
        amountPerBag: record.bagsForDrying > 0 ? ((charge.amount || 0) / record.bagsForDrying) : 0,
        workerAmountPerBag: record.bagsForDrying > 0 ? ((charge.workerAmount || 0) / record.bagsForDrying) : 0,
      })),
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'charges',
  });
  
  const watchedCharges = useWatch({
    control: form.control,
    name: 'charges'
  });

  const totalCustomerHamali = watchedCharges.reduce((acc, charge) => acc + (Number(charge?.amount) || 0), 0);
  const totalWorkerHamali = watchedCharges.reduce((acc, charge) => acc + (Number(charge?.workerAmount) || 0), 0);


  const onSubmit = (data: ManageHamaliFormData) => {
    if (!firestore) {
      toast({ title: 'Error', description: 'Firestore not available.', variant: 'destructive' });
      return;
    }

    startTransition(async () => {
      try {
        // We only need to store the final amounts, not the per-bag rates.
        const hamaliCharges: Partial<HamaliCharge>[] = data.charges.map(charge => ({
          description: charge.description,
          date: new Date(charge.date),
          amount: charge.amount,
          workerAmount: charge.workerAmount,
        }));
        
        const totalDryingHamali = hamaliCharges.reduce((acc, charge) => acc + (charge.amount || 0), 0);
        const totalWorkerHamali = hamaliCharges.reduce((acc, charge) => acc + (charge.workerAmount || 0), 0);

        const recordRef = doc(firestore, 'dryingRecords', record.id);
        await updateDoc(recordRef, cleanForFirestore({
          hamaliCharges,
          totalDryingHamali,
          totalWorkerHamali,
        }));

        toast({ title: 'Success', description: 'Hamali charges updated successfully.' });
        setIsOpen(false);
      } catch (error) {
        console.error(error);
        toast({ title: 'Error', description: 'Failed to update hamali charges.', variant: 'destructive' });
      }
    });
  };

  const addNewCharge = () => {
    // Count how many "Drying Day" charges already exist to suggest the next number.
    const dryingDayChargesCount = watchedCharges.filter(c =>
      c.description?.toLowerCase().startsWith('drying day')
    ).length;
    
    const nextDayNumber = dryingDayChargesCount + 1;

    append({
      description: `Drying Day ${nextDayNumber}`,
      amount: 0,
      workerAmount: 0,
      date: format(new Date(), 'yyyy-MM-dd'),
      amountPerBag: 0,
      workerAmountPerBag: 0,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-3xl">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <DialogHeader>
              <DialogTitle>Manage Hamali Charges</DialogTitle>
              <DialogDescription>
                Edit, add, or delete hamali charges for this drying process. Enter a rate per bag to automatically calculate totals.
              </DialogDescription>
            </DialogHeader>
            <div className="max-h-[60vh] overflow-y-auto p-1">
                <div className="space-y-4 py-4">
                {fields.map((field, index) => {
                    const isUnloadingCharge = field.description.toLowerCase().includes('unloading');
                    const customerTotal = watchedCharges[index]?.amount || 0;
                    const workerTotal = watchedCharges[index]?.workerAmount || 0;
                    
                    return (
                    <div key={field.id} className="p-3 rounded-md border space-y-4">
                        <div className="flex justify-between items-start gap-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-grow">
                                <FormField
                                    control={form.control}
                                    name={`charges.${index}.description`}
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-xs">Description</FormLabel>
                                            <FormControl>
                                                <Input placeholder="Description" {...field} readOnly={isUnloadingCharge || isBilled} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name={`charges.${index}.date`}
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-xs">Date</FormLabel>
                                            <FormControl>
                                                <Input type="date" {...field} readOnly={isUnloadingCharge || isBilled} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                            {!isUnloadingCharge && !isBilled && (
                                <div className="pt-5">
                                    <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)}>
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                </div>
                            )}
                        </div>

                        <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                             <FormField
                                control={form.control}
                                name={`charges.${index}.amountPerBag`}
                                render={({ field }) => (
                                  <FormItem>
                                      <FormLabel className="text-xs">Customer Rate/Bag</FormLabel>
                                      <FormControl>
                                          <Input 
                                              type="number" 
                                              step="0.01" 
                                              placeholder="0.00" 
                                              {...field}
                                              onChange={e => {
                                                  const rate = parseFloat(e.target.value) || 0;
                                                  field.onChange(rate);
                                                  form.setValue(`charges.${index}.amount`, rate * (record.bagsForDrying || 0));
                                              }}
                                              readOnly={isUnloadingCharge || isBilled}
                                          />
                                      </FormControl>
                                      <div className="text-xs text-muted-foreground pt-1">Total: <span className="font-mono font-medium text-foreground">{formatCurrency(customerTotal)}</span></div>
                                      <FormMessage />
                                  </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name={`charges.${index}.workerAmountPerBag`}
                                render={({ field }) => (
                                  <FormItem>
                                      <FormLabel className="text-xs">Worker Rate/Bag</FormLabel>
                                      <FormControl>
                                          <Input 
                                              type="number" 
                                              step="0.01" 
                                              placeholder="0.00" 
                                              {...field}
                                              onChange={e => {
                                                  const rate = parseFloat(e.target.value) || 0;
                                                  field.onChange(rate);
                                                  form.setValue(`charges.${index}.workerAmount`, rate * (record.bagsForDrying || 0));
                                              }}
                                              readOnly={isUnloadingCharge || isBilled}
                                          />
                                      </FormControl>
                                       <div className="text-xs text-muted-foreground pt-1">Total: <span className="font-mono font-medium text-foreground">{formatCurrency(workerTotal)}</span></div>
                                      <FormMessage />
                                  </FormItem>
                                )}
                            />
                        </div>
                    </div>
                )})}
                {!isBilled && (
                    <Button type="button" variant="outline" size="sm" onClick={addNewCharge} className="mt-4">
                        <Plus className="mr-2 h-4 w-4" /> Add New Charge
                    </Button>
                )}
                <Separator className="my-4" />
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1 rounded-md border p-3">
                        <div className="text-sm text-muted-foreground">Total Customer Hamali</div>
                        <div className="font-bold text-lg font-mono">{formatCurrency(totalCustomerHamali)}</div>
                    </div>
                     <div className="space-y-1 rounded-md border p-3">
                        <div className="text-sm text-muted-foreground">Total Worker Hamali</div>
                        <div className="font-bold text-lg font-mono">{formatCurrency(totalWorkerHamali)}</div>
                    </div>
                </div>
                </div>
            </div>
            <DialogFooter>
              <DialogClose asChild><Button variant="outline" type="button" size="sm">Cancel</Button></DialogClose>
              {!isBilled && (
                <Button type="submit" disabled={isPending} size="sm">
                  {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Changes
                </Button>
              )}
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
