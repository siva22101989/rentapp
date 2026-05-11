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
import type { Payment, StorageRecord, Customer, UnloadingRecord, WarehouseInfo } from '@/lib/definitions';
import { formatCurrency, cleanForFirestore, toDate, formatManualDate, parseManualDate } from '@/lib/utils';
import { useFirestore } from '@/firebase/provider';
import { doc, writeBatch, arrayUnion } from 'firebase/firestore';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../ui/form';
import { Combobox } from '../ui/combobox';
import { Separator } from '../ui/separator';
import { useDoc } from '@/firebase/firestore/use-doc';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { useAppUser } from '@/firebase/auth/use-user';
import { Checkbox } from '../ui/checkbox';
import { sendSms } from '@/lib/sms';
import { format } from 'date-fns';

const BulkPaymentSchema = z.object({
  customerId: z.string().min(1, 'Please select a customer.'),
  paymentDate: z.string().min(1, 'Payment date is required.'),
  paymentAmount: z.coerce.number().positive('Payment amount must be a positive number.'),
  discount: z.coerce.number().nonnegative('Discount must be a non-negative number.').optional(),
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
  const appUser = useAppUser();
  const [sendSmsNotification, setSendSmsNotification] = useState(true);

  const warehouseInfoRef = useMemoFirebase(
    () => (firestore && appUser?.warehouseId ? doc(firestore, 'warehouses', appUser.warehouseId) : null),
    [firestore, appUser]
  );
  const { data: warehouseInfo } = useDoc<WarehouseInfo>(warehouseInfoRef);

  const customerOptions = customers.map(c => ({ value: c.id, label: c.name }));

  const form = useForm<PaymentFormData>({
    resolver: zodResolver(BulkPaymentSchema),
    defaultValues: {
        customerId: '',
        paymentDate: formatManualDate(new Date()),
        paymentAmount: undefined,
        discount: undefined,
    },
  });
  
  const selectedCustomerId = form.watch('customerId');
  const discountAmount = form.watch('discount') || 0;
  const selectedCustomer = useMemo(() => customers.find(c => c.id === selectedCustomerId), [customers, selectedCustomerId]);

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
            const khataAmount = rec.khataAmount || 0;
            const hamaliPaid = (rec.payments || []).filter(p => p.type === 'hamali' || p.type === 'unloading').reduce((acc, p) => acc + p.amount, 0);
            const rentPaid = (rec.payments || []).filter(p => p.type === 'rent').reduce((acc, p) => acc + p.amount, 0);
            const otherPaid = (rec.payments || []).filter(p => p.type === 'other' || !p.type || p.type === 'discount').reduce((acc, p) => acc + p.amount, 0);
            
            hamaliDue += Math.max(0, hamaliPayable - hamaliPaid);
            rentDue += Math.max(0, (totalRentBilled + khataAmount) - rentPaid - otherPaid);
        });

    unloadingRecords
        .filter(r => r.customerId === selectedCustomerId)
        .forEach(rec => {
            const totalHamali = rec.totalHamali || 0;
            const totalPaid = (rec.payments || []).reduce((acc, p) => acc + p.amount, 0);
            hamaliDue += Math.max(0, totalHamali - totalPaid);
        });
    
    return { totalHamaliDue: hamaliDue, totalRentDue: rentDue, totalDue: hamaliDue + rentDue };
  }, [selectedCustomerId, storageRecords, unloadingRecords]);

  const totalPayable = totalDue - discountAmount;

  const onSubmit = (data: PaymentFormData) => {
    if (!firestore || !appUser?.warehouseId) {
      toast({ title: 'Error', description: 'Context not available.', variant: 'destructive' });
      return;
    }

    const finalDate = parseManualDate(data.paymentDate);
    if (!finalDate) {
      form.setError('paymentDate', { message: 'Invalid format. Use DD-MM-YYYY' });
      return;
    }
    
    startTransition(async () => {
      try {
        const batch = writeBatch(firestore);
        let cashToApply = data.paymentAmount;
        let discountToApply = data.discount || 0;
        const paymentDate = finalDate;

        const allCustomerRecords = [
            ...storageRecords.filter(r => r.customerId === data.customerId).map(r => ({ ...r, recordType: 'storage' as const, date: toDate(r.storageStartDate) })),
            ...unloadingRecords.filter(r => r.customerId === data.customerId).map(r => ({ ...r, recordType: 'unloading' as const, date: toDate(r.unloadingDate) }))
        ];

        const sortedRecords = allCustomerRecords.sort((a,b) => a.date.getTime() - b.date.getTime());

        for (const record of sortedRecords) {
            if (cashToApply <= 0.005 && discountToApply <= 0.005) break; 
            
            const newPayments: Payment[] = [];

            if (record.recordType === 'storage') {
                const sr = record;
                const hamaliPaid = (sr.payments || []).filter(p => p.type === 'hamali' || p.type === 'unloading').reduce((acc, p) => acc + p.amount, 0);
                const rentPaid = (sr.payments || []).filter(p => p.type === 'rent').reduce((acc, p) => acc + p.amount, 0);
                const otherPaid = (sr.payments || []).filter(p => p.type === 'other' || !p.type || p.type === 'discount').reduce((acc, p) => acc + p.amount, 0);
                
                let hamaliDue = Math.max(0, (sr.hamaliPayable || 0) - hamaliPaid);
                let rentDue = Math.max(0, ((sr.totalRentBilled || 0) + (sr.khataAmount || 0)) - rentPaid - otherPaid);

                if (hamaliDue > 0) {
                    const pay = Math.min(cashToApply, hamaliDue);
                    if (pay > 0) { newPayments.push({ amount: pay, date: paymentDate, type: 'hamali' }); cashToApply -= pay; hamaliDue -= pay; }
                    const disc = Math.min(discountToApply, hamaliDue);
                    if (disc > 0) { newPayments.push({ amount: disc, date: paymentDate, type: 'discount' }); discountToApply -= disc; }
                }
                if (rentDue > 0) {
                    const pay = Math.min(cashToApply, rentDue);
                    if (pay > 0) { newPayments.push({ amount: pay, date: paymentDate, type: 'rent' }); cashToApply -= pay; rentDue -= pay; }
                    const disc = Math.min(discountToApply, rentDue);
                    if (disc > 0) { newPayments.push({ amount: disc, date: paymentDate, type: 'discount' }); discountToApply -= disc; }
                }

                if (newPayments.length > 0) {
                    const recordRef = doc(firestore, 'storageRecords', sr.id);
                    batch.update(recordRef, { payments: arrayUnion(...newPayments.map(p => cleanForFirestore(p))) });
                }
            } else {
                const ur = record;
                let hamaliDue = Math.max(0, (ur.totalHamali || 0) - (ur.payments || []).reduce((acc, p) => acc + p.amount, 0));
                if (hamaliDue > 0) {
                    const pay = Math.min(cashToApply, hamaliDue);
                    if (pay > 0) { newPayments.push({ amount: pay, date: paymentDate, type: 'unloading' }); cashToApply -= pay; hamaliDue -= pay; }
                    const disc = Math.min(discountToApply, hamaliDue);
                    if (disc > 0) { newPayments.push({ amount: disc, date: paymentDate, type: 'discount' }); discountToApply -= disc; }
                }
                if (newPayments.length > 0) {
                    const recordRef = doc(firestore, 'unloadingRecords', ur.id);
                    batch.update(recordRef, { payments: arrayUnion(...newPayments.map(p => cleanForFirestore(p))) });
                }
            }
        }
        
        await batch.commit();

        if (sendSmsNotification && warehouseInfo?.textbeeApiKey && selectedCustomer?.phone) {
            const template = warehouseInfo?.smsPaymentTemplate || 'Dear {customerName}, thank you for your payment of {paymentAmount} on {date}. - {warehouseName}';
            const msg = template.replace('{customerName}', selectedCustomer.name).replace('{paymentAmount}', formatCurrency(data.paymentAmount)).replace('{date}', format(paymentDate, 'dd/MM/yy')).replace('{warehouseName}', warehouseInfo?.name || 'GrainDost');
            sendSms({ apiKey: warehouseInfo.textbeeApiKey, deviceId: warehouseInfo.textbeeDeviceId, to: selectedCustomer.phone, message: msg }).catch(console.error);
        }

        toast({ title: 'Payment Recorded', description: `${formatCurrency(data.paymentAmount)} collected.` });
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
         <Button>
            <UserPlus className="mr-2" />
            Bulk Customer Payment
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm max-h-[80vh] overflow-y-auto">
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
            <DialogHeader>
                <DialogTitle>Bulk Customer Payment</DialogTitle>
                <DialogDescription>Select customer and enter amount. Date format: DD-MM-YYYY.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
                <FormField
                    control={form.control}
                    name="customerId"
                    render={({ field }) => (
                        <FormItem className="flex flex-col">
                            <FormLabel>Customer</FormLabel>
                            <Combobox options={customerOptions} value={field.value} onChange={field.onChange} placeholder="Select a customer..." searchPlaceholder="Search customers..." modal={true} />
                            <FormMessage />
                        </FormItem>
                    )}
                />
                {selectedCustomerId && (
                <>
                <Separator />
                <div className="p-4 rounded-lg bg-secondary border">
                    <div className="flex justify-between text-sm"><span>Hamali Pending</span><span>{formatCurrency(totalHamaliDue)}</span></div>
                    <div className="flex justify-between text-sm"><span>Rent Pending</span><span>{formatCurrency(totalRentDue)}</span></div>
                    <div className="flex justify-between text-sm font-bold border-t pt-2 mt-2"><span>Total Due</span><span className="text-destructive">{formatCurrency(totalDue)}</span></div>
                    <div className="flex justify-between text-sm"><span>Discount</span><span className="text-green-600">- {formatCurrency(discountAmount)}</span></div>
                    <div className="flex justify-between text-sm font-bold border-t pt-1"><span>Final Payable</span><span className="text-destructive">{formatCurrency(totalPayable)}</span></div>
                </div>
                <FormField control={form.control} name="paymentDate" render={({ field }) => (
                    <FormItem><FormLabel>Payment Date (DD-MM-YYYY)</FormLabel><FormControl><Input placeholder="DD-MM-YYYY" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="discount" render={({ field }) => (
                    <FormItem><FormLabel>Discount Amount</FormLabel><FormControl><Input type="number" step="0.01" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="paymentAmount" render={({ field }) => (
                    <FormItem><FormLabel>Payment Amount</FormLabel><FormControl><Input type="number" step="0.01" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                )} />
                <div className="flex items-center space-x-2 pt-4">
                    <Checkbox id="sendSmsPayment" checked={sendSmsNotification} onCheckedChange={(checked) => setSendSmsNotification(Boolean(checked))} disabled={!warehouseInfo?.textbeeApiKey || !selectedCustomer?.phone} />
                    <label htmlFor="sendSmsPayment" className="text-sm font-medium leading-none">Send SMS Notification</label>
                </div>
                </>
                )}
            </div>
            <DialogFooter>
                <DialogClose asChild><Button variant="outline" type="button">Cancel</Button></DialogClose>
                <Button type="submit" disabled={isPending || !selectedCustomerId}>
                    {isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : 'Record Payment'}
                </Button>
            </DialogFooter>
            </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}