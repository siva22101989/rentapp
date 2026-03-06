'use client';

import { useState, useTransition } from 'react';
import { Loader2 } from 'lucide-react';
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
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import type { Payment, StorageRecord } from '@/lib/definitions';
import { formatCurrency, cleanForFirestore, toDate } from '@/lib/utils';
import { useFirestore } from '@/firebase/provider';
import { doc, updateDoc, arrayUnion, writeBatch } from 'firebase/firestore';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../ui/form';
import { Separator } from '../ui/separator';

const PaymentSchema = z.object({
  paymentDate: z.string().refine(val => !isNaN(Date.parse(val)), { message: "Invalid date" }),
  paymentAmount: z.coerce.number().positive('Payment amount must be a positive number.'),
});

type PaymentFormData = z.infer<typeof PaymentSchema>;

type AddPaymentDialogProps = {
    record: StorageRecord & {
        balanceDue: number;
        hamaliPending: number;
        rentPending: number;
    };
    allRecords: StorageRecord[];
};

export function AddPaymentDialog({ record, allRecords }: AddPaymentDialogProps) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const firestore = useFirestore();

  const form = useForm<PaymentFormData>({
    resolver: zodResolver(PaymentSchema),
    defaultValues: {
        paymentDate: new Date().toISOString().split('T')[0],
        paymentAmount: undefined,
    },
  });

  const onSubmit = (data: PaymentFormData) => {
    if (!firestore) {
      toast({ title: 'Error', description: 'Firestore not available.', variant: 'destructive' });
      return;
    }

    startTransition(async () => {
      try {
        const batch = writeBatch(firestore);
        let amountToApply = data.paymentAmount;
        const paymentDate = new Date(data.paymentDate);

        // 1. Handle current record first
        const recordRef = doc(firestore, 'storageRecords', record.id);
        const hamaliToPayOnCurrent = Math.min(amountToApply, record.hamaliPending);
        const newPaymentsCurrent: Payment[] = [];

        if (hamaliToPayOnCurrent > 0) {
          newPaymentsCurrent.push({ amount: hamaliToPayOnCurrent, date: paymentDate, type: 'hamali' });
          amountToApply -= hamaliToPayOnCurrent;
        }

        if (amountToApply > 0) {
            const rentToPayOnCurrent = Math.min(amountToApply, record.rentPending);
            if (rentToPayOnCurrent > 0) {
              newPaymentsCurrent.push({ amount: rentToPayOnCurrent, date: paymentDate, type: 'rent' });
              amountToApply -= rentToPayOnCurrent;
            }
        }

        if (newPaymentsCurrent.length > 0) {
          batch.update(recordRef, {
            payments: arrayUnion(...newPaymentsCurrent.map(p => cleanForFirestore(p)))
          });
        }

        // 2. Handle overpayment by applying to other records, sorted oldest first
        if (amountToApply > 0.005) { // Use tolerance for float issues
          const otherRecordsWithDues = allRecords
            .filter(r => r.customerId === record.customerId && r.id !== record.id)
            .map(rec => {
              const hamaliPayable = rec.hamaliPayable || 0;
              const totalRentBilled = rec.totalRentBilled || 0;
              const hamaliPaid = (rec.payments || []).filter(p => p.type === 'hamali').reduce((acc, p) => acc + p.amount, 0);
              const rentPaid = (rec.payments || []).filter(p => p.type === 'rent').reduce((acc, p) => acc + p.amount, 0);
              const otherPaid = (rec.payments || []).filter(p => !p.type || p.type === 'other').reduce((acc, p) => acc + p.amount, 0);
              const hamaliDue = Math.max(0, hamaliPayable - hamaliPaid);
              const rentDue = Math.max(0, totalRentBilled - rentPaid - otherPaid);
              return { ...rec, hamaliDue, rentDue, totalDue: hamaliDue + rentDue };
            })
            .filter(r => r.totalDue > 0.005)
            .sort((a, b) => toDate(a.storageStartDate).getTime() - toDate(b.storageStartDate).getTime());

          for (const otherRecord of otherRecordsWithDues) {
            if (amountToApply <= 0.005) break;

            const otherRecordRef = doc(firestore, 'storageRecords', otherRecord.id);
            const newPaymentsOther: Payment[] = [];

            const hamaliToPay = Math.min(amountToApply, otherRecord.hamaliDue);
            if (hamaliToPay > 0) {
              newPaymentsOther.push({ amount: hamaliToPay, date: paymentDate, type: 'hamali' });
              amountToApply -= hamaliToPay;
            }
            
            if (amountToApply > 0) {
                const rentToPay = Math.min(amountToApply, otherRecord.rentDue);
                if (rentToPay > 0) {
                    newPaymentsOther.push({ amount: rentToPay, date: paymentDate, type: 'rent' });
                    amountToApply -= rentToPay;
                }
            }

            if (newPaymentsOther.length > 0) {
              batch.update(otherRecordRef, {
                payments: arrayUnion(...newPaymentsOther.map(p => cleanForFirestore(p)))
              });
            }
          }
        }
        
        await batch.commit();

        toast({ title: 'Success', description: 'Payment(s) recorded successfully.' });
        setIsOpen(false);
        form.reset();
      } catch (error) {
        console.error(error);
        toast({ title: 'Error', description: 'Failed to record payment.', variant: 'destructive' });
      }
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button size="sm">Add Payment</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
            <DialogHeader>
                <DialogTitle>Record a Payment</DialogTitle>
                <DialogDescription>
                For storage record {record.id}. Any overpayment will be automatically applied to this customer's oldest outstanding bills.
                </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
                <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Hamali Pending</span>
                    <span className="font-medium text-orange-600">{formatCurrency(record.hamaliPending)}</span>
                </div>
                <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Rent Pending</span>
                    <span className="font-medium text-blue-600">{formatCurrency(record.rentPending)}</span>
                </div>
                <div className="flex justify-between text-sm font-bold border-t pt-2 mt-2">
                    <span className="text-foreground">Total Due for this Record</span>
                    <span className="text-destructive">{formatCurrency(record.balanceDue)}</span>
                </div>
                <Separator className="my-2" />

                <FormField
                    control={form.control}
                    name="paymentDate"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Payment Date</FormLabel>
                            <FormControl>
                                <Input 
                                    type="date"
                                    {...field}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="paymentAmount"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Payment Amount</FormLabel>
                            <FormControl>
                                <Input 
                                    type="number" 
                                    step="0.01" 
                                    placeholder="0.00"
                                    {...field}
                                    value={field.value ?? ''}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

            </div>
            <DialogFooter>
                <DialogClose asChild>
                    <Button variant="outline" type="button">Cancel</Button>
                </DialogClose>
                <Button type="submit" disabled={isPending}>
                {isPending ? (
                    <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                    </>
                ) : (
                    'Record Payment'
                )}
                </Button>
            </DialogFooter>
            </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
