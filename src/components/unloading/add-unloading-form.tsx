'use client';

import { useState, useEffect, useMemo, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Sparkles } from 'lucide-react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase/provider';
import type { Customer, Commodity, UnloadingRecord, WarehouseInfo, Lot, StorageRecord } from '@/lib/definitions';
import { setDoc, doc, getDoc } from 'firebase/firestore';
import { formatCurrency, cleanForFirestore } from '@/lib/utils';
import { Separator } from '../ui/separator';
import { Combobox } from '../ui/combobox';
import { Checkbox } from '@/components/ui/checkbox';
import { sendSms } from '@/lib/sms';
import { format } from 'date-fns';
import { useDoc } from '@/firebase/firestore/use-doc';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { useAppUser } from '@/firebase/auth/use-user';

const UnloadingRecordSchema = z.object({
  customerId: z.string().min(1, 'Customer is required.'),
  commodityDescription: z.string().min(1, 'Commodity is required.'),
  location: z.string().min(1, 'Storage location is required.'),
  lorryTractorNo: z.string().optional(),
  unloadingDate: z.string().min(1, 'Date is required.'),
  bagsUnloaded: z.coerce.number().positive('Number of bags must be positive.'),
  customerHamaliPerBag: z.coerce.number().nonnegative('Customer hamali rate must be non-negative.'),
  workerHamaliPerBag: z.coerce.number().nonnegative('Worker hamali rate must be non-negative.').optional(),
  billNo: z.string().min(1, 'Bill No is required.'),
});

type UnloadingFormData = z.infer<typeof UnloadingRecordSchema>;

export function AddUnloadingRecordForm({ customers, commodities, lots, storageRecords, nextBillNo }: { customers: Customer[], commodities: Commodity[], lots: Lot[], storageRecords: StorageRecord[], nextBillNo: string }) {
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();
    const firestore = useFirestore();
    const appUser = useAppUser();
    const [sendSmsNotification, setSendSmsNotification] = useState(false);

    const warehouseInfoRef = useMemoFirebase(
      () => (firestore && appUser?.warehouseId ? doc(firestore, 'warehouses', appUser.warehouseId) : null),
      [firestore, appUser]
    );
    const { data: warehouseInfo } = useDoc<WarehouseInfo>(warehouseInfoRef);

    const form = useForm<UnloadingFormData>({
        resolver: zodResolver(UnloadingRecordSchema),
        defaultValues: {
          customerId: '',
          commodityDescription: '',
          location: '',
          lorryTractorNo: '',
          unloadingDate: new Date().toISOString().split('T')[0],
          bagsUnloaded: undefined,
          customerHamaliPerBag: undefined,
          workerHamaliPerBag: undefined,
          billNo: nextBillNo,
        },
    });

    useEffect(() => {
        if (nextBillNo) {
            form.setValue('billNo', nextBillNo);
        }
    }, [nextBillNo, form]);
    
    const customerOptions = customers.map(c => ({ value: c.id, label: c.name }));
    const lotOccupancy = useMemo(() => {
        const occupancy: { [lotName: string]: number } = {};
        (storageRecords || []).forEach(record => {
            if (record.location && record.bagsStored > 0) {
                occupancy[record.location] = (occupancy[record.location] || 0) + record.bagsStored;
            }
        });
        return occupancy;
    }, [storageRecords]);

    const lotOptions = useMemo(() => {
        return lots.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })).map(lot => ({
            value: lot.name,
            label: `${lot.name} (${lotOccupancy[lot.name] || 0}${lot.capacity ? ` / ${lot.capacity}` : ''} bags)`
        }));
    }, [lots, lotOccupancy]);
      
    const bagsUnloaded = form.watch('bagsUnloaded');
    const customerHamaliPerBag = form.watch('customerHamaliPerBag');

    const totalCustomerHamali = useMemo(() => {
        const bags = Number(bagsUnloaded) || 0;
        const custRate = Number(customerHamaliPerBag) || 0;
        return bags * custRate;
    }, [bagsUnloaded, customerHamaliPerBag]);

    const selectedCustomerId = form.watch('customerId');
    const selectedCustomer = useMemo(() => customers.find(c => c.id === selectedCustomerId), [selectedCustomerId, customers]);

    const onSubmit = async (data: UnloadingFormData) => {
        if (!firestore || !appUser?.warehouseId) {
            toast({ title: 'Error', description: 'Context missing.', variant: 'destructive' });
            return;
        }

        startTransition(async () => {
            try {
                const existingRef = doc(firestore, 'unloadingRecords', data.billNo);
                const existingSnap = await getDoc(existingRef);
                if (existingSnap.exists()) {
                    toast({ title: 'Duplicate Bill No', description: `Bill No #${data.billNo} already exists.`, variant: 'destructive' });
                    return;
                }

                const totalHamali = data.bagsUnloaded * data.customerHamaliPerBag;
                const workerHamaliPayable = data.bagsUnloaded * (data.workerHamaliPerBag ?? data.customerHamaliPerBag);
                const finalDate = new Date(data.unloadingDate);
                
                const rawRecord = { 
                    ...data, 
                    hamaliPerBag: data.customerHamaliPerBag, 
                    warehouseId: appUser.warehouseId, 
                    unloadingDate: finalDate, 
                    status: 'Unloading' as const, 
                    bagsSentToDrying: 0, 
                    totalHamali, 
                    workerHamaliPayable 
                };
                
                await setDoc(doc(firestore, 'unloadingRecords', data.billNo), cleanForFirestore(rawRecord));

                if (sendSmsNotification && warehouseInfo?.textbeeApiKey && selectedCustomer?.phone) {
                    const template = warehouseInfo?.smsUnloadingTemplate || 'Dear {customerName}, delivery received on {date}. Bill: {billNo}. Thank you.';
                    const message = template
                        .replace('{customerName}', selectedCustomer.name)
                        .replace('{bags}', String(data.bagsUnloaded))
                        .replace('{billNo}', data.billNo)
                        .replace('{date}', format(finalDate, 'dd/MM/yy'))
                        .replace('{warehouseName}', warehouseInfo?.name || 'Sri Lakshmi Warehouse');
                    
                    sendSms({ apiKey: warehouseInfo.textbeeApiKey, deviceId: warehouseInfo.textbeeDeviceId, to: selectedCustomer.phone, message }).catch(console.error);
                }
                
                toast({ title: 'Success', description: 'Unloading record added.' });
                form.reset();
                window.open(`/unloading/receipt/${data.billNo}`, '_blank');
            } catch (error) {
                console.error(error);
                toast({ title: 'Error', description: 'Failed to add record.', variant: 'destructive' });
            }
        });
    };

    return (
        <Card>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)}>
                    <CardHeader>
                        <CardTitle className="text-lg font-bold">Add New Unloading Record</CardTitle>
                        <CardDescription className="text-xs">Bill No. is strictly auto-generated sequentially.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <FormField control={form.control} name="billNo" render={({ field }) => (
                            <FormItem>
                                <FormLabel className="flex items-center gap-2 text-xs font-semibold">
                                    Bill No. (Auto)
                                    <Badge variant="outline" className="text-[9px] uppercase font-bold py-0 h-4 bg-primary/5 text-primary border-primary/20">
                                        <Sparkles className="h-2 w-2 mr-1" />
                                        Auto-Generated
                                    </Badge>
                                </FormLabel>
                                <FormControl>
                                    <Input className="font-mono font-bold bg-muted/50 cursor-not-allowed text-sm h-9" {...field} readOnly />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="customerId" render={({ field }) => (
                            <FormItem className="flex flex-col">
                                <FormLabel className="text-xs font-semibold">Customer</FormLabel>
                                <Combobox options={customerOptions} value={field.value} onChange={field.onChange} placeholder="Select a customer..." modal={true} />
                                <FormMessage />
                            </FormItem>
                        )} />
                        <div className="grid grid-cols-2 gap-4">
                            <FormField control={form.control} name="commodityDescription" render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-xs font-semibold">Commodity</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl>
                                            <SelectTrigger className="text-sm h-9">
                                                <SelectValue placeholder="Select" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {commodities.map(c => <SelectItem key={c.id} value={c.name} className="text-sm">{c.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="location" render={({ field }) => (
                                <FormItem className="flex flex-col">
                                    <FormLabel className="text-xs font-semibold">Lot No.</FormLabel>
                                    <Combobox options={lotOptions} value={field.value} onChange={field.onChange} placeholder="Select" modal={true} />
                                    <FormMessage />
                                </FormItem>
                            )} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <FormField control={form.control} name="lorryTractorNo" render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-xs font-semibold">Vehicle No.</FormLabel>
                                    <FormControl>
                                        <Input className="text-sm h-9" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="unloadingDate" render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-xs font-semibold">Date</FormLabel>
                                    <FormControl>
                                        <Input type="date" className="text-sm h-9" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                        </div>
                        <FormField control={form.control} name="bagsUnloaded" render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-xs font-semibold">Bags Unloaded</FormLabel>
                                <FormControl>
                                    <Input type="number" step="0.01" className="text-sm h-9" {...field} value={field.value ?? ''} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <div className="grid grid-cols-2 gap-4">
                            <FormField control={form.control} name="customerHamaliPerBag" render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-xs font-semibold">Cust Rate</FormLabel>
                                    <FormControl>
                                        <Input type="number" step="0.01" className="text-sm h-9" {...field} value={field.value ?? ''} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="workerHamaliPerBag" render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-xs font-semibold">Worker Rate</FormLabel>
                                    <FormControl>
                                        <Input type="number" step="0.01" className="text-sm h-9" {...field} value={field.value ?? ''} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                        </div>
                        <Separator />
                        <div className="flex justify-between text-primary font-bold text-sm">
                            <span className="text-xs uppercase text-muted-foreground tracking-wider">Total Hamali</span>
                            <span className="font-mono">{formatCurrency(totalCustomerHamali)}</span>
                        </div>
                        <div className="flex items-center space-x-2 pt-2">
                            <Checkbox id="smsU" checked={sendSmsNotification} onCheckedChange={(c) => setSendSmsNotification(Boolean(c))} disabled={!warehouseInfo?.textbeeApiKey || !selectedCustomer?.phone} />
                            <label htmlFor="smsU" className="text-xs font-medium cursor-pointer">Send SMS Notification</label>
                        </div>
                    </CardContent>
                    <CardFooter>
                        <Button type="submit" disabled={isPending} className="w-full text-sm">
                            {isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : 'Add Record & Generate Bill'}
                        </Button>
                    </CardFooter>
                </form>
            </Form>
        </Card>
    );
}
