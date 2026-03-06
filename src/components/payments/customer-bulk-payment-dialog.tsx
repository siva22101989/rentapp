'use client';

import { useState, useTransition, useMemo } from 'react';
import { Loader2, UserPlus } from 'lucide-react';
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
import { Combobox } from '../ui/combobox';
import { Separator } from '../ui/separator';

const BulkPaymentSchema = z.object({
  customerId: z.string().min(1, 'Please select a customer.'),
  paymentDate: z.string().refine(val => !isNaN(Date.parse(val)), { message: "Invalid date" }),
  paymentAmount: z.coerce.number().positive('Payment amount must be a positive number.'),
});

type PaymentFormData = z.infer<typeof BulkPaymentSchema>;

type BulkPaymentDialogProps = {
    customers: Customer[];
    storageRecords: StorageRecord[];
    unloadingRecords: UnloadingRecord[];
};

export function CustomerBulkPaymentDialog({ customers, storageRecords, unloadingRecords }: BulkPaymentDialogProps) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const firestore = useFirestore();

  const customerOptions = customers.map(c => ({ value: c.id, label: c.name }));

  const form = useForm<PaymentFormData>({
    resolver: zodResolver(BulkPaymentSchema),
    defaultValues: {
        customerId: '',
        paymentDate: new Date().toISOString().split('T')[0],
        paymentAmount: undefined,
    },
  });
  
  const selectedCustomerId = form.watch('customerId');

  const { totalDue, totalHamaliDue, totalRentDue } = useMemo(() => {
    if (!selectedCustomerId) {
        return { totalDue: 0, totalHamaliDue: 0, totalRentDue: 0 };
    }

    let hamaliDue = 0;
    let rentDue = 0;

    storageRecords
        .filter(r => r.customerId === selectedCustomerId)
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
        .filter(r => r.customerId === selectedCustomerId)
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
  }, [selectedCustomerId, storageRecords, unloadingRecords]);

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
        
        const settledRecordIds: string[] = [];
        const partiallyPaidRecordIds = new Set<string>();

        // Combine storage and unloading records for the selected customer
        const allCustomerRecords = [
            ...storageRecords
                .filter(r => r.customerId === data.customerId)
                .map(r => ({ ...r, recordType: 'storage' as const, date: toDate(r.storageStartDate) })),
            ...unloadingRecords
                .filter(r => r.customerId === data.customerId)
                .map(r => ({ ...r, recordType: 'unloading' as const, date: toDate(r.unloadingDate) }))
        ];

        // Sort by date, oldest first
        const sortedRecords = allCustomerRecords.sort((a,b) => a.date.getTime() - b.date.getTime());

        for (const record of sortedRecords) {
            if (amountToApply <= 0.005) break; // Float tolerance
            
            const newPayments: Payment[] = [];

            if (record.recordType === 'storage') {
                const sr = record;
                const hamaliPayable = sr.hamaliPayable || 0;
                const totalRentBilled = sr.totalRentBilled || 0;
                const hamaliPaid = (sr.payments || []).filter(p => p.type === 'hamali').reduce((acc, p) => acc + p.amount, 0);
                const rentPaid = (sr.payments || []).filter(p => p.type === 'rent').reduce((acc, p) => acc + p.amount, 0);
                const otherPaid = (sr.payments || []).filter(p => !p.type || p.type === 'other').reduce((acc, p) => acc + p.amount, 0);
                const hamaliDue = Math.max(0, hamaliPayable - hamaliPaid);
                const rentDue = Math.max(0, totalRentBilled - rentPaid - otherPaid);

                if (hamaliDue <= 0.005 && rentDue <= 0.005) continue;

                const hamaliToPay = Math.min(amountToApply, hamaliDue);
                let rentToPay = 0;
                if (amountToApply - hamaliToPay > 0 && rentDue > 0) {
                    rentToPay = Math.min(amountToApply - hamaliToPay, rentDue);
                }

                if (hamaliToPay > 0) newPayments.push({ amount: hamaliToPay, date: paymentDate, type: 'hamali' });
                if (rentToPay > 0) newPayments.push({ amount: rentToPay, date: paymentDate, type: 'rent' });

                if (newPayments.length > 0) {
                    amountToApply -= (hamaliToPay + rentToPay);
                    partiallyPaidRecordIds.add(sr.id);
                    const recordRef = doc(firestore, 'storageRecords', sr.id);
                    batch.update(recordRef, { payments: arrayUnion(...newPayments.map(p => cleanForFirestore(p))) });

                    if (hamaliDue - hamaliToPay <= 0.005 && rentDue - rentToPay <= 0.005) {
                        settledRecordIds.push(sr.id);
                        partiallyPaidRecordIds.delete(sr.id);
                    }
                }

            } else { // unloading record
                const ur = record;
                const totalHamali = ur.totalHamali || 0;
                const totalPaid = (ur.payments || []).reduce((acc, p) => acc + p.amount, 0);
                const hamaliDue = Math.max(0, totalHamali - totalPaid);

                if (hamaliDue <= 0.005) continue;

                const hamaliToPay = Math.min(amountToApply, hamaliDue);
                
                if (hamaliToPay > 0) {
                    newPayments.push({ amount: hamaliToPay, date: paymentDate, type: 'unloading' });
                    amountToApply -= hamaliToPay;

                    partiallyPaidRecordIds.add(ur.billNo || ur.id);
                    const recordRef = doc(firestore, 'unloadingRecords', ur.id);
                    batch.update(recordRef, { payments: arrayUnion(...newPayments.map(p => cleanForFirestore(p))) });
                    
                    if (hamaliDue - hamaliToPay <= 0.005) {
                        settledRecordIds.push(ur.billNo || ur.id);
                        partiallyPaidRecordIds.delete(ur.billNo || ur.id);
                    }
                }
            }
        }
        
        await batch.commit();

        let description = `${formatCurrency(data.paymentAmount)} applied.`;
        if (settledRecordIds.length > 0) {
            description += ` Settled bills: ${settledRecordIds.join(', ')}.`;
        }
        if (partiallyPaidRecordIds.size > 0) {
            description += ` Partially paid: ${Array.from(partiallyPaidRecordIds).join(', ')}.`;
        }

        toast({ 
            title: 'Payment Recorded', 
            description: description,
            duration: 10000,
        });
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
      <DialogTrigger asChild>
         <Button>
            <UserPlus className="mr-2" />
            Bulk Customer Payment
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
            <DialogHeader>
                <DialogTitle>Bulk Customer Payment</DialogTitle>
                <DialogDescription>
                Select a customer and enter a payment amount. It will be automatically applied to their oldest outstanding bills, clearing hamali dues first.
                </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
                <FormField
                    control={form.control}
                    name="customerId"
                    render={({ field }) => (
                        <FormItem className="flex flex-col">
                            <FormLabel>Customer</FormLabel>
                            <Combobox
                                options={customerOptions}
                                value={field.value}
                                onChange={field.onChange}
                                placeholder="Select a customer..."
                                searchPlaceholder="Search customers..."
                                emptyPlaceholder="No customer found."
                            />
                            <FormMessage />
                        </FormItem>
                    )}
                />

                {selectedCustomerId && (
                <>
                <Separator />
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
                        <span className="text-foreground">Total Due for Customer</span>
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
                </>
                )}
            </div>
            <DialogFooter>
                <DialogClose asChild><Button variant="outline" type="button">Cancel</Button></DialogClose>
                <Button type="submit" disabled={isPending || !selectedCustomerId}>
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
