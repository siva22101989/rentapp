'use client';

import { useState, useEffect, useMemo, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Sparkles, MessageSquare } from 'lucide-react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase/provider';
import type { Customer, Commodity, Lot, StorageRecord, WarehouseInfo, UnloadingStatus } from '@/lib/definitions';
import { setDoc, doc, getDoc } from 'firebase/firestore';
import { cleanForFirestore } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { Combobox } from '@/components/ui/combobox';
import { Switch } from '@/components/ui/switch';
import { sendSms } from '@/lib/sms';
import { useDoc } from '@/firebase/firestore/use-doc';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { useAppUser } from '@/firebase/auth/use-user';
import { format } from 'date-fns';

const UnloadingRecordSchema = z.object({
  customerId: z.string().min(1, 'Customer is required.'),
  commodityDescription: z.string().min(1, 'Commodity is required.'),
  location: z.string().min(1, 'Lot No. is required.'),
  lorryTractorNo: z.string().optional(),
  unloadingDate: z.string().min(1, 'Date is required.'),
  bagsUnloaded: z.coerce.number().positive('Bags must be positive.'),
  customerHamaliPerBag: z.coerce.number().nonnegative('Rate must be non-negative.'),
  workerHamaliPerBag: z.coerce.number().nonnegative('Worker rate must be non-negative.').optional(),
  billNo: z.string().min(1, 'Bill No is required.'),
  totalHamaliManual: z.coerce.number().nonnegative().optional(),
  workerHamaliManual: z.coerce.number().nonnegative().optional(),
});

type UnloadingFormData = z.infer<typeof UnloadingRecordSchema>;

export function AddUnloadingRecordForm({ 
  customers, 
  commodities, 
  lots, 
  storageRecords, 
  nextBillNo 
}: { 
  customers: Customer[], 
  commodities: Commodity[], 
  lots: Lot[], 
  storageRecords: StorageRecord[], 
  nextBillNo: string 
}) {
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();
    const firestore = useFirestore();
    const appUser = useAppUser();
    const [sendSmsNotification, setSendSmsNotification] = useState(true);

    const warehouseInfoRef = useMemoFirebase(
      () => (firestore && appUser?.warehouseId ? doc(firestore, 'warehouses', appUser.warehouseId) : null),
      [firestore, appUser]
    );
    const { data: warehouseInfo } = useDoc<WarehouseInfo>(warehouseInfoRef);

    const isSmsEnabled = warehouseInfo?.smsEnabled && warehouseInfo?.textbeeApiKey;

    const form = useForm<UnloadingFormData>({
        resolver: zodResolver(UnloadingRecordSchema),
        defaultValues: {
          customerId: '',
          commodityDescription: '',
          location: '',
          lorryTractorNo: '',
          unloadingDate: new Date().toISOString().split('T')[0],
          bagsUnloaded: 0,
          customerHamaliPerBag: 0,
          workerHamaliPerBag: 0,
          billNo: String(nextBillNo).replace(/\D/g, ''),
          totalHamaliManual: 0,
          workerHamaliManual: 0,
        },
    });

    useEffect(() => {
        if (nextBillNo) {
            form.setValue('billNo', String(nextBillNo).replace(/\D/g, ''));
        }
    }, [nextBillNo, form]);
    
    const bagsVal = form.watch('bagsUnloaded');
    const custRate = form.watch('customerHamaliPerBag');
    const workRate = form.watch('workerHamaliPerBag');

    useEffect(() => {
        const b = Number(bagsVal) || 0;
        const c = Number(custRate) || 0;
        const w = Number(workRate) || c;
        form.setValue('totalHamaliManual', b * c);
        form.setValue('workerHamaliManual', b * w);
    }, [bagsVal, custRate, workRate, form]);

    const customerOptions = useMemo(() => customers.map(c => ({ value: c.id, label: c.name })), [customers]);
    
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
            label: `${lot.name} (${lotOccupancy[lot.name] || 0} bags)`
        }));
    }, [lots, lotOccupancy]);
      
    const selectedCustomerId = form.watch('customerId');
    const selectedCustomer = useMemo(() => customers.find(c => c.id === selectedCustomerId), [selectedCustomerId, customers]);

    const onSubmit = (data: UnloadingFormData) => {
        if (!firestore || !appUser?.warehouseId) {
            toast({ title: 'System Error', description: 'User or warehouse session missing.', variant: 'destructive' });
            return;
        }

        startTransition(async () => {
            try {
                const cleanBillNo = String(data.billNo).replace(/\D/g, '');
                const existingSnap = await getDoc(doc(firestore, 'unloadingRecords', cleanBillNo));
                if (existingSnap.exists()) {
                    toast({ title: 'Duplicate Bill No', description: `Bill No #${cleanBillNo} already exists.`, variant: 'destructive' });
                    return;
                }

                const finalDate = new Date(data.unloadingDate);
                
                const rawRecord = { 
                    ...data, 
                    billNo: cleanBillNo,
                    hamaliPerBag: data.customerHamaliPerBag, 
                    warehouseId: appUser.warehouseId, 
                    unloadingDate: finalDate, 
                    status: 'Unloading' as UnloadingStatus, 
                    bagsSentToDrying: 0, 
                    totalHamali: data.totalHamaliManual || 0, 
                    workerHamaliPayable: data.workerHamaliManual || 0 
                };
                
                await setDoc(doc(firestore, 'unloadingRecords', cleanBillNo), cleanForFirestore(rawRecord));

                if (sendSmsNotification && isSmsEnabled && selectedCustomer?.phone) {
                    const msg = `Dear ${selectedCustomer.name}, delivery received. Bill: ${cleanBillNo}.`;
                    sendSms({ 
                        apiKey: warehouseInfo.textbeeApiKey!, 
                        deviceId: warehouseInfo.textbeeDeviceId, 
                        to: selectedCustomer.phone, 
                        message: msg 
                    }).catch(console.error);
                }
                
                toast({ title: 'Success', description: `Record #${cleanBillNo} added.` });
                form.reset();
                window.open(`/unloading/receipt?unloadingId=${cleanBillNo}`, '_blank');
            } catch (error) {
                console.error('Submit Error:', error);
                toast({ title: 'Error', description: 'Failed to add record.', variant: 'destructive' });
            }
        });
    };

    return (
        <Card className="stylish-card">
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)}>
                    <CardHeader>
                        <CardTitle className="text-lg font-bold">New Unloading Record</CardTitle>
                        <CardDescription className="text-xs font-medium">Numeric Bill No sequence applied automatically.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <FormField control={form.control} name="billNo" render={({ field }) => (
                            <FormItem>
                                <FormLabel className="flex items-center gap-2 text-xs font-semibold">
                                    Bill No. (Numerical)
                                    <Badge variant="outline" className="text-[9px] uppercase py-0 h-4 bg-primary/5 text-primary">
                                        <Sparkles className="h-2 w-2 mr-1" /> Auto
                                    </Badge>
                                </FormLabel>
                                <FormControl>
                                    <input className="flex h-10 w-full rounded-md border border-input bg-muted/50 px-3 py-2 text-sm font-mono font-bold ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" {...field} readOnly />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        
                        <FormField control={form.control} name="customerId" render={({ field }) => (
                            <FormItem className="flex flex-col">
                                <FormLabel className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Customer</FormLabel>
                                <Combobox options={customerOptions} value={field.value} onChange={field.onChange} placeholder="Select customer..." modal={true} />
                                <FormMessage />
                            </FormItem>
                        )} />

                        <div className="grid grid-cols-2 gap-4">
                            <FormField control={form.control} name="commodityDescription" render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Product</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl>
                                            <SelectTrigger className="text-sm h-9">
                                                <SelectValue placeholder="Select" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {commodities.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="location" render={({ field }) => (
                                <FormItem className="flex flex-col">
                                    <FormLabel className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Lot No.</FormLabel>
                                    <Combobox options={lotOptions} value={field.value} onChange={field.onChange} placeholder="Select lot" modal={true} />
                                    <FormMessage />
                                </FormItem>
                            )} />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <FormField control={form.control} name="lorryTractorNo" render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Vehicle No.</FormLabel>
                                    <FormControl><Input className="text-sm h-9" placeholder="AP-21..." {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="unloadingDate" render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Date</FormLabel>
                                    <FormControl><Input type="date" className="text-sm h-9" {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                        </div>

                        <FormField control={form.control} name="bagsUnloaded" render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Bags Unloaded</FormLabel>
                                <FormControl>
                                    <Input type="number" step="0.01" className="text-sm h-9 font-bold" {...field} value={field.value ?? ''} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />

                        <div className="grid grid-cols-2 gap-4">
                            <FormField control={form.control} name="customerHamaliPerBag" render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Cust Rate</FormLabel>
                                    <FormControl><Input type="number" step="0.01" className="text-sm h-9" {...field} value={field.value ?? ''} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="workerHamaliPerBag" render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Worker Rate</FormLabel>
                                    <FormControl><Input type="number" step="0.01" className="text-sm h-9" {...field} value={field.value ?? ''} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                            <FormField control={form.control} name="totalHamaliManual" render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-[10px] font-black text-primary uppercase tracking-widest">Customer Total</FormLabel>
                                    <FormControl>
                                        <Input type="number" step="0.01" className="text-sm h-9 border-primary/40 font-mono font-bold" {...field} value={field.value ?? ''} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="workerHamaliManual" render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-[10px] font-black text-orange-600 uppercase tracking-widest">Worker Total</FormLabel>
                                    <FormControl>
                                        <Input type="number" step="0.01" className="text-sm h-9 border-orange-300 font-mono font-bold" {...field} value={field.value ?? ''} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                        </div>

                        <Separator />
                        <div className="flex items-center justify-between p-3 rounded-xl border bg-primary/5">
                            <div className="flex items-center gap-2">
                                <MessageSquare className={`h-4 w-4 ${isSmsEnabled ? 'text-primary' : 'text-slate-300'}`} />
                                <Label htmlFor="sms-toggle-un" className={`text-[10px] font-black uppercase tracking-wider cursor-pointer ${!isSmsEnabled ? 'text-slate-400' : 'text-slate-600'}`}>
                                    SMS Receipt {!isSmsEnabled ? '(Global OFF)' : ''}
                                </Label>
                            </div>
                            <Switch 
                                id="sms-toggle-un" 
                                checked={isSmsEnabled ? sendSmsNotification : false} 
                                onCheckedChange={setSendSmsNotification}
                                disabled={!isSmsEnabled || !selectedCustomer?.phone}
                            />
                        </div>
                    </CardContent>
                    <CardFooter>
                        <Button type="submit" disabled={isPending} className="w-full font-bold h-11 uppercase tracking-widest shadow-lg shadow-primary/20">
                            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Confirm & Generate Bill'}
                        </Button>
                    </CardFooter>
                </form>
            </Form>
        </Card>
    );
}