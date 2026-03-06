
'use client';

import { useState, useTransition, useMemo } from 'react';
import { Loader2, IndianRupee } from 'lucide-react';
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
import type { Payment, StorageRecord, Customer, UnloadingRecord } from '@/lib/definitions';
import { formatCurrency, cleanForFirestore, toDate } from '@/lib/utils';
import { useFirestore } from '@/firebase/provider';
import { doc, writeBatch, arrayUnion } from 'firebase/firestore';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../ui/form';

const BulkPaymentSchema = z.object({
  paymentDate: z.string().refine(val => !isNaN(Date.parse(val)), { message: "Invalid date" }),
  paymentAmount: z.coerce.number().positive('Payment amount must be a positive number.'),
});

type PaymentFormData = z.infer<typeof BulkPaymentSchema>;

type BulkPaymentDialogProps = {
    customer: Customer;
    storageRecords: StorageRecord[];
    unloadingRecords: UnloadingRecord[];
    children: React.ReactNode;
};

export function BulkPaymentDialog({ customer, storageRecords, unloadingRecords, children }: BulkPaymentDialogProps) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const firestore = useFirestore();

  const form = useForm<PaymentFormData>({
    resolver: zodResolver(BulkPaymentSchema),
    defaultValues: {
        paymentDate: new Date().toISOString().split('T')[0],
        paymentAmount: '',
    },
  });

  const { totalDue, totalHamaliDue, totalRentDue } = useMemo(() => {
    let hamaliDue = 0;
    let rentDue = 0;

    storageRecords
        .filter(r => r.customerId === customer.id)
        .forEach(rec => {
            const hamaliPayable = rec.hamaliPayable || 0;
            const totalRentBilled = rec.totalRentBilled || 0;
            const hamaliPaid = (rec.payments || []).filter(p => p.type === 'hamali').reduce((acc, p) => acc + p.amount, 0);
            const rentPaid = (rec.payments || []).filter(p => p.type === 'rent').reduce((acc, p) => acc + p.amount, 0);
            const otherPaid = (rec.payments || []).filter(p => !p.type || p.type === 'other').reduce((acc, p) => acc + p.amount, 0);
            
            hamaliDue += Math.max(0, hamaliPayable - hamaliPaid);
            rentDue += Math.max(0, totalRentBilled - rentPaid - otherPaid);
        });

    unloadingRecords
        .filter(r => r.customerId === customer.id)
        .forEach(rec => {
            const totalHamali = rec.totalHamali || 0;
            const totalPaid = (rec.payments || []).reduce((acc, p) => acc + p.amount, 0);
            hamaliDue += Math.max(0, totalHamali - totalPaid);
        });
    
    return {
        totalHamaliDue: hamaliDue,
        totalRentDue: rentDue,
        totalDue: hamaliDue + rentDue,
    };
  }, [customer.id, storageRecords, unloadingRecords]);

  const onSubmit = (data: PaymentFormData) => {
    if (!firestore) {
      toast({ title: 'Error', description: 'Firestore not available.', variant: 'destructive' });
      return;
    }
    if (data.paymentAmount <= 0) {
        toast({ title: 'Invalid Amount', description: 'Payment amount must be positive.', variant: 'destructive' });
        return;
    }

    startTransition(async () => {
      try {
        const batch = writeBatch(firestore);
        let amountToApply = data.paymentAmount;
        const paymentDate = new Date(data.paymentDate);

        // Combine storage and unloading records
        const allCustomerRecords = [
            ...storageRecords
                .filter(r => r.customerId === customer.id)
                .map(r => ({ ...r, type: 'storage' as const, date: toDate(r.storageStartDate) })),
            ...unloadingRecords
                .filter(r => r.customerId === customer.id)
                .map(r => ({ ...r, type: 'unloading' as const, date: toDate(r.unloadingDate) }))
        ];

        // Sort by date, oldest first
        const sortedRecords = allCustomerRecords.sort((a,b) => a.date.getTime() - b.date.getTime());

        for (const record of sortedRecords) {
            if (amountToApply <= 0.005) break; // Float tolerance
            
            let hamaliDue = 0;
            let rentDue = 0;
            const newPayments: Payment[] = [];

            if (record.type === 'storage') {
                const sr = record;
                const hamaliPayable = sr.hamaliPayable || 0;
                const totalRentBilled = sr.totalRentBilled || 0;
                const hamaliPaid = (sr.payments || []).filter(p => p.type === 'hamali').reduce((acc, p) => acc + p.amount, 0);
                const rentPaid = (sr.payments || []).filter(p => p.type === 'rent').reduce((acc, p) => acc + p.amount, 0);
                const otherPaid = (sr.payments || []).filter(p => !p.type || p.type === 'other').reduce((acc, p) => acc + p.amount, 0);
                hamaliDue = Math.max(0, hamaliPayable - hamaliPaid);
                rentDue = Math.max(0, totalRentBilled - rentPaid - otherPaid);

                const hamaliToPay = Math.min(amountToApply, hamaliDue);
                if (hamaliToPay > 0) {
                    newPayments.push({ amount: hamaliToPay, date: paymentDate, type: 'hamali' });
                    amountToApply -= hamaliToPay;
                }
                if (amountToApply > 0) {
                    const rentToPay = Math.min(amountToApply, rentDue);
                    if (rentToPay > 0) {
                        newPayments.push({ amount: rentToPay, date: paymentDate, type: 'rent' });
                        amountToApply -= rentToPay;
                    }
                }

                if (newPayments.length > 0) {
                    const recordRef = doc(firestore, 'storageRecords', sr.id);
                    batch.update(recordRef, { payments: arrayUnion(...newPayments.map(p => cleanForFirestore(p))) });
                }

            } else { // unloading record
                const ur = record;
                const totalHamali = ur.totalHamali || 0;
                const totalPaid = (ur.payments || []).reduce((acc, p) => acc + p.amount, 0);
                hamaliDue = Math.max(0, totalHamali - totalPaid);

                const hamaliToPay = Math.min(amountToApply, hamaliDue);
                if (hamaliToPay > 0) {
                    newPayments.push({ amount: hamaliToPay, date: paymentDate, type: 'unloading' });
                    amountToApply -= hamaliToPay;
                }
                if (newPayments.length > 0) {
                    const recordRef = doc(firestore, 'unloadingRecords', ur.id);
                    batch.update(recordRef, { payments: arrayUnion(...newPayments.map(p => cleanForFirestore(p))) });
                }
            }
        }
        
        await batch.commit();

        toast({ title: 'Success', description: `${formatCurrency(data.paymentAmount)} applied to customer's pending dues.` });
        setIsOpen(false);
        form.reset();
      } catch (error) {
        console.error(error);
        toast({ title: 'Error', description: `Failed to record payment. ${error}`, variant: 'destructive' });
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
                <DialogTitle>Bulk Payment for {customer.name}</DialogTitle>
                <DialogDescription>
                Enter a single payment amount. It will be automatically applied to this customer's oldest outstanding bills, clearing hamali dues first.
                </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
                 <div className="p-4 rounded-lg bg-secondary border">
                    <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Total Hamali Pending</span>
                        <span className="font-medium">{formatCurrency(totalHamaliDue)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Total Rent Pending</span>
                        <span className="font-medium">{formatCurrency(totalRentDue)}</span>
                    </div>
                    <div className="flex justify-between text-sm font-bold border-t pt-2 mt-2">
                        <span className="text-foreground">Total Due</span>
                        <span className="text-destructive">{formatCurrency(totalDue)}</span>
                    </div>
                </div>

                <FormField
                    control={form.control}
                    name="paymentDate"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Payment Date</FormLabel>
                            <FormControl>
                                <Input type="date" {...field} />
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
                                <Input type="number" step="0.01" placeholder="0.00" {...field} value={field.value ?? ''} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

            </div>
            <DialogFooter>
                <DialogClose asChild><Button variant="outline" type="button">Cancel</Button></DialogClose>
                <Button type="submit" disabled={isPending}>
                {isPending ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>
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
