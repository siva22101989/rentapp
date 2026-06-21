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
import type { StorageRecord, Customer, UnloadingRecord, WarehouseInfo, CustomerPayment } from '@/lib/definitions';
import { formatCurrency, toDate, formatManualDate, parseManualDate } from '@/lib/utils';
import { useFirestore } from '@/firebase/provider';
import { doc, getDoc } from 'firebase/firestore';
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
import { recordCustomerBulkPayment } from '@/lib/data';

const BulkPaymentSchema = z.object({
  customerId: z.string().min(1, 'Please select a customer.'),
  paymentDate: z.string().min(1, 'Payment date is required.'),
  paymentAmount: z.coerce.number().nonnegative('Payment amount must be non-negative.').optional().default(0),
  paymentType: z.enum(['rent', 'hamali']),
  discount: z.coerce.number().nonnegative('Discount must be non-negative.').optional().default(0),
}).refine(data => (data.paymentAmount || 0) + (data.discount || 0) > 0, {
    message: "Enter either a payment amount or a discount.",
    path: ['paymentAmount']
});

type PaymentFormData = z.infer<typeof BulkPaymentSchema>;

type BulkPaymentDialogProps = {
    customers: Customer[];
    storageRecords: StorageRecord[];
    unloadingRecords: UnloadingRecord[];
    customerPayments?: CustomerPayment[];
};

export function CustomerBulkPaymentDialog({ customers, storageRecords, unloadingRecords, customerPayments = [] }: BulkPaymentDialogProps) {
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
    const duesMap: Record<string, { hLiability: number, rLiability: number, totalPaid: number }> = {};

    const getCust = (id: string) => {
        if (!duesMap[id]) duesMap[id] = { hLiability: 0, rLiability: 0, totalPaid: 0 };
        return duesMap[id];
    }

    storageRecords.forEach(rec => {
        const c = getCust(rec.customerId);
        c.hLiability += rec.hamaliPayable || 0;
        c.rLiability += (rec.totalRentBilled || 0) + (rec.khataAmount || 0);
        (rec.payments || []).forEach(p => {
            if (p.type === 'hamali' || p.type === 'unloading') c.hPaid += (Number(p.amount) || 0);
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
    
    // Add account-level global payments
    customerPayments.forEach(cp => {
        const c = getCust(cp.customerId);
        if (cp.type === 'hamali') c.hPaid += (Number(cp.amount) || 0);
        else c.rPaid += (Number(cp.amount) || 0);
    });

    return duesMap;
  }, [storageRecords, unloadingRecords, customerPayments, isOpen]);

  const customerOptions = useMemo(() => {
    if (!isOpen) return [];
    return customers
        .map(c => {
            const d = customerDuesMap[c.id];
            const net = d ? (d.hLiability + d.rLiability) - (d.hPaid + d.rPaid) : 0;
            return { c, net };
        })
        .filter(x => x.net > 0.5)
        .map(x => ({ value: x.c.id, label: x.c.name }));
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
  const selectedCustomer = useMemo(() => customers.find(c => c.id === selectedCustomerId), [customers, selectedCustomerId]);

  const { totalDue, totalHamaliDue, totalRentDue } = useMemo(() => {
    if (!selectedCustomerId || !customerDuesMap[selectedCustomerId]) return { totalDue: 0, totalHamaliDue: 0, totalRentDue: 0 };
    const d = customerDuesMap[selectedCustomerId];
    const h = Math.max(0, d.hLiability - d.hPaid);
    const r = Math.max(0, d.rLiability - d.rPaid);
    return { totalHamaliDue: h, totalRentDue: r, totalDue: h + r };
  }, [selectedCustomerId, customerDuesMap]);

  const categoryDue = paymentType === 'hamali' ? totalHamaliDue : totalRentDue;

  const onSubmit = (data: PaymentFormData) => {
    if (!firestore || !appUser?.warehouseId) return;

    const finalDate = parseManualDate(data.paymentDate);
    if (!finalDate) {
      form.setError('paymentDate', { message: 'Invalid format. Use DD-MM-YYYY' });
      return;
    }
    
    startTransition(async () => {
      try {
        const bulkAmount = (data.paymentAmount || 0) + (data.discount || 0);
        
        await recordCustomerBulkPayment(firestore, {
            customerId: data.customerId,
            warehouseId: appUser.warehouseId!,
            amount: bulkAmount,
            date: finalDate,
            type: data.paymentType,
            isDiscount: (data.discount || 0) > 0 && (data.paymentAmount || 0) === 0,
            description: `Bulk Account Payment recorded in ledger. Category: ${data.paymentType.toUpperCase()}`
        });
        
        if (sendSmsNotification && warehouseInfo?.textbeeApiKey && selectedCustomer?.phone) {
            const typeLabel = data.paymentType === 'hamali' ? 'Hamali' : 'Rent';
            const template = warehouseInfo?.smsPaymentTemplate || 'Dear {customerName}, thank you for your {paymentType} bulk transaction of {paymentAmount} on {date}. - {warehouseName}';
            const msg = template
                .replace('{customerName}', selectedCustomer.name)
                .replace('{paymentType}', typeLabel)
                .replace('{paymentAmount}', formatCurrency(bulkAmount))
                .replace('{date}', format(finalDate, 'dd/MM/yy'))
                .replace('{warehouseName}', warehouseInfo?.name || 'GrainDost');
            sendSms({ apiKey: warehouseInfo.textbeeApiKey, deviceId: warehouseInfo.textbeeDeviceId, to: selectedCustomer.phone, message: msg }).catch(console.error);
        }
        
        toast({ title: 'Bulk Payment Recorded', description: `Successfully added ${formatCurrency(bulkAmount)} to the customer account ledger.` });
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
                <DialogTitle>Account Bulk Ledger Entry</DialogTitle>
                <DialogDescription>Add cash or adjustments directly to the customer balance without bill allocation.</DialogDescription>
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
                                    <FormLabel>Apply to Balance</FormLabel>
                                    <FormControl>
                                        <RadioGroup
                                            onValueChange={field.onChange}
                                            defaultValue={field.value}
                                            className="flex gap-4"
                                        >
                                            <FormItem className="flex items-center space-x-2 space-y-0">
                                                <FormControl><RadioGroupItem value="rent" /></FormControl>
                                                <Label className="font-normal cursor-pointer">Godown Rent</Label>
                                            </FormItem>
                                            <FormItem className="flex items-center space-x-2 space-y-0">
                                                <FormControl><RadioGroupItem value="hamali" /></FormControl>
                                                <Label className="font-normal cursor-pointer">Handling/Hamali</Label>
                                            </FormItem>
                                        </RadioGroup>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="p-4 rounded-lg bg-primary/5 border-2 border-primary/20 space-y-1">
                            <div className="flex justify-between text-xs font-black uppercase text-primary/60 tracking-wider">
                                <span>{paymentType === 'hamali' ? 'Hamali Dues' : 'Rent Dues'}</span>
                                <span className="font-mono text-base text-primary">{formatCurrency(categoryDue)}</span>
                            </div>
                        </div>

                        <FormField control={form.control} name="paymentDate" render={({ field }) => (
                            <FormItem><FormLabel>Date</FormLabel><FormControl><Input placeholder="DD-MM-YYYY" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        
                        <div className="grid grid-cols-2 gap-4">
                            <FormField control={form.control} name="paymentAmount" render={({ field }) => (
                                <FormItem><FormLabel>Amount Received</FormLabel><FormControl><Input type="number" step="0.01" placeholder="0.00" {...field} value={field.value ?? ''} className="font-mono font-bold" /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="discount" render={({ field }) => (
                                <FormItem><FormLabel>Discount/Adjustment</FormLabel><FormControl><Input type="number" step="0.01" placeholder="0.00" {...field} value={field.value ?? ''} className="font-mono text-green-600" /></FormControl><FormMessage /></FormItem>
                            )} />
                        </div>

                        <div className="flex items-center space-x-2 pt-2">
                            <Checkbox id="sendSmsBulk" checked={sendSmsNotification} onCheckedChange={(checked) => setSendSmsNotification(Boolean(checked))} disabled={!warehouseInfo?.textbeeApiKey || !selectedCustomer?.phone} />
                            <label htmlFor="sendSmsBulk" className="text-xs font-bold text-slate-500 uppercase cursor-pointer">Send SMS Receipt</label>
                        </div>
                    </>
                )}
            </div>
            <DialogFooter className="p-6 pt-4 border-t shrink-0">
                <DialogClose asChild><Button variant="outline" type="button" className="font-bold uppercase text-[10px]">Cancel</Button></DialogClose>
                <Button type="submit" disabled={isPending || !selectedCustomerId} className="font-black uppercase tracking-widest text-[10px]">
                   {isPending ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : 'Record Bulk Payment'}
                </Button>
            </DialogFooter>
            </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}