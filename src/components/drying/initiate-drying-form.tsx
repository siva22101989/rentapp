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
import type { Customer, UnloadingRecord, Lot, StorageRecord, HamaliChargeItem, WarehouseInfo } from '@/lib/definitions';
import { doc, writeBatch, increment, collection } from 'firebase/firestore';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { formatCurrency, cleanForFirestore, toDate } from '@/lib/utils';
import { Separator } from '../ui/separator';
import { Combobox } from '../ui/combobox';
import { differenceInDays, format } from 'date-fns';

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
}

export function InitiateDryingForm({ customers, unloadingRecords, lots, storageRecords }: InitiateDryingFormProps) {
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();
    const firestore = useFirestore();

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
    
    const bagsForDrying = form.watch('bagsForDrying');
    const customerDay1HamaliRate = form.watch('customerHamaliPerBag');

    const pavHamaliPerBag = form.watch('pavHamaliPerBag') || 0;
    const cuppaHamaliPerBag = form.watch('cuppaHamaliPerBag') || 0;
    
    const startDate = form.watch('dryingStartDate');
    const endDate = form.watch('dryingEndDate');
    
    const dryingDays = useMemo(() => {
        try {
            const start = new Date(startDate);
            const end = new Date(endDate);
            if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && end >= start) {
                const days = differenceInDays(end, start) + 1;
                return days > 0 ? days : 1;
            }
        } catch (e) { /* ignore parse errors */ }
        return 1;
    }, [startDate, endDate]);

    const extraDryingDays = useMemo(() => {
        return dryingDays > 1 ? dryingDays - 1 : 0;
    }, [dryingDays]);

    const pavHamali = (Number(bagsForDrying) || 0) * (Number(pavHamaliPerBag) || 0) * extraDryingDays;
    const cuppaHamali = (Number(bagsForDrying) || 0) * (Number(cuppaHamaliPerBag) || 0) * extraDryingDays;
    
    const day1DryingHamali = (Number(bagsForDrying) || 0) * (Number(customerDay1HamaliRate) || 0);

    const proportionalUnloadingHamali = selectedUnloadingRecord 
        ? ((selectedUnloadingRecord.hamaliPerBag || 0) * (Number(bagsForDrying) || 0))
        : 0;

    const totalCustomerCharge = proportionalUnloadingHamali + day1DryingHamali + pavHamali + cuppaHamali;
    
    const workerHamaliDay1 = (Number(bagsForDrying) || 0) * (Number(form.watch('workerHamaliPerBag')) || 0);
    const totalWorkerPayable = proportionalUnloadingHamali + workerHamaliDay1 + pavHamali + cuppaHamali;
    
    const daysUntilDrying = useMemo(() => {
        if (!selectedUnloadingRecord || !startDate) return null;
        try {
            const unloadDate = toDate(selectedUnloadingRecord.unloadingDate);
            const dryStartDate = new Date(startDate);
             if (!isNaN(unloadDate.getTime()) && !isNaN(dryStartDate.getTime()) && dryStartDate >= unloadDate) {
                return differenceInDays(dryStartDate, unloadDate);
            }
        } catch(e) {/* ignore */}
        return null;
    }, [selectedUnloadingRecord, startDate]);


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


    const onSubmit = (data: DryingFormData) => {
        if (!firestore) {
            toast({ title: 'Error', description: 'Firestore not available.', variant: 'destructive' });
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

        const newStorageRecordRef = doc(collection(firestore, 'storageRecords'));
        const receiptUrl = `/inflow/receipt/${newStorageRecordRef.id}`;
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
                // Prepare new storage record
                const finalStorageDate = new Date(data.dryingEndDate);
                const bagsStored = data.bagsPacked;

                // --- Hamali Calculations and Details ---
                const hamaliDetails: HamaliChargeItem[] = [];

                const currentProportionalUnloadingHamali = (selectedRecordOnSubmit.hamaliPerBag || 0) * data.bagsForDrying;
                if (currentProportionalUnloadingHamali > 0) {
                    hamaliDetails.push({
                        description: 'Unloading Hamali',
                        bags: data.bagsForDrying,
                        rate: selectedRecordOnSubmit.hamaliPerBag || 0,
                        amount: currentProportionalUnloadingHamali
                    });
                }
                
                const dryingDay1CustomerHamali = data.bagsForDrying * data.customerHamaliPerBag;
                if (dryingDay1CustomerHamali > 0) {
                    hamaliDetails.push({
                        description: 'Drying Hamali (Day 1)',
                        bags: data.bagsForDrying,
                        rate: data.customerHamaliPerBag,
                        amount: dryingDay1CustomerHamali
                    });
                }

                const totalDryingDays = differenceInDays(new Date(data.dryingEndDate), new Date(data.dryingStartDate)) + 1;
                const extraDaysForSubmission = totalDryingDays > 1 ? totalDryingDays - 1 : 0;

                const pavHamaliAmount = data.bagsForDrying * (data.pavHamaliPerBag || 0) * extraDaysForSubmission;
                if (pavHamaliAmount > 0) {
                     hamaliDetails.push({
                        description: `Pav Hamali (${extraDaysForSubmission} extra day${extraDaysForSubmission !== 1 ? 's' : ''})`,
                        bags: data.bagsForDrying,
                        rate: data.pavHamaliPerBag || 0,
                        amount: pavHamaliAmount
                    });
                }

                const cuppaHamaliAmount = data.bagsForDrying * (data.cuppaHamaliPerBag || 0) * extraDaysForSubmission;
                if (cuppaHamaliAmount > 0) {
                    hamaliDetails.push({
                        description: `Cuppa Hamali (${extraDaysForSubmission} extra day${extraDaysForSubmission !== 1 ? 's' : ''})`,
                        bags: data.bagsForDrying,
                        rate: data.cuppaHamaliPerBag || 0,
                        amount: cuppaHamaliAmount
                    });
                }

                const totalHamali = hamaliDetails.reduce((sum, item) => sum + item.amount, 0);

                // Worker Hamali Calculation
                const dryingDay1WorkerHamali = data.bagsForDrying * data.workerHamaliPerBag;
                const totalWorkerHamali = currentProportionalUnloadingHamali + dryingDay1WorkerHamali + pavHamaliAmount + cuppaHamaliAmount;
                
                const batch = writeBatch(firestore);

                const newStorageRecord: Omit<StorageRecord, 'id'> = {
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
                    hamaliPayable: totalHamali,
                    workerHamaliPayable: totalWorkerHamali,
                    totalRentBilled: 0,
                    lorryTractorNo: selectedRecordOnSubmit?.lorryTractorNo || '',
                    weight: 0,
                    inflowType: 'Plot' as const,
                    dryingRecordId: data.unloadingRecordId,
                    khataAmount: 0,
                    dryingStartDate: new Date(data.dryingStartDate),
                    dryingEndDate: new Date(data.dryingEndDate),
                    hamaliDetails: hamaliDetails,
                };
                
                batch.set(newStorageRecordRef, cleanForFirestore(newStorageRecord));

                const unloadingRecordRef = doc(firestore, 'unloadingRecords', data.unloadingRecordId);
                batch.update(unloadingRecordRef, {
                    bagsSentToDrying: increment(data.bagsForDrying)
                });
                
                await batch.commit();
                
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
                    
                    {selectedUnloadingRecord && (
                        <>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2 text-sm pt-2">
                            <div className="flex items-center gap-2">
                                <User className="h-4 w-4 text-muted-foreground" />
                                <span>{selectedCustomer?.name || '...'}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4 text-muted-foreground" />
                                <span>{format(toDate(selectedUnloadingRecord.unloadingDate), 'dd MMM yyyy, hh:mm a')}</span>
                            </div>
                             <div className="flex items-center gap-2 col-span-2">
                                <Package className="h-4 w-4 text-muted-foreground" />
                                <span>{selectedUnloadingRecord.commodityDescription}</span>
                            </div>
                        </div>

                        <Alert variant="destructive" className="bg-secondary/30 border-secondary">
                            <Info className="h-4 w-4" />
                            <AlertTitle>Unloading Hamali</AlertTitle>
                            <AlertDescription>
                                Unloading hamali was {formatCurrency(selectedUnloadingRecord.hamaliPerBag || 0)} per bag. This will be pro-rated and added to the total.
                            </AlertDescription>
                        </Alert>
                        </>
                    )}
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
                     {(dryingDays !== null || daysUntilDrying !== null) && (
                        <div className="text-sm text-center text-muted-foreground p-2 bg-secondary rounded-md grid grid-cols-2 divide-x divide-border">
                           <div className="flex flex-col items-center">
                                <span className="font-bold text-foreground">{daysUntilDrying ?? '-'} days</span>
                                <span className="text-xs">Wait before drying</span>
                           </div>
                           <div className="flex flex-col items-center">
                               <span className="font-bold text-foreground">{dryingDays ?? '-'}</span>
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
                                    <FormLabel>Drying Hamali Rate</FormLabel>
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
                                    <FormLabel>Worker Drying Rate</FormLabel>
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
                <CardFooter>
                    <Button type="submit" disabled={isPending || !selectedUnloadingRecord} className="w-full">
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
