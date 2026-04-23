
'use client';

import { useState, useEffect, useMemo, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase/provider';
import type { Customer, Commodity, UnloadingRecord, WarehouseInfo, SmsInfo } from '@/lib/definitions';
import { setDoc, doc } from 'firebase/firestore';
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
  lorryTractorNo: z.string().optional(),
  unloadingDate: z.string().refine(val => !isNaN(Date.parse(val)), { message: "Invalid date format" }),
  bagsUnloaded: z.coerce.number().int().positive('Number of bags must be positive.'),
  hamaliPerBag: z.coerce.number().nonnegative('Hamali rate must be non-negative.'),
  billNo: z.string(),
});

type UnloadingFormData = z.infer<typeof UnloadingRecordSchema>;

const getLocalDateTimeForInput = () => {
    const now = new Date();
    const timezoneOffsetInMs = now.getTimezoneOffset() * 60000;
    const localDate = new Date(now.getTime() - timezoneOffsetInMs);
    return localDate.toISOString().slice(0, 16);
};


export function AddUnloadingRecordForm({ customers, commodities, nextBillNo }: { customers: Customer[], commodities: Commodity[], nextBillNo: string }) {
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();
    const firestore = useFirestore();
    const appUser = useAppUser();
    const [sendSmsNotification, setSendSmsNotification] = useState(true);

    const smsInfoRef = useMemoFirebase(() => (firestore && appUser ? doc(firestore, 'settings', 'sms') : null), [firestore, appUser]);
    const { data: smsInfo } = useDoc<SmsInfo>(smsInfoRef);

    const warehouseInfoRef = useMemoFirebase(() => (firestore && appUser ? doc(firestore, 'settings', 'main') : null), [firestore, appUser]);
    const { data: warehouseInfo } = useDoc<WarehouseInfo>(warehouseInfoRef);

    const form = useForm<UnloadingFormData>({
        resolver: zodResolver(UnloadingRecordSchema),
        defaultValues: {
          customerId: '',
          commodityDescription: '',
          lorryTractorNo: '',
          unloadingDate: getLocalDateTimeForInput(),
          bagsUnloaded: undefined,
          hamaliPerBag: undefined,
          billNo: nextBillNo,
        },
      });

    useEffect(() => {
        form.setValue('billNo', nextBillNo);
    }, [nextBillNo, form]);
    
    const customerOptions = customers.map(c => ({ value: c.id, label: c.name }));
      
    const bagsUnloaded = form.watch('bagsUnloaded');
    const hamaliPerBag = form.watch('hamaliPerBag');
    const totalHamali = (Number(bagsUnloaded) || 0) * (Number(hamaliPerBag) || 0);

    const selectedCustomerId = form.watch('customerId');
    const selectedCustomer = useMemo(() => {
        return customers.find(c => c.id === selectedCustomerId);
    }, [selectedCustomerId, customers]);

    const onSubmit = async (data: UnloadingFormData) => {
        if (!firestore) {
            toast({ title: 'Error', description: 'Firestore not available.', variant: 'destructive' });
            return;
        }
        
        const receiptUrl = `/unloading/receipt/${data.billNo}`;
        const receiptWindow = window.open(receiptUrl, '_blank');
        if (!receiptWindow) {
            toast({
                title: "Popup Blocked",
                description: "Please allow popups for this site to view receipts.",
                variant: "destructive",
            });
            return;
        }
        
        startTransition(async () => {
            try {
                const totalHamali = data.bagsUnloaded * data.hamaliPerBag;
                const unloadingDate = new Date(data.unloadingDate);
                const rawRecord = {
                    ...data,
                    unloadingDate,
                    status: 'Unloading' as const,
                    bagsSentToDrying: 0,
                    totalHamali,
                    workerHamaliPayable: totalHamali,
                };
                const docRef = doc(firestore, 'unloadingRecords', data.billNo);
                await setDoc(docRef, cleanForFirestore(rawRecord));

                if (sendSmsNotification && smsInfo?.textbeeApiKey && selectedCustomer?.phone) {
                    const defaultTemplate = `Dear {customerName}, we have received your delivery of {bags} bags of {commodity} for unloading on {date}. Bill No: {billNo}. Thank you. - {warehouseName}`;
                    const template = warehouseInfo?.smsUnloadingTemplate || defaultTemplate;
                    
                    const message = template
                        .replace('{customerName}', selectedCustomer.name)
                        .replace('{bags}', String(data.bagsUnloaded))
                        .replace('{commodity}', data.commodityDescription)
                        .replace('{billNo}', data.billNo)
                        .replace('{date}', format(unloadingDate, 'dd/MM/yy'))
                        .replace('{warehouseName}', warehouseInfo?.name || 'GrainDost');

                    sendSms({
                        apiKey: smsInfo.textbeeApiKey,
                        deviceId: smsInfo.textbeeDeviceId,
                        to: selectedCustomer.phone,
                        message,
                    }).catch(console.error);
                }
                
                toast({ title: 'Success', description: 'Unloading record added.' });
                
                form.reset({
                    ...form.getValues(),
                    customerId: '',
                    commodityDescription: '',
                    lorryTractorNo: '',
                    unloadingDate: getLocalDateTimeForInput(),
                    bagsUnloaded: undefined,
                    hamaliPerBag: undefined,
                });
            } catch (error) {
                console.error(error);
                toast({ title: 'Error', description: 'Failed to add unloading record.', variant: 'destructive' });
                if (receiptWindow) receiptWindow.close();
            }
        });
    };

  return (
    <Card>
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
                <CardHeader>
                    <CardTitle>Add New Unloading Record</CardTitle>
                    <CardDescription>Enter details for a new vehicle unloading.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <FormField
                        control={form.control}
                        name="billNo"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Bill No.</FormLabel>
                                <FormControl><Input readOnly disabled {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
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

                    {selectedCustomer && (
                        <div className="text-sm text-muted-foreground p-3 border rounded-md bg-secondary/50 space-y-1 -mt-2">
                            <p><strong>Father's Name:</strong> {selectedCustomer.fatherName || 'N/A'}</p>
                            <p><strong>Village:</strong> {selectedCustomer.village || 'N/A'}</p>
                            <p><strong>Phone:</strong> {selectedCustomer.phone}</p>
                        </div>
                    )}

                    <FormField
                        control={form.control}
                        name="commodityDescription"
                        render={({ field }) => (
                             <FormItem>
                                <FormLabel>Commodity</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select a commodity" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        {commodities.map(commodity => (
                                            <SelectItem key={commodity.id} value={commodity.name}>
                                                {commodity.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="lorryTractorNo"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Lorry / Tractor No. <span className="text-muted-foreground">(Optional)</span></FormLabel>
                                <FormControl><Input placeholder="e.g., AP 21 1234" {...field} value={field.value ?? ''} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                     <FormField
                        control={form.control}
                        name="unloadingDate"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Unloading Date & Time</FormLabel>
                                <FormControl><Input type="datetime-local" {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                            control={form.control}
                            name="bagsUnloaded"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Bags Unloaded</FormLabel>
                                    <FormControl><Input type="number" placeholder="0" {...field} value={field.value ?? ''} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="hamaliPerBag"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Hamali per Bag</FormLabel>
                                    <FormControl><Input type="number" step="0.01" placeholder="0.00" {...field} value={field.value ?? ''} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>
                     <Separator />
                     <div className="space-y-2">
                        <h4 className="font-medium">Summary</h4>
                        <div className="flex justify-between items-center text-sm font-semibold">
                            <span>Total Unloading Hamali</span>
                            <span className="font-mono">{formatCurrency(totalHamali)}</span>
                        </div>
                         <p className="text-xs text-muted-foreground">This amount will be charged to the customer and is payable to the worker.</p>
                    </div>

                     <div className="flex items-center space-x-2 pt-4">
                        <Checkbox 
                            id="sendSmsUnloading" 
                            checked={sendSmsNotification}
                            onCheckedChange={(checked) => setSendSmsNotification(Boolean(checked))}
                            disabled={!smsInfo?.textbeeApiKey || !selectedCustomer?.phone}
                        />
                        <label
                            htmlFor="sendSmsUnloading"
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                            Send SMS Notification to Customer
                        </label>
                    </div>

                </CardContent>
                <CardFooter>
                    <Button type="submit" disabled={isPending} className="w-full">
                        {isPending ? (
                            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>
                        ) : (
                            'Add Record & Generate Bill'
                        )}
                    </Button>
                </CardFooter>
            </form>
        </Form>
    </Card>
  );
}
