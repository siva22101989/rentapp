
'use client';

import { useTransition, useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Info, User, Package, Clock } from 'lucide-react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase';
import type { Customer, UnloadingRecord, Lot, StorageRecord } from '@/lib/definitions';
import { doc, updateDoc, increment, setDoc } from 'firebase/firestore';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { formatCurrency, cleanForFirestore, toDate } from '@/lib/utils';
import { Separator } from '../ui/separator';
import { Combobox } from '../ui/combobox';
import { differenceInDays, format } from 'date-fns';
import { useRouter } from 'next/navigation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

const InitiateDryingSchema = z.object({
  unloadingRecordId: z.string().min(1, 'An unloading bill is required.'),
  dryingStartDate: z.string().refine(val => !isNaN(Date.parse(val)), { message: "Invalid date format" }),
  dryingEndDate: z.string().refine(val => !isNaN(Date.parse(val)), { message: "Invalid date format" }),
  customerHamaliPerBag: z.coerce.number().nonnegative('Customer hamali rate must be non-negative.'),
  workerHamaliPerBag: z.coerce.number().nonnegative('Worker hamali rate must be non-negative.'),
  pavHamaliPerBag: z.coerce.number().nonnegative('Pav hamali rate must be non-negative.').optional(),
  cuppaHamaliPerBag: z.coerce.number().nonnegative('Cuppa hamali rate must be non-negative.').optional(),
  bagsForDrying: z.coerce.number().int().positive('Number of bags must be positive.'),
  bagsPacked: z.coerce.number().int().positive("Bags packed must be a positive number."),
  lotNo: z.string().min(1, 'Storage location (Lot No.) is required.'),
})
.refine(data => new Date(data.dryingEndDate) >= new Date(data.dryingStartDate), {
    message: "End date must be on or after start date.",
    path: ["dryingEndDate"],
})
.refine(data => data.bagsPacked <= data.bagsForDrying, {
    message: "Bags packed cannot be more than the bags sent for drying.",
    path: ["bagsPacked"],
});

type DryingFormData = z.infer<typeof InitiateDryingSchema>;

interface InitiateDryingFormProps {
    customers: Customer[];
    unloadingRecords: UnloadingRecord[];
    lots: Lot[];
    storageRecords: StorageRecord[];
    nextSerialNumber: string;
}

export function InitiateDryingForm({ customers, unloadingRecords, lots, storageRecords, nextSerialNumber }: InitiateDryingFormProps) {
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();
    const firestore = useFirestore();
    const router = useRouter();

    const form = useForm<DryingFormData>({
        resolver: zodResolver(InitiateDryingSchema),
        defaultValues: {
          unloadingRecordId: '',
          dryingStartDate: new Date().toISOString().split('T')[0],
          dryingEndDate: new Date().toISOString().split('T')[0],
          customerHamaliPerBag: '',
          workerHamaliPerBag: '',
          pavHamaliPerBag: '',
          cuppaHamaliPerBag: '',
          bagsForDrying: '',
          bagsPacked: '',
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
    const day1DryingHamali = (Number(bagsForDrying) || 0) * (Number(customerDay1HamaliRate) || 0);

    const pavHamaliPerBag = form.watch('pavHamaliPerBag');
    const pavHamali = (Number(bagsForDrying) || 0) * (Number(pavHamaliPerBag) || 0);

    const cuppaHamaliPerBag = form.watch('cuppaHamaliPerBag');
    const cuppaHamali = (Number(bagsForDrying) || 0) * (Number(cuppaHamaliPerBag) || 0);

    const proportionalUnloadingHamali = selectedUnloadingRecord 
        ? (selectedUnloadingRecord.hamaliPerBag * (Number(bagsForDrying) || 0))
        : 0;

    const totalCustomerCharge = proportionalUnloadingHamali + day1DryingHamali + pavHamali + cuppaHamali;
    
    const workerHamaliDay1 = (Number(bagsForDrying) || 0) * (Number(form.watch('workerHamaliPerBag')) || 0);
    const totalWorkerPayable = proportionalUnloadingHamali + workerHamaliDay1 + pavHamali + cuppaHamali;
    
    const startDate = form.watch('dryingStartDate');
    const endDate = form.watch('dryingEndDate');
    
    const dryingDays = useMemo(() => {
        try {
            const start = new Date(startDate);
            const end = new Date(endDate);
            if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && end >= start) {
                const days = differenceInDays(end, start) + 1;
                return days;
            }
        } catch (e) { /* ignore parse errors */ }
        return null;
    }, [startDate, endDate]);

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
        form.setValue('bagsForDrying', '');
        form.setValue('bagsPacked', '');
      }
      form.trigger('bagsForDrying'); 
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedUnloadingRecordId]);


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

        startTransition(async () => {
            try {
                // Prepare new storage record
                const finalStorageDate = new Date(data.dryingEndDate);
                const bagsStored = data.bagsPacked;

                // Customer Hamali Calculation
                const currentProportionalUnloadingHamali = selectedRecordOnSubmit.hamaliPerBag * data.bagsForDrying;
                const dryingDay1CustomerHamali = data.bagsForDrying * data.customerHamaliPerBag;
                const pavHamaliAmount = data.bagsForDrying * (data.pavHamaliPerBag || 0);
                const cuppaHamaliAmount = data.bagsForDrying * (data.cuppaHamaliPerBag || 0);
                const totalHamali = currentProportionalUnloadingHamali + dryingDay1CustomerHamali + pavHamaliAmount + cuppaHamaliAmount;

                // Worker Hamali Calculation
                const dryingDay1WorkerHamali = data.bagsForDrying * data.workerHamaliPerBag;
                const totalWorkerHamali = currentProportionalUnloadingHamali + dryingDay1WorkerHamali + pavHamaliAmount + cuppaHamaliAmount;

                const newStorageRecord: Omit<StorageRecord, 'id'> & { id: string } = {
                    id: nextSerialNumber,
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
                };

                const newStorageRecordRef = doc(firestore, 'storageRecords', nextSerialNumber);
                await setDoc(newStorageRecordRef, cleanForFirestore(newStorageRecord));

                // Update the original unloading record
                const unloadingRecordRef = doc(firestore, 'unloadingRecords', data.unloadingRecordId);
                await updateDoc(unloadingRecordRef, { 
                    bagsSentToDrying: increment(data.bagsForDrying)
                });

                toast({ title: 'Success', description: `Storage record ${nextSerialNumber} created from plot.` });
                form.reset();
                router.push(`/inflow/receipt/${nextSerialNumber}`);
                
            } catch (error) {
                console.error(error);
                toast({ title: 'Error', description: 'Failed to create storage record.', variant: 'destructive' });
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
                        <br/>Next Serial No: <span className="font-bold text-primary">{nextSerialNumber}</span>
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
                                Unloading hamali was {formatCurrency(selectedUnloadingRecord.hamaliPerBag)} per bag. This will be pro-rated and added to the total.
                            </AlertDescription>
                        </Alert>
                        </>
                    )}
                     <FormField
                        control={form.control}
                        name="bagsForDrying"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Bags Sent to Plot for Drying</FormLabel>
                                <FormControl><Input type="number" placeholder="0" {...field} value={field.value ?? ''} disabled={!selectedUnloadingRecord} /></FormControl>
                                {selectedUnloadingRecord && <FormDescription>This is the starting quantity for the drying process. Hamali is calculated on this amount. Remaining on Bill: {bagsRemainingOnRecord} bags</FormDescription>}
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                     <div className="grid grid-cols-2 gap-4">
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
                     <div className="grid grid-cols-2 gap-4">
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
                            <FormItem>
                                <FormLabel>Storage Location (Lot No.)</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value} disabled={!selectedUnloadingRecord}>
                                    <FormControl>
                                        <SelectTrigger><SelectValue placeholder="Select a lot" /></SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        {lots
                                            ?.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
                                            .map(lot => {
                                                const occupied = lotOccupancy[lot.name] || 0;
                                                const capacity = lot.capacity ? ` / ${lot.capacity}` : '';
                                                return (
                                                    <SelectItem key={lot.id} value={lot.name}>
                                                        {lot.name} ({occupied}{capacity} bags)
                                                    </SelectItem>
                                                )
                                        })}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
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
                                    <FormLabel>Pav Hamali Rate</FormLabel>
                                    <FormDescription className="text-xs h-8">Extra charge per bag.</FormDescription>
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
                                    <FormLabel>Cuppa Hamali Rate</FormLabel>
                                    <FormDescription className="text-xs h-8">Extra charge per bag.</FormDescription>
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
                            <span className="text-muted-foreground">Pav Hamali</span>
                            <span className="font-mono">{formatCurrency(pavHamali)}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-muted-foreground">Cuppa Hamali</span>
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
                            <span className="text-muted-foreground">Pav Hamali</span>
                            <span className="font-mono">{formatCurrency(pavHamali)}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-muted-foreground">Cuppa Hamali</span>
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
