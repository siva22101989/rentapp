'use client';

import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, PlusCircle } from 'lucide-react';
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
import { useFirestore } from '@/firebase';
import type { DryingRecord, HamaliCharge } from '@/lib/definitions';
import { doc, updateDoc } from 'firebase/firestore';
import { format } from 'date-fns';
import { toDate, cleanForFirestore, formatCurrency } from '@/lib/utils';
import { Separator } from '../ui/separator';

const AddChargeSchema = z.object({
  description: z.string().min(3, 'Description must be at least 3 characters.'),
  date: z.string().refine(val => !isNaN(Date.parse(val)), { message: "Invalid date" }),
  customerRate: z.coerce.number().nonnegative('Rate must be non-negative.'),
  workerRate: z.coerce.number().nonnegative('Rate must be non-negative.'),
});

type ChargeFormData = z.infer<typeof AddChargeSchema>;

export function AddDryingChargeDialog({ record, children }: { record: DryingRecord; children: React.ReactNode }) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const firestore = useFirestore();
  const isBilled = record.status === 'Billed';

  const form = useForm<ChargeFormData>({
    resolver: zodResolver(AddChargeSchema),
    defaultValues: {
      description: '',
      date: format(new Date(), 'yyyy-MM-dd'),
      customerRate: undefined,
      workerRate: undefined,
    },
  });

  const watchedCustomerRate = form.watch('customerRate');
  const watchedWorkerRate = form.watch('workerRate');
  const bagsForDrying = record.bagsForDrying;
  const newCustomerAmount = (watchedCustomerRate || 0) * bagsForDrying;
  const newWorkerAmount = (watchedWorkerRate || 0) * bagsForDrying;

  const onSubmit = (data: ChargeFormData) => {
    if (!firestore) {
      toast({ title: 'Error', description: 'Firestore not available.', variant: 'destructive' });
      return;
    }
    
    if (isBilled) {
      toast({ title: 'Error', description: 'Cannot add charges to a billed record.', variant: 'destructive' });
      return;
    }
    
    startTransition(async () => {
      try {
        const recordRef = doc(firestore, 'dryingRecords', record.id);
        
        const newCharge: HamaliCharge = {
          description: data.description,
          date: new Date(data.date),
          amount: newCustomerAmount,
          workerAmount: newWorkerAmount,
        };

        const newHamaliCharges = [...(record.hamaliCharges || []), newCharge];
        const newTotalDryingHamali = newHamaliCharges.reduce((acc, charge) => acc + charge.amount, 0);
        const newTotalWorkerHamali = newHamaliCharges.reduce((acc, charge) => acc + (charge.workerAmount || 0), 0);

        await updateDoc(recordRef, {
          hamaliCharges: cleanForFirestore(newHamaliCharges),
          totalDryingHamali: newTotalDryingHamali,
          totalWorkerHamali: newTotalWorkerHamali,
        });

        toast({ title: 'Success', description: 'New charge added successfully.' });
        setIsOpen(false);
        form.reset();
      } catch (error) {
        console.error(error);
        toast({ title: 'Error', description: 'Failed to add charge.', variant: 'destructive' });
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
              <DialogTitle>Add Extra Charge</DialogTitle>
              <DialogDescription>
                Add a new hamali charge for this drying process. The amount will be calculated per bag.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4">
                <p className="text-sm font-medium">
                    Applying charges for <span className="font-bold text-primary">{bagsForDrying}</span> bags.
                </p>
                <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Charge Description</FormLabel>
                            <FormControl>
                                <Input placeholder="e.g., Packing Charge, Drying Day 2" {...field} disabled={isBilled} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                 <FormField
                    control={form.control}
                    name="date"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Charge Date</FormLabel>
                            <FormControl>
                                <Input type="date" {...field} disabled={isBilled} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <div className="grid grid-cols-2 gap-4">
                    <FormField
                        control={form.control}
                        name="customerRate"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Customer Rate/Bag</FormLabel>
                            <FormControl>
                                <Input type="number" step="0.01" placeholder="0.00" {...field} value={field.value ?? ''} disabled={isBilled} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="workerRate"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Worker Rate/Bag</FormLabel>
                            <FormControl>
                                <Input type="number" step="0.01" placeholder="0.00" {...field} value={field.value ?? ''} disabled={isBilled} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                </div>
                 <Separator />
                 <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Total Customer Charge:</span>
                        <span className="font-medium">{formatCurrency(newCustomerAmount)}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Total Worker Payable:</span>
                        <span className="font-medium">{formatCurrency(newWorkerAmount)}</span>
                    </div>
                </div>
            </div>
            <DialogFooter>
              <DialogClose asChild><Button variant="outline" type="button">Cancel</Button></DialogClose>
              {!isBilled && (
                <Button type="submit" disabled={isPending}>
                  {isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                  ) : (
                      <>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Add Charge
                      </>
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
