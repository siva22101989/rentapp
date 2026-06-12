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
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Label } from '../ui/label';

const BulkPaymentSchema = z.object({
  paymentDate: z.string().refine(val => !isNaN(Date.parse(val)), { message: "Invalid date" }),
  paymentAmount: z.coerce.number().positive('Payment amount must be a positive number.'),
  paymentType: z.enum(['rent', 'hamali']),
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
        paymentAmount: undefined,
        paymentType: 'rent',
    },
  });

  const paymentType = form.watch('paymentType');

  const { totalDue, totalHamaliDue, totalRentDue } = useMemo(() => {
    let hamaliLiability = 0;
    let hamaliPaid = 0;
    let rentLiability = 0;
    let rentPaid = 0;

    storageRecords
        .filter(r => r.customerId === customer.id)
        .forEach(rec => {
            hamaliLiability += rec.hamaliPayable || 0;
            rentLiability += (rec.totalRentBilled || 0) + (rec.khataAmount || 0);
            (rec.payments || []).forEach(p => {
                const isHamali = p.type === 'hamali' || p.type === 'unloading';
                if (isHamali) hamaliPaid += (p.amount || 0);
                else rentPaid += (p.amount || 0);
            });
        });

    unloadingRecords
        .filter(r => r.customerId === customer.id)
        .forEach(rec => {
            const remainingBags = Math.max(0, (rec.bagsUnloaded || 0) - (rec.bagsSentToDrying || 0));
            hamaliLiability += remainingBags * (rec.hamaliPerBag || 0);
            (rec.payments || []).forEach(p => {
                hamaliPaid += (p.amount || 0);
            });
        });
    
    const hPending = Math.max(0, hamaliLiability - hamaliPaid);
    const rPending = Math.max(0, rentLiability - rentPaid);

    return {
        totalHamaliDue: hPending,
        totalRentDue: rPending,
        totalDue: hPending + rPending,
    };
  }, [customer.id, storageRecords, unloadingRecords, isOpen]);

  const activeCategoryDue = paymentType === 'hamali' ? totalHamaliDue : totalRentDue;

  const onSubmit = (data: PaymentFormData) => {
    if (!firestore) return;

    startTransition(async () => {
      try {
        const batch = writeBatch(firestore);
        let amountToApply = data.paymentAmount;
        const paymentDate = new Date(data.paymentDate);

        const allCustomerRecords = [
            ...storageRecords.filter(r => r.customerId === customer.id).map(r => ({ ...r, rType: 'storage' as const, date: toDate(r.storageStartDate) })),
            ...unloadingRecords.filter(r => r.customerId === customer.id).map(r => ({ ...r, rType: 'unloading' as const, date: toDate(r.unloadingDate) }))
        ];

        const sortedRecords = allCustomerRecords.sort((a,b) => a.date.getTime() - b.date.getTime());

        for (const record of sortedRecords) {
            if (amountToApply <= 0.005) break; 
            const newPayments: Payment[] = [];

            if (record.rType === 'storage') {
                const sr = record as any;
                const totalPaidOnRecord = (sr.payments || []).reduce((acc: number, p: any) => acc + (p.amount || 0), 0);
                const hamaliPaidOnRecord = (sr.payments || []).filter((p: any) => p.type === 'hamali' || p.type === 'unloading').reduce((acc: number, p: any) => acc + (p.amount || 0), 0);
                const rentPaidOnRecord = totalPaidOnRecord - hamaliPaidOnRecord;

                let recordDue = 0;
                if (data.paymentType === 'hamali') {
                    recordDue = Math.max(0, (sr.hamaliPayable || 0) - hamaliPaidOnRecord);
                } else {
                    recordDue = Math.max(0, ((sr.totalRentBilled || 0) + (sr.khataAmount || 0)) - rentPaidOnRecord);
                }

                const apply = Math.min(amountToApply, recordDue);
                if (apply > 0) {
                    newPayments.push({ amount: apply, date: paymentDate, type: data.paymentType as any });
                    amountToApply -= apply;
                    batch.update(doc(firestore, 'storageRecords', sr.id), { payments: arrayUnion(...newPayments.map(p => cleanForFirestore(p))) });
                }
            } else if (record.rType === 'unloading' && data.paymentType === 'hamali') {
                const ur = record as any;
                const remainingBags = Math.max(0, (ur.bagsUnloaded || 0) - (ur.bagsSentToDrying || 0));
                const totalLiabOnRecord = remainingBags * (ur.hamaliPerBag || 0);
                const totalPaidOnRecord = (ur.payments || []).reduce((acc: number, p: any) => acc + p.amount, 0);
                let recordDue = Math.max(0, totalLiabOnRecord - totalPaidOnRecord);

                const apply = Math.min(amountToApply, recordDue);
                if (apply > 0) {
                    newPayments.push({ amount: apply, date: paymentDate, type: 'unloading' });
                    amountToApply -= apply;
                    batch.update(doc(firestore, 'unloadingRecords', ur.id), { payments: arrayUnion(...newPayments.map(p => cleanForFirestore(p))) });
                }
            }
        }
        
        await batch.commit();
        toast({ title: 'Success', description: `${formatCurrency(data.paymentAmount)} applied to ${data.paymentType} dues.` });
        setIsOpen(false);
        form.reset();
      } catch (error) {
        toast({ title: 'Error', description: 'Failed to record payment.', variant: 'destructive' });
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
                <DialogTitle>Record Payment for {customer.name}</DialogTitle>
                <DialogDescription>Choose whether this collection is for Rent or Hamali charges.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
                 <FormField
                    control={form.control}
                    name="paymentType"
                    render={({ field }) => (
                        <FormItem className="space-y-3">
                            <FormLabel>Category</FormLabel>
                            <FormControl>
                                <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex gap-4">
                                    <FormItem className="flex items-center space-x-2 space-y-0">
                                        <FormControl><RadioGroupItem value="rent" /></FormControl>
                                        <Label className="font-normal cursor-pointer">Rent</Label>
                                    </FormItem>
                                    <FormItem className="flex items-center space-x-2 space-y-0">
                                        <FormControl><RadioGroupItem value="hamali" /></FormControl>
                                        <Label className="font-normal cursor-pointer">Hamali</Label>
                                    </FormItem>
                                </RadioGroup>
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                 <div className="p-4 rounded-lg bg-secondary border">
                    <div className="flex justify-between text-sm font-bold">
                        <span className="text-muted-foreground uppercase text-[10px] tracking-wider">{paymentType === 'hamali' ? 'Hamali Pending' : 'Rent Pending'}</span>
                        <span className="text-primary">{formatCurrency(activeCategoryDue)}</span>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <FormField
                        control={form.control}
                        name="paymentDate"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Date</FormLabel>
                                <FormControl><Input type="date" {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="paymentAmount"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Amount</FormLabel>
                                <FormControl><Input type="number" step="0.01" placeholder="0.00" {...field} value={field.value ?? ''} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>
            </div>
            <DialogFooter>
                <DialogClose asChild><Button variant="outline" type="button">Cancel</Button></DialogClose>
                <Button type="submit" disabled={isPending}>
                    {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Record Payment'}
                </Button>
            </DialogFooter>
            </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
