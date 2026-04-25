'use client';

import { useTransition, useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Info, User, Package, Clock } from 'lucide-react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase/provider';
import type { Customer, UnloadingRecord, Lot, StorageRecord, HamaliChargeItem, Commodity, WarehouseInfo, SmsInfo } from '@/lib/definitions';
import { doc, writeBatch, increment, collection } from 'firebase/firestore';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { formatCurrency, cleanForFirestore, toDate } from '@/lib/utils';
import { Separator } from '../ui/separator';
import { Combobox } from '../ui/combobox';
import { differenceInDays, format } from 'date-fns';
import { useDoc } from '@/firebase/firestore/use-doc';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { useAppUser } from '@/firebase/auth/use-user';
import { sendSms } from '@/lib/sms';

const InitiateDryingSchema = z.object({
  unloadingRecordId: z.string().min(1, 'An unloading bill is required.'),
  dryingStartDate: z.string().refine(val => !isNaN(Date.parse(val)), { message: "Invalid date format" }),
  dryingEndDate: z.string().refine(val => !isNaN(Date.parse(val)), { message: "Invalid date format" }),
  customerHamaliPerBag: z.coerce.number().nonnegative('Customer hamali rate must be non-negative.'),
  workerHamaliPerBag: z.coerce.number().nonnegative('Worker hamali rate must be non-negative.'),
  pavHamaliPerBag: z.coerce.number().nonnegative('Pav hamali rate must be non-negative.').optional(),
  cuppaHamaliPerBag: z.coerce.number().nonnegative('Cuppa hamali rate must be non-negative.').optional(),
  bagsForDrying: z.coerce.number().int().positive('Bags sent to plot for drying must be positive.'),
  bagsPacked: z.coerce.number().int().positive("Bags packed must be a positive number."),
  lotNo: z.string().min(1, 'Storage location (Lot No.) is required.'),
})
.refine(data => new Date(data.dryingEndDate) >= new Date(data.dryingStartDate), {
    message: "End date must be on or after start date.",
    path: ["dryingEndDate"],
})
.refine(data => data.bagsForDrying >= data.bagsPacked, {
    message: "Bags packed cannot be more than bags plotted.",
    path: ["bagsPacked"],
});

type DryingFormData = z.infer<typeof InitiateDryingSchema>;

interface InitiateDryingFormProps {
    customers: Customer[];
    unloadingRecords: UnloadingRecord[];
    lots: Lot[];
    storageRecords: StorageRecord[];
    commodities: Commodity[];
}

export function InitiateDryingForm({ customers, unloadingRecords, lots, storageRecords, commodities }: InitiateDryingFormProps) {
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();
    const [isPartialSaving, setIsPartialSaving] = useState(false);
    const firestore = useFirestore();
    const appUser = useAppUser();
    const [sendSmsNotification, setSendSmsNotification] = useState(true);

    const warehouseInfoRef = useMemoFirebase(
      () => (firestore && appUser?.warehouseId ? doc(firestore, 'warehouses', appUser.warehouseId) : null),
      [firestore, appUser]
    );
    const { data: warehouseInfo } = useDoc<WarehouseInfo>(warehouseInfoRef);


    const form = useForm<DryingFormData>({
        resolver: zodResolver(InitiateDryingSchema),
        defaultValues: {
          unloadingRecordId: '',
          dryingStartDate: new Date().toISOString().split('T')[0],
          dryingEndDate: new Date().toISOString().split('T')[0],
          customerHamaliPerBag: 0,
          workerHamaliPerBag: 0,
          pavHamaliPerBag: 0,
          cuppaHamaliPerBag: 0,
          bagsForDrying: 0,
          bagsPacked: 0,
          lotNo: '',
        },
      });
    
    const lotOccupancy = useMemo(() => {
        const occupancy: { [lotName: string]: number } = {};
        storageRecords.forEach(record => {
            if (record.location && record.bagsStored > 0) {
                occupancy[record.location] = (occupancy[record.location] || 0) + record.bagsStored;
            }
        });
        return occupancy;
    }, [storageRecords]);

    const lotOptions = useMemo(() => {
        return lots
            .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
            .map(lot => {
                const occupied = lotOccupancy[lot.name] || 0;
                const capacity = lot.capacity ? ` / ${lot.capacity}` : '';
                return ({
                    value: lot.name,
                    label: `${lot.name} (${occupied}${capacity} bags)`
                })
            });
    }, [lots, lotOccupancy]);


    const unloadingQueueOptions = useMemo(() => {
        const customerMap = new Map(customers.map(c => [c.id, c.name]));
        return unloadingRecords
            .sort((a, b) => toDate(a.unloadingDate).getTime() - toDate(b.unloadingDate).getTime())
            .map(ur => ({
                value: ur.id,
                label: `Bill #${ur.billNo} - ${customerMap.get(ur.customerId) || 'Unknown'} - ${ur.bagsUnloaded - (ur.bagsSentToDrying || 0)} bags - ${format(toDate(ur.unloadingDate), 'dd/MM, h:mm a')}`
            }));
    }, [unloadingRecords, customers]);

    const selectedUnloadingRecordId = form.watch('unloadingRecordId');
    const selectedUnloadingRecord = useMemo(() => 
        unloadingRecords.find(ur => ur.id === selectedUnloadingRecordId)
    , [unloadingRecords, selectedUnloadingRecordId]);
    
    const selectedCustomer = useMemo(() =>
        selectedUnloadingRecord ? customers.find(c => c.id === selectedUnloadingRecord.customerId) : null
    , [customers, selectedUnloadingRecord]);

    const bagsRemainingOnRecord = selectedUnloadingRecord ? selectedUnloadingRecord.bagsUnloaded - (selectedUnloadingRecord.bagsSentToDrying || 0) : 0;
    
    const formValues = form.watch();

    const {
        proportionalUnloadingHamali,
        day1DryingHamali,
        pavHamali,
        cuppaHamali,
        totalCustomerCharge,
        workerHamaliDay1,
        totalWorkerPayable,
        extraDryingDays,
    } = useMemo(() => {
        const { bagsForDrying, customerHamaliPerBag, pavHamaliPerBag, cuppaHamaliPerBag, workerHamaliPerBag, dryingStartDate, dryingEndDate } = formValues;

        const pUnloadingHamali = selectedUnloadingRecord ? ((selectedUnloadingRecord.hamaliPerBag || 0) * (Number(bagsForDrying) || 0)) : 0;
        const d1DryingHamali = (Number(bagsForDrying) || 0) * (Number(customerHamaliPerBag) || 0);

        let extraDays = 0;
        try {
            const start = new Date(dryingStartDate);
            const end = new Date(dryingEndDate);
            if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && end >= start) {
                const days = differenceInDays(end, start);
                extraDays = days > 0 ? days : 0;
            }
        } catch (e) { /* ignore */ }

        const pavH = (Number(bagsForDrying) || 0) * (Number(pavHamaliPerBag) || 0) * extraDays;
        const cuppaH = (Number(bagsForDrying) || 0) * (Number(cuppaHamaliPerBag) || 0) * extraDays;
        
        const totalCustCharge = pUnloadingHamali + d1DryingHamali + pavH + cuppaH;

        const wHamaliDay1 = (Number(bagsForDrying) || 0) * (Number(workerHamaliPerBag) || 0);
        const totalWorkerPay = pUnloadingHamali + wHamaliDay1 + pavH + cuppaH;
        
        return {
            proportionalUnloadingHamali: pUnloadingHamali,
            day1DryingHamali: d1DryingHamali,
            pavHamali: pavH,
            cuppaHamali: cuppaH,
            totalCustomerCharge: totalCustCharge,
            workerHamaliDay1: wHamaliDay1,
            totalWorkerPayable: totalWorkerPay,
            extraDryingDays: extraDays
        };
    }, [formValues, selectedUnloadingRecord]);
    
    const daysUntilDrying = useMemo(() => {
        if (!selectedUnloadingRecord || !formValues.dryingStartDate) return null;
        try {
            const unloadDate = toDate(selectedUnloadingRecord.unloadingDate);
            const dryStartDate = new Date(formValues.dryingStartDate);
             if (!isNaN(unloadDate.getTime()) && !isNaN(dryStartDate.getTime()) && dryStartDate >= unloadDate) {
                return differenceInDays(dryStartDate, unloadDate);
            }
        } catch(e) {/* ignore */}
        return null;
    }, [selectedUnloadingRecord, formValues.dryingStartDate]);


    useEffect(() => {
        if (selectedUnloadingRecord) {
            form.setValue('bagsForDrying', bagsRemainingOnRecord);
            form.setValue('bagsPacked', bagsRemainingOnRecord); 
        } else {
            form.reset({
                ...form.getValues(),
                bagsForDrying: 0,
                bagsPacked: 0,
            });
        }
        form.trigger('bagsForDrying'); 
        form.trigger('bagsPacked'); 
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedUnloadingRecordId, form]);

    useEffect(() => {
        const selectedRecordExists = unloadingRecords.some(ur => ur.id === selectedUnloadingRecordId);
        if (selectedUnloadingRecordId && !selectedRecordExists) {
            form.reset({
                unloadingRecordId: '',
                dryingStartDate: new Date().toISOString().split('T')[0],
                dryingEndDate: new Date().toISOString().split('T')[0],
                customerHamaliPerBag: 0,
                workerHamaliPerBag: 0,
                pavHamaliPerBag: 0,
                cuppaHamaliPerBag: 0,
                bagsForDrying: 0,
                bagsPacked: 0,
                lotNo: '',
            });
            toast({ title: "Record List Updated", description: "The selected unloading record was modified. Please select another." });
        }
    }, [unloadingRecords, selectedUnloadingRecordId, form, toast]);

    const nextId = useMemo(() => {
        if (!storageRecords) return '1';
        const maxId = storageRecords.reduce((max, r) => {
            const idNum = parseInt(r.id.replace(/[^0-9]/g, ''), 10);
            return isNaN(idNum) ? max : Math.max(max, idNum);
        }, 0);
        return (maxId + 1).toString();
    }, [storageRecords]);

    const handlePartialSave = async () => {
        if (!firestore || !appUser?.warehouseId) {
            toast({ title: 'Error', description: 'Could not save: user or warehouse context is missing.', variant: 'destructive' });
            return;
        }

        const data = form.getValues();
        const validationResult = await form.trigger(["unloadingRecordId", "dryingStartDate", "bagsForDrying"]);
        if (!validationResult) {
            toast({ title: "Missing Information", description: "Please select an unloading bill and specify bags for drying.", variant: "destructive" });
            return;
        }

        const selectedRecordOnSubmit = unloadingRecords.find(ur => ur.id === data.unloadingRecordId);
        if (!selectedRecordOnSubmit) {
            toast({ title: 'Error', description: 'Selected unloading record not found.', variant: 'destructive' });
            return;
        }

        const bagsStillAvailable = selectedRecordOnSubmit.bagsUnloaded - (selectedRecordOnSubmit.bagsSentToDrying || 0);
        if (data.bagsForDrying > bagsStillAvailable) {
            form.setError('bagsForDrying', { message: `Cannot exceed available bags (${bagsStillAvailable}).` });
            return;
        }

        setIsPartialSaving(true);
        try {
            const { bagsForDrying, customerHamaliPerBag, workerHamaliPerBag, pavHamaliPerBag, cuppaHamaliPerBag, dryingStartDate, dryingEndDate } = data;
            
            const hamaliDetails: HamaliChargeItem[] = [];

            const currentProportionalUnloadingHamali = (selectedRecordOnSubmit.hamaliPerBag || 0) * bagsForDrying;
            if (currentProportionalUnloadingHamali > 0) {
                hamaliDetails.push({ description: 'Unloading Hamali', bags: bagsForDrying, rate: selectedRecordOnSubmit.hamaliPerBag || 0, amount: currentProportionalUnloadingHamali });
            }
            
            const day1DryingCustomerHamali = bagsForDrying * (customerHamaliPerBag || 0);
            if (day1DryingCustomerHamali > 0) {
                hamaliDetails.push({ description: 'Customer Hamali', bags: bagsForDrying, rate: customerHamaliPerBag || 0, amount: day1DryingCustomerHamali });
            }
            
            let extraDaysForSave = 0;
            try {
                const start = new Date(dryingStartDate);
                const end = new Date(dryingEndDate);
                if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && end >= start) {
                    const days = differenceInDays(end, start);
                    extraDaysForSave = days > 0 ? days : 0;
                }
            } catch (e) {/* ignore */}

            const pavHamaliAmount = bagsForDrying * (pavHamaliPerBag || 0) * extraDaysForSave;
            if (pavHamaliAmount > 0) {
                 hamaliDetails.push({ description: `Pav Hamali (${extraDaysForSave} extra day${extraDaysForSave !== 1 ? 's' : ''})`, bags: bagsForDrying, rate: pavHamaliPerBag || 0, amount: pavHamaliAmount });
            }
            const cuppaHamaliAmount = bagsForDrying * (cuppaHamaliPerBag || 0) * extraDaysForSave;
            if (cuppaHamaliAmount > 0) {
                hamaliDetails.push({ description: `Cuppa Hamali (${extraDaysForSave} extra day${extraDaysForSave !== 1 ? 's' : ''})`, bags: bagsForDrying, rate: cuppaHamaliPerBag || 0, amount: cuppaHamaliAmount });
            }

            const totalCustomerChargeForSave = hamaliDetails.reduce((sum, item) => sum + item.amount, 0);

            const day1DryingWorkerHamali = bagsForDrying * (workerHamaliPerBag || 0);
            const totalWorkerPayableForSave = currentProportionalUnloadingHamali + day1DryingWorkerHamali + pavHamaliAmount + cuppaHamaliAmount;

            const newDryingRecordData = {
                warehouseId: appUser.warehouseId,
                unloadingRecordId: data.unloadingRecordId,
                customerId: selectedRecordOnSubmit.customerId,
                commodityDescription: selectedRecordOnSubmit.commodityDescription,
                bagsForDrying: data.bagsForDrying,
                bagsPacked: data.bagsPacked,
                status: 'Drying' as const,
                dryingStartDate: new Date(data.dryingStartDate),
                packingDate: data.dryingEndDate ? new Date(data.dryingEndDate) : null,
                hamaliDetails,
                totalDryingHamali: totalCustomerChargeForSave,
                workerHamaliPayable: totalWorkerPayableForSave,
            };

            const batch = writeBatch(firestore);
            const newDryingRecordRef = doc(collection(firestore, 'dryingRecords'));
            batch.set(newDryingRecordRef, cleanForFirestore(newDryingRecordData));
            
            const unloadingRecordRef = doc(firestore, 'unloadingRecords', data.unloadingRecordId);
            batch.update(unloadingRecordRef, {
                bagsSentToDrying: increment(data.bagsForDrying)
            });
            
            await batch.commit();

            toast({
                title: "Partial Save Successful",
                description: `${data.bagsForDrying} bags have been moved to the drying plot. You can manage this process from the history table.`
            });

            form.reset();

        } catch (error) {
            console.error(error);
            toast({ title: 'Error', description: 'Failed to perform partial save.', variant: 'destructive' });
        } finally {
            setIsPartialSaving(false);
        }
    };


    const onSubmit = (data: DryingFormData) => {
        if (!firestore || !appUser?.warehouseId) {
            toast({ title: 'Error', description: 'Could not create record: user or warehouse context is missing.', variant: 'destructive' });
            return;
        }

        const selectedRecordOnSubmit = unloadingRecords.find(ur => ur.id === data.unloadingRecordId);
        if (!selectedRecordOnSubmit) {
            toast({ title: 'Error', description: 'Selected unloading record not found.', variant: 'destructive' });
            return;
        }
        
        const bagsStillAvailable = selectedRecordOnSubmit.bagsUnloaded - (selectedRecordOnSubmit.bagsSentToDrying || 0);
        if (data.bagsForDrying > bagsStillAvailable) {
          form.setError('bagsForDrying', { message: `Cannot exceed available bags (${bagsStillAvailable}).`});
          return;
        }

        const receiptUrl = `/inflow/receipt/${nextId}`;
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
                const commodityDetails = commodities.find(c => c.name === selectedRecordOnSubmit.commodityDescription);
                if (!commodityDetails) {
                    toast({ title: 'Error', description: `Commodity details for "${selectedRecordOnSubmit.commodityDescription}" not found. Please ensure it is set up in settings.`, variant: 'destructive' });
                    if (receiptWindow) receiptWindow.close();
                    return;
                }
                
                const finalStorageDate = new Date(data.dryingEndDate);
                const bagsStored = data.bagsPacked;

                const hamaliDetails: HamaliChargeItem[] = [];

                if (proportionalUnloadingHamali > 0) {
                    hamaliDetails.push({ description: 'Unloading Hamali', bags: data.bagsForDrying, rate: selectedRecordOnSubmit.hamaliPerBag || 0, amount: proportionalUnloadingHamali });
                }
                if (day1DryingHamali > 0) {
                    hamaliDetails.push({ description: 'Customer Hamali', bags: data.bagsForDrying, rate: data.customerHamaliPerBag, amount: day1DryingHamali });
                }
                if (pavHamali > 0) {
                     hamaliDetails.push({ description: `Pav Hamali (${extraDryingDays} extra day${extraDryingDays !== 1 ? 's' : ''})`, bags: data.bagsForDrying, rate: data.pavHamaliPerBag || 0, amount: pavHamali });
                }
                if (cuppaHamali > 0) {
                    hamaliDetails.push({ description: `Cuppa Hamali (${extraDryingDays} extra day${extraDryingDays !== 1 ? 's' : ''})`, bags: data.bagsForDrying, rate: data.cuppaHamaliPerBag || 0, amount: cuppaHamali });
                }
                
                const batch = writeBatch(firestore);

                const newStorageRecord: Omit<StorageRecord, 'id'> = {
                    warehouseId: appUser.warehouseId,
                    customerId: selectedRecordOnSubmit.customerId,
                    commodityDescription: selectedRecordOnSubmit.commodityDescription,
                    location: data.lotNo,
                    bagsIn: bagsStored,
                    bagsForDrying: data.bagsForDrying,
                    bagsOut: 0,
                    bagsStored: bagsStored,
                    storageStartDate: finalStorageDate,
                    storageEndDate: null,
                    billingCycle: '6-Month Initial' as const,
                    payments: [],
                    hamaliPayable: totalCustomerCharge,
                    workerHamaliPayable: totalWorkerPayable,
                    totalRentBilled: 0,
                    lorryTractorNo: selectedRecordOnSubmit?.lorryTractorNo || '',
                    weight: 0,
                    inflowType: 'Plot' as const,
                    dryingRecordId: data.unloadingRecordId,
                    khataAmount: 0,
                    dryingStartDate: new Date(data.dryingStartDate),
                    dryingEndDate: new Date(data.dryingEndDate),
                    hamaliDetails: hamaliDetails,
                    billingType: commodityDetails.billingType,
                    monthlyRate: commodityDetails.monthlyRate,
                    minBillingMonths: commodityDetails.minBillingMonths,
                    insuranceRate: commodityDetails.insuranceRate,
                    rate6Months: commodityDetails.rate6Months,
                    rate1Year: commodityDetails.rate1Year,
                };
                
                const newStorageRecordRef = doc(firestore, 'storageRecords', nextId);
                batch.set(newStorageRecordRef, cleanForFirestore(newStorageRecord));

                const unloadingRecordRef = doc(firestore, 'unloadingRecords', data.unloadingRecordId);
                batch.update(unloadingRecordRef, {
                    bagsSentToDrying: increment(data.bagsForDrying)
                });
                
                await batch.commit();
                
                if (sendSmsNotification && warehouseInfo?.textbeeApiKey && selectedCustomer?.phone) {
                    const defaultTemplate = 'Dear {customerName}, from your unloading of {unloadingBags} bags (Bill #{unloadingBillNo}), {bagsForDrying} bags were plotted for drying and {bagsPacked} bags of {commodity} have been recorded as inflow on {date}.\nBill No: {newBillNo}.\nHamali: {hamaliAmount}. Location: {location}. Thank you. - {warehouseName},Owk';
                    const template = warehouseInfo?.smsInflowTemplate || defaultTemplate;

                    const message = template
                        .replace('{customerName}', selectedCustomer.name)
                        .replace('{unloadingBags}', String(selectedRecordOnSubmit.bagsUnloaded))
                        .replace('{unloadingBillNo}', selectedRecordOnSubmit.billNo || 'N/A')
                        .replace('{bagsForDrying}', String(data.bagsForDrying))
                        .replace('{bagsPacked}', String(data.bagsPacked))
                        .replace('{commodity}', selectedRecordOnSubmit.commodityDescription)
                        .replace('{date}', format(finalStorageDate, 'dd MMM yyyy'))
                        .replace('{newBillNo}', nextId)
                        .replace('{hamaliAmount}', formatCurrency(totalCustomerCharge))
                        .replace('{location}', data.lotNo)
                        .replace('{warehouseName}', warehouseInfo?.name || 'GrainDost');

                    sendSms({
                        apiKey: warehouseInfo.textbeeApiKey,
                        deviceId: warehouseInfo.textbeeDeviceId,
                        to: selectedCustomer.phone,
                        message: message,
                    }).catch(console.error);
                }
                
                toast({ title: 'Success', description: `Storage record created from plot.` });

                form.reset();
                
            } catch (error) {
                console.error(error);
                toast({ title: 'Error', description: 'Failed to create storage record.', variant: 'destructive' });
                if (receiptWindow) receiptWindow.close();
            }
        });
    };

  return (
    <Card>
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
                <CardHeader>
                    <CardTitle>Finalize Drying & Create Storage Record</CardTitle>
                    <CardDescription>
                        Select an item from the unloading queue. This will create a new storage record.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <FormField
                        control={form.control}
                        name="unloadingRecordId"
                        render={({ field }) => (
                            <FormItem className="flex flex-col">
                                <FormLabel>Unloading Queue (Oldest First)</FormLabel>
                                <Combobox
                                    options={unloadingQueueOptions}
                                    value={field.value}
                                    onChange={(value) => {
                                        form.setValue('unloadingRecordId', value, { shouldValidate: true });
                                    }}
                                    placeholder="Select an unloading bill..."
                                    searchPlaceholder="Search by bill, customer..."
                                    emptyPlaceholder="No items in queue."
                                />
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    
                    {selectedUnloadingRecord && selectedCustomer && (
                        <div className="text-sm text-muted-foreground p-3 border rounded-md bg-secondary/50 space-y-1">
                            <div className="flex justify-between items-center">
                                <p className="font-bold text-foreground">{selectedCustomer.name}</p>
                                <p>Bill #{selectedUnloadingRecord.billNo}</p>
                            </div>
                            <p><strong>Father's Name:</strong> {selectedCustomer.fatherName || 'N/A'}</p>
                            <p><strong>Village:</strong> {selectedCustomer.village || 'N/A'}</p>
                            <Separator className="my-2"/>
                            <p><strong>Commodity:</strong> {selectedUnloadingRecord.commodityDescription}</p>
                            <p><strong>Unloaded:</strong> {format(toDate(selectedUnloadingRecord.unloadingDate), 'dd MMM yyyy, hh:mm a')}</p>
                        </div>
                    )}

                        <Alert variant="destructive" className="bg-secondary/30 border-secondary">
                            <Info className="h-4 w-4" />
                            <AlertTitle>Unloading Hamali</AlertTitle>
                            <AlertDescription>
                                Unloading hamali was {formatCurrency(selectedUnloadingRecord?.hamaliPerBag || 0)} per bag. This will be pro-rated and added to the total.
                            </AlertDescription>
                        </Alert>
                     <FormField
                        control={form.control}
                        name="bagsForDrying"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Bags Plotted for Drying</FormLabel>
                                <FormControl><Input type="number" placeholder="0" {...field} value={field.value ?? ''} disabled={!selectedUnloadingRecord} /></FormControl>
                                <FormDescription>This is the starting quantity for the drying process. Hamali is calculated on this amount. Remaining on Bill: {bagsRemainingOnRecord} bags</FormDescription>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <FormField
                            control={form.control}
                            name="dryingStartDate"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Drying Start Date</FormLabel>
                                    <FormControl><Input type="date" {...field} disabled={!selectedUnloadingRecord} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                         <FormField
                            control={form.control}
                            name="dryingEndDate"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Drying End Date (Storage Date)</FormLabel>
                                    <FormControl><Input type="date" {...field} disabled={!selectedUnloadingRecord} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>
                     {(daysUntilDrying !== null || formValues.dryingEndDate) && (
                        <div className="text-sm text-center text-muted-foreground p-2 bg-secondary rounded-md grid grid-cols-2 divide-x divide-border">
                           <div className="flex flex-col items-center">
                                <span className="font-bold text-foreground">{daysUntilDrying ?? '-'} days</span>
                                <span className="text-xs">Wait before drying</span>
                           </div>
                           <div className="flex flex-col items-center">
                               <span className="font-bold text-foreground">{differenceInDays(new Date(formValues.dryingEndDate), new Date(formValues.dryingStartDate)) + 1 || '-'}</span>
                               <span className="text-xs">Total drying days</span>
                           </div>
                        </div>
                    )}
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <FormField
                            control={form.control}
                            name="bagsPacked"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Bags Packed (Final)</FormLabel>
                                    <FormControl><Input type="number" placeholder="0" {...field} value={field.value ?? ''} disabled={!selectedUnloadingRecord}/></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="lotNo"
                            render={({ field }) => (
                            <FormItem className="flex flex-col">
                                <FormLabel>Storage Location (Lot No.)</FormLabel>
                                 <Combobox
                                    options={lotOptions || []}
                                    value={field.value}
                                    onChange={field.onChange}
                                    placeholder="Select a lot..."
                                    searchPlaceholder="Search lots..."
                                    emptyPlaceholder="No lots found."
                                    disabled={!selectedUnloadingRecord}
                                />
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                            control={form.control}
                            name="customerHamaliPerBag"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Customer Hamali Rate</FormLabel>
                                    <FormDescription className="text-xs h-8">Charge per bag (Day 1).</FormDescription>
                                    <FormControl><Input type="number" step="0.01" placeholder="0.00" {...field} value={field.value ?? ''} disabled={!selectedUnloadingRecord} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                         <FormField
                            control={form.control}
                            name="workerHamaliPerBag"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Hamali Drying Rate</FormLabel>
                                    <FormDescription className="text-xs h-8">Payment per bag (Day 1).</FormDescription>
                                    <FormControl><Input type="number" step="0.01" placeholder="0.00" {...field} value={field.value ?? ''} disabled={!selectedUnloadingRecord} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                         <FormField
                            control={form.control}
                            name="pavHamaliPerBag"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Pav Hamali Rate (per day)</FormLabel>
                                    <FormDescription className="text-xs h-8">Extra charge per bag per day.</FormDescription>
                                    <FormControl><Input type="number" step="0.01" placeholder="0.00" {...field} value={field.value ?? ''} disabled={!selectedUnloadingRecord} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                         <FormField
                            control={form.control}
                            name="cuppaHamaliPerBag"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Cuppa Hamali Rate (per day)</FormLabel>
                                    <FormDescription className="text-xs h-8">Extra charge per bag per day.</FormDescription>
                                    <FormControl><Input type="number" step="0.01" placeholder="0.00" {...field} value={field.value ?? ''} disabled={!selectedUnloadingRecord} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>

                    <Separator />

                    <div className="space-y-2">
                        <h4 className="font-medium">Total Hamali for Customer</h4>
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-muted-foreground">Pro-rated Unloading Hamali</span>
                            <span className="font-mono">{formatCurrency(proportionalUnloadingHamali)}</span>
                        </div>
                         <div className="flex justify-between items-center text-sm">
                            <span className="text-muted-foreground">Drying Hamali (Day 1)</span>
                            <span className="font-mono">{formatCurrency(day1DryingHamali)}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-muted-foreground">Pav Hamali ({extraDryingDays} extra day{extraDryingDays !== 1 ? 's' : ''})</span>
                            <span className="font-mono">{formatCurrency(pavHamali)}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-muted-foreground">Cuppa Hamali ({extraDryingDays} extra day{extraDryingDays !== 1 ? 's' : ''})</span>
                            <span className="font-mono">{formatCurrency(cuppaHamali)}</span>
                        </div>
                        <Separator />
                        <div className="flex justify-between items-center font-semibold">
                            <span>Total Hamali Payable (Customer)</span>
                            <span className="font-mono">{formatCurrency(totalCustomerCharge)}</span>
                        </div>
                    </div>
                     <Separator className="my-4"/>
                    <div className="space-y-2">
                        <h4 className="font-medium">Total Hamali for Worker</h4>
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-muted-foreground">Pro-rated Unloading Hamali</span>
                            <span className="font-mono">{formatCurrency(proportionalUnloadingHamali)}</span>
                        </div>
                         <div className="flex justify-between items-center text-sm">
                            <span className="text-muted-foreground">Drying Hamali (Day 1)</span>
                            <span className="font-mono">{formatCurrency(workerHamaliDay1)}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-muted-foreground">Pav Hamali ({extraDryingDays} extra day{extraDryingDays !== 1 ? 's' : ''})</span>
                            <span className="font-mono">{formatCurrency(pavHamali)}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-muted-foreground">Cuppa Hamali ({extraDryingDays} extra day{extraDryingDays !== 1 ? 's' : ''})</span>
                            <span className="font-mono">{formatCurrency(cuppaHamali)}</span>
                        </div>
                        <Separator />
                        <div className="flex justify-between items-center font-semibold">
                            <span>Total Hamali Payable (Worker)</span>
                            <span className="font-mono">{formatCurrency(totalWorkerPayable)}</span>
                        </div>
                    </div>
                </CardContent>
                <CardFooter className="flex flex-col sm:flex-row gap-2">
                     <Button
                        type="button"
                        variant="secondary"
                        onClick={handlePartialSave}
                        disabled={isPending || isPartialSaving || !selectedUnloadingRecord}
                        className="w-full"
                    >
                        {isPartialSaving ? (
                            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>
                        ) : (
                            'Partial Save (Start Drying)'
                        )}
                    </Button>
                    <Button type="submit" disabled={isPending || isPartialSaving || !selectedUnloadingRecord} className="w-full">
                        {isPending ? (
                            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating Record...</>
                        ) : (
                            'Create Storage Record'
                        )}
                    </Button>
                </CardFooter>
            </form>
        </Form>
    </Card>
  );
}
