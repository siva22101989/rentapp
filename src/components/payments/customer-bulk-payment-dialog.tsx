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
import { useDoc } from '@/firebase/firestore/use-doc';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { useAppUser } from '@/firebase/auth/use-user';
import { Checkbox } from '../ui/checkbox';
import { sendSms } from '@/lib/sms';
import { format } from 'date-fns';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Label } from '../ui/label';

const BulkPaymentSchema = z.object({
  customerId: z.string().min(1, 'Please select a customer.'),
  paymentDate: z.string().min(1, 'Payment date is required.'),
  paymentAmount: z.coerce.number().nonnegative('Payment amount must be a non-negative number.').optional().default(0),
  paymentType: z.enum(['rent', 'hamali']),
  discount: z.coerce.number().nonnegative('Discount must be a non-negative number.').optional().default(0),
}).refine(data => (data.paymentAmount || 0) + (data.discount || 0) > 0, {
    message: "Enter either a payment amount or a discount.",
    path: ['paymentAmount']
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

  const customerDuesMap = useMemo(() => {
    if (!isOpen) return {};
    const duesMap: Record<string, { hLiability: number, rLiability: number, hPaid: number, rPaid: number }> = {};

    const getCust = (id: string) => {
        if (!duesMap[id]) duesMap[id] = { hLiability: 0, rLiability: 0, hPaid: 0, rPaid: 0 };
        return duesMap[id];
    }

    storageRecords.forEach(rec => {
        const c = getCust(rec.customerId);
        c.hLiability += rec.hamaliPayable || 0;
        c.rLiability += (rec.totalRentBilled || 0) + (rec.khataAmount || 0);
        (rec.payments || []).forEach(p => {
            const isHamali = p.type === 'hamali' || p.type === 'unloading';
            if (isHamali) c.hPaid += (Number(p.amount) || 0);
            else c.rPaid += (Number(p.amount) || 0);
        });
    });

    unloadingRecords.forEach(rec => {
        const c = getCust(rec.customerId);
        const remainingBags = Math.max(0, (rec.bagsUnloaded || 0) - (rec.bagsSentToDrying || 0));
        c.hLiability += remainingBags * (rec.hamaliPerBag || 0);
        (rec.payments || []).forEach(p => {
            c.hPaid += (Number(p.amount) || 0);
        });
    });

    return duesMap;
  }, [storageRecords, unloadingRecords, isOpen]);

  const customerOptions = useMemo(() => {
    if (!isOpen) return [];
    return customers
        .filter(c => {
            const d = customerDuesMap[c.id];
            if (!d) return false;
            const net = (d.hLiability + d.rLiability) - (d.hPaid + d.rPaid);
            return net > 0.5;
        })
        .map(c => ({ value: c.id, label: c.name }));
  }, [customers, customerDuesMap, isOpen]);

  const form = useForm<PaymentFormData>({
    resolver: zodResolver(BulkPaymentSchema),
    defaultValues: {
        customerId: '',
        paymentDate: formatManualDate(new Date()),
        paymentAmount: 0,
        paymentType: 'rent',
        discount: 0,
    },
  });
  
  const selectedCustomerId = form.watch('customerId');
  const paymentType = form.watch('paymentType');
  const discountAmount = form.watch('discount') || 0;
  const selectedCustomer = useMemo(() => customers.find(c => c.id === selectedCustomerId), [customers, selectedCustomerId]);

  const { totalDue, totalHamaliDue, totalRentDue } = useMemo(() => {
    if (!selectedCustomerId || !customerDuesMap[selectedCustomerId]) return { totalDue: 0, totalHamaliDue: 0, totalRentDue: 0 };
    const d = customerDuesMap[selectedCustomerId];
    
    const h = Math.max(0, d.hLiability - d.hPaid);
    const r = Math.max(0, d.rLiability - d.rPaid);
    return { totalHamaliDue: h, totalRentDue: r, totalDue: h + r };
  }, [selectedCustomerId, customerDuesMap]);

  const categoryDue = paymentType === 'hamali' ? totalHamaliDue : totalRentDue;
  const totalPayableAfterDiscount = Math.max(0, categoryDue - discountAmount);

  const onSubmit = (data: PaymentFormData) => {
    if (!firestore || !appUser?.warehouseId) return;

    const finalDate = parseManualDate(data.paymentDate);
    if (!finalDate) {
      form.setError('paymentDate', { message: 'Invalid format. Use DD-MM-YYYY' });
      return;
    }
    
    startTransition(async () => {
      try {
        const batch = writeBatch(firestore);
        let cashToApply = data.paymentAmount || 0;
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

                if (recordDue > 0) {
                    const pay = Math.min(cashToApply, recordDue);
                    if (pay > 0) { 
                        newPayments.push({ amount: pay, date: paymentDate, type: data.paymentType as any }); 
                        cashToApply -= pay; 
                        recordDue -= pay; 
                    }
                    const disc = Math.min(discountToApply, recordDue);
                    if (disc > 0) { 
                        newPayments.push({ amount: disc, date: paymentDate, type: 'discount' }); 
                        discountToApply -= disc; 
                    }
                }
                if (newPayments.length > 0) batch.update(doc(firestore, 'storageRecords', sr.id), { payments: arrayUnion(...newPayments.map(p => cleanForFirestore(p))) });
            } else if (record.recordType === 'unloading' && data.paymentType === 'hamali') {
                const ur = record as any;
                const remainingBags = Math.max(0, (ur.bagsUnloaded || 0) - (ur.bagsSentToDrying || 0));
                const totalLiabOnRecord = remainingBags * (ur.hamaliPerBag || 0);
                const totalPaidOnRecord = (ur.payments || []).reduce((acc: number, p: any) => acc + p.amount, 0);
                let recordDue = Math.max(0, totalLiabOnRecord - totalPaidOnRecord);
                
                if (recordDue > 0) {
                    const pay = Math.min(cashToApply, recordDue);
                    if (pay > 0) { 
                        newPayments.push({ amount: pay, date: paymentDate, type: 'unloading' }); 
                        cashToApply -= pay; 
                        recordDue -= pay; 
                    }
                    const disc = Math.min(discountToApply, recordDue);
                    if (disc > 0) { 
                        newPayments.push({ amount: disc, date: paymentDate, type: 'discount' }); 
                        discountToApply -= disc; 
                    }
                }
                if (newPayments.length > 0) batch.update(doc(firestore, 'unloadingRecords', ur.id), { payments: arrayUnion(...newPayments.map(p => cleanForFirestore(p))) });
            }
        }
        
        await batch.commit();
        
        if (sendSmsNotification && warehouseInfo?.textbeeApiKey && selectedCustomer?.phone) {
            const totalAction = (data.paymentAmount || 0) + (data.discount || 0);
            const typeLabel = data.paymentType === 'hamali' ? 'Hamali' : 'Rent';
            const template = warehouseInfo?.smsPaymentTemplate || 'Dear {customerName}, thank you for your {paymentType} transaction of {paymentAmount} on {date}. - {warehouseName}';
            const msg = template
                .replace('{customerName}', selectedCustomer.name)
                .replace('{paymentType}', typeLabel)
                .replace('{paymentAmount}', formatCurrency(totalAction))
                .replace('{date}', format(paymentDate, 'dd/MM/yy'))
                .replace('{warehouseName}', warehouseInfo?.name || 'GrainDost');
            sendSms({ apiKey: warehouseInfo.textbeeApiKey, deviceId: warehouseInfo.textbeeDeviceId, to: selectedCustomer.phone, message: msg }).catch(console.error);
        }
        
        toast({ title: 'Transaction Recorded', description: `Recorded collection/adjustment for ${data.paymentType}.` });
        setIsOpen(false);
        form.reset();
      } catch (error) {
        console.error(error);
        toast({ title: 'Error', description: 'Failed to record transaction.', variant: 'destructive' });
      }
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
         <Button><UserPlus className="mr-2" />Bulk Payment / Discount</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col h-full overflow-hidden">
            <DialogHeader className="p-6 pb-2 shrink-0">
                <DialogTitle>Bulk Payment / Discount</DialogTitle>
                <DialogDescription>Record a cash collection or apply an adjustment to dues.</DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 min-h-0">
                <FormField control={form.control} name="customerId" render={({ field }) => (
                    <FormItem className="flex flex-col">
                        <FormLabel>Select Customer</FormLabel>
                        <Combobox options={customerOptions} value={field.value} onChange={field.onChange} placeholder="Select customer..." modal={true} />
                        <FormMessage />
                    </FormItem>
                )} />

                {selectedCustomerId && (
                    <>
                        <FormField
                            control={form.control}
                            name="paymentType"
                            render={({ field }) => (
                                <FormItem className="space-y-3">
                                    <FormLabel>Transaction Category</FormLabel>
                                    <FormControl>
                                        <RadioGroup
                                            onValueChange={field.onChange}
                                            defaultValue={field.value}
                                            className="flex gap-4"
                                        >
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

                        <div className="p-4 rounded-lg bg-secondary border space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">{paymentType === 'hamali' ? 'Hamali Pending' : 'Rent Pending'}</span>
                                <span className="font-bold text-primary">{formatCurrency(categoryDue)}</span>
                            </div>
                        </div>

                        <FormField control={form.control} name="paymentDate" render={({ field }) => (
                            <FormItem><FormLabel>Date (DD-MM-YYYY)</FormLabel><FormControl><Input placeholder="DD-MM-YYYY" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        
                        <div className="grid grid-cols-2 gap-4">
                            <FormField control={form.control} name="paymentAmount" render={({ field }) => (
                                <FormItem><FormLabel>Cash Collected</FormLabel><FormControl><Input type="number" step="0.01" placeholder="0.00" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="discount" render={({ field }) => (
                                <FormItem><FormLabel>Discount / Waiver</FormLabel><FormControl><Input type="number" step="0.01" placeholder="0.00" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                            )} />
                        </div>

                        <div className="flex items-center space-x-2 pt-2">
                            <Checkbox id="sendSmsBulk" checked={sendSmsNotification} onCheckedChange={(checked) => setSendSmsNotification(Boolean(checked))} disabled={!warehouseInfo?.textbeeApiKey || !selectedCustomer?.phone} />
                            <label htmlFor="sendSmsBulk" className="text-sm font-medium leading-none cursor-pointer">Send SMS Notification</label>
                        </div>
                    </>
                )}
            </div>
            <DialogFooter className="p-6 pt-4 border-t shrink-0">
                <DialogClose asChild><Button variant="outline" type="button">Cancel</Button></DialogClose>
                <Button type="submit" disabled={isPending || !selectedCustomerId}>
                   {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                   Save Transaction
                </Button>
            </DialogFooter>
            </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
