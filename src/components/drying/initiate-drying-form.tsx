'use client';

import { useTransition, useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Info } from 'lucide-react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase';
import type { Customer, UnloadingRecord, HamaliCharge } from '@/lib/definitions';
import { addDoc, collection, doc, updateDoc, increment } from 'firebase/firestore';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { formatCurrency, cleanForFirestore } from '@/lib/utils';
import { Separator } from '../ui/separator';
import { Combobox } from '../ui/combobox';
import { differenceInDays } from 'date-fns';

const InitiateDryingSchema = z.object({
  customerId: z.string().min(1, 'Customer is required.'),
  unloadingRecordId: z.string().min(1, 'Unloading bill is required.'),
  dryingStartDate: z.string().refine(val => !isNaN(Date.parse(val)), { message: "Invalid date format" }),
  dryingEndDate: z.string().refine(val => !isNaN(Date.parse(val)), { message: "Invalid date format" }),
  customerHamaliPerBag: z.coerce.number().nonnegative('Customer hamali rate must be non-negative.'),
  workerHamaliPerBag: z.coerce.number().nonnegative('Worker hamali rate must be non-negative.'),
  pavHamaliPerBag: z.coerce.number().nonnegative('Pav hamali rate must be non-negative.').optional(),
  cuppaHamaliPerBag: z.coerce.number().nonnegative('Cuppa hamali rate must be non-negative.').optional(),
  bagsForDrying: z.coerce.number().int().positive('Number of bags must be positive.'),
  bagsPacked: z.coerce.number().int().nonnegative("Bags packed must be a non-negative number."),
}).refine(data => new Date(data.dryingEndDate) >= new Date(data.dryingStartDate), {
    message: "End date must be on or after start date.",
    path: ["dryingEndDate"],
});

type DryingFormData = z.infer<typeof InitiateDryingSchema>;

interface InitiateDryingFormProps {
    customers: Customer[];
    unloadingRecords: UnloadingRecord[];
    onCustomerChange: (customerId: string | null) => void;
}

export function InitiateDryingForm({ customers, unloadingRecords, onCustomerChange }: InitiateDryingFormProps) {
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();
    const firestore = useFirestore();

    const form = useForm<DryingFormData>({
        resolver: zodResolver(InitiateDryingSchema),
        defaultValues: {
          customerId: '',
          unloadingRecordId: '',
          dryingStartDate: new Date().toISOString().split('T')[0],
          dryingEndDate: new Date().toISOString().split('T')[0],
          customerHamaliPerBag: undefined,
          workerHamaliPerBag: undefined,
          pavHamaliPerBag: undefined,
          cuppaHamaliPerBag: undefined,
          bagsForDrying: undefined,
          bagsPacked: undefined,
        },
      });
    
    const customerOptions = customers.map(c => ({ value: c.id, label: c.name }));

    const selectedCustomerId = form.watch('customerId');
    const customerUnloadingRecords = unloadingRecords.filter(ur => ur.customerId === selectedCustomerId);

    useEffect(() => {
        form.reset({
            ...form.getValues(),
            customerId: selectedCustomerId,
            unloadingRecordId: '',
        });
        onCustomerChange(selectedCustomerId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedCustomerId]);

    const selectedUnloadingRecordId = form.watch('unloadingRecordId');
    const selectedUnloadingRecord = unloadingRecords.find(ur => ur.id === selectedUnloadingRecordId);
    const bagsRemainingOnRecord = selectedUnloadingRecord ? selectedUnloadingRecord.bagsUnloaded - (selectedUnloadingRecord.bagsSentToDrying || 0) : 0;
    
    const bagsForDrying = form.watch('bagsForDrying');
    const customerDay1HamaliRate = form.watch('customerHamaliPerBag');
    const day1DryingHamali = (bagsForDrying || 0) * (customerDay1HamaliRate || 0);

    const workerHamaliPerBag = form.watch('workerHamaliPerBag');
    const day1DryingWorkerHamali = (bagsForDrying || 0) * (workerHamaliPerBag || 0);

    const pavHamaliPerBag = form.watch('pavHamaliPerBag');
    const pavHamali = (bagsForDrying || 0) * (pavHamaliPerBag || 0);

    const cuppaHamaliPerBag = form.watch('cuppaHamaliPerBag');
    const cuppaHamali = (bagsForDrying || 0) * (cuppaHamaliPerBag || 0);

    const proportionalUnloadingHamali = selectedUnloadingRecord 
        ? (selectedUnloadingRecord.hamaliPerBag * (bagsForDrying || 0))
        : 0;

    const totalCustomerCharge = proportionalUnloadingHamali + day1DryingHamali + pavHamali + cuppaHamali;
    const totalHamaliCharge = proportionalUnloadingHamali + day1DryingWorkerHamali + pavHamali + cuppaHamali;
    
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


    useEffect(() => {
      if (selectedUnloadingRecord) {
        // Default to drying the remaining bags
        form.setValue('bagsForDrying', bagsRemainingOnRecord);
      } else {
        form.setValue('bagsForDrying', undefined);
      }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedUnloadingRecord]);


    const onSubmit = (data: DryingFormData) => {
        if (!firestore) {
            toast({ title: 'Error', description: 'Firestore not available.', variant: 'destructive' });
            return;
        }

        const selectedUnloadingRecord = unloadingRecords.find(ur => ur.id === data.unloadingRecordId);
        if (!selectedUnloadingRecord) {
            toast({ title: 'Error', description: 'Selected unloading record not found.', variant: 'destructive' });
            return;
        }
        
        const bagsStillAvailable = selectedUnloadingRecord.bagsUnloaded - (selectedUnloadingRecord.bagsSentToDrying || 0);
        if (data.bagsForDrying > bagsStillAvailable) {
          form.setError('bagsForDrying', { message: `Cannot exceed available bags (${bagsStillAvailable}).`});
          return;
        }

        startTransition(async () => {
            try {
                const dryingStartDate = new Date(data.dryingStartDate);
                const dryingEndDate = new Date(data.dryingEndDate);
                const currentProportionalUnloadingHamali = selectedUnloadingRecord.hamaliPerBag * data.bagsForDrying;
                const dryingDay1CustomerHamali = data.bagsForDrying * data.customerHamaliPerBag;
                const dryingDay1WorkerHamali = data.bagsForDrying * data.workerHamaliPerBag;
                
                const pavHamaliAmount = data.bagsForDrying * (data.pavHamaliPerBag || 0);
                const cuppaHamaliAmount = data.bagsForDrying * (data.cuppaHamaliPerBag || 0);

                const hamaliCharges: Partial<HamaliCharge>[] = [
                  { description: "Unloading Hamali", amount: currentProportionalUnloadingHamali, date: selectedUnloadingRecord.unloadingDate },
                  { description: "Drying Day 1", amount: dryingDay1CustomerHamali, date: dryingStartDate },
                ];
                
                if (pavHamaliAmount > 0) {
                    hamaliCharges.push({ description: "Pav Hamali", amount: pavHamaliAmount, date: dryingStartDate });
                }
                if (cuppaHamaliAmount > 0) {
                    hamaliCharges.push({ description: "Cuppa Hamali", amount: cuppaHamaliAmount, date: dryingStartDate });
                }

                const totalDryingHamali = hamaliCharges.reduce((acc, charge) => acc + (charge.amount || 0), 0);
                
                const totalDryingWorkerHamali = currentProportionalUnloadingHamali + dryingDay1WorkerHamali + pavHamaliAmount + cuppaHamaliAmount;
                
                // 1. Create new drying record
                const newRecord = {
                    unloadingRecordId: data.unloadingRecordId,
                    customerId: selectedUnloadingRecord.customerId,
                    commodityDescription: selectedUnloadingRecord.commodityDescription,
                    bagsForDrying: data.bagsForDrying,
                    dryingStartDate: dryingStartDate,
                    status: 'Packing' as const,
                    hamaliCharges,
                    totalDryingHamali,
                    totalDryingWorkerHamali,
                    packingDate: dryingEndDate,
                    billingDate: null,
                    bagsPacked: data.bagsPacked,
                };
                await addDoc(collection(firestore, 'dryingRecords'), cleanForFirestore(newRecord));

                // 2. Update bagsSentToDrying on unloading record
                const unloadingRecordRef = doc(firestore, 'unloadingRecords', data.unloadingRecordId);
                await updateDoc(unloadingRecordRef, { 
                    bagsSentToDrying: increment(data.bagsForDrying)
                });

                toast({ title: 'Success', description: 'Drying process finalized.' });
                form.reset();
                onCustomerChange(null);
            } catch (error) {
                console.error(error);
                toast({ title: 'Error', description: 'Failed to finalize drying process.', variant: 'destructive' });
            }
        });
    };

  return (
    <Card>
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
                <CardHeader>
                    <CardTitle>Finalize Drying Process</CardTitle>
                    <CardDescription>Select a customer and an unloading bill to start.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <FormField
                        control={form.control}
                        name="customerId"
                        render={({ field }) => (
                            <FormItem className="flex flex-col">
                                <FormLabel>Customer</FormLabel>
                                <Combobox
                                    options={customerOptions}
                                    value={field.value}
                                    onChange={(value) => {
                                        field.onChange(value);
                                    }}
                                    placeholder="Select a customer..."
                                    searchPlaceholder="Search customers..."
                                    emptyPlaceholder="No customer found."
                                />
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    {selectedCustomerId && (
                        <>
                            <FormField
                                control={form.control}
                                name="unloadingRecordId"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Unloading Bill No.</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl>
                                                <SelectTrigger><SelectValue placeholder="Select a bill" /></SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {customerUnloadingRecords.length > 0 ? customerUnloadingRecords.map(ur => (
                                                    <SelectItem key={ur.id} value={ur.id}>
                                                        Bill #{ur.billNo} - {ur.commodityDescription} ({ur.bagsUnloaded - (ur.bagsSentToDrying || 0)} bags remaining)
                                                    </SelectItem>
                                                )) : (
                                                    <SelectItem value="none" disabled>No records with remaining bags</SelectItem>
                                                )}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            {selectedUnloadingRecord && (
                                <Alert variant="destructive" className="bg-secondary/30 border-secondary">
                                    <Info className="h-4 w-4" />
                                    <AlertTitle>Unloading Summary</AlertTitle>
                                    <AlertDescription>
                                        Total hamali for unloading was <strong>{formatCurrency(selectedUnloadingRecord.totalHamali)}</strong> for <strong>{selectedUnloadingRecord.bagsUnloaded}</strong> bags. The cost will be pro-rated for the bags you send to drying.
                                    </AlertDescription>
                                </Alert>
                            )}
                        </>
                    )}
                     <FormField
                        control={form.control}
                        name="bagsForDrying"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Bags for Drying</FormLabel>
                                <FormControl><Input type="number" placeholder="0" {...field} value={field.value ?? ''} /></FormControl>
                                {selectedUnloadingRecord && <FormDescription>Remaining on Bill: {bagsRemainingOnRecord} bags</FormDescription>}
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="bagsPacked"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Bags Packed (Final)</FormLabel>
                                <FormControl><Input type="number" placeholder="0" {...field} value={field.value ?? ''} /></FormControl>
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
                                    <FormControl><Input type="date" {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                         <FormField
                            control={form.control}
                            name="dryingEndDate"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Drying End Date</FormLabel>
                                    <FormControl><Input type="date" {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>
                     {dryingDays !== null && (
                        <div className="text-sm text-center text-muted-foreground p-2 bg-secondary rounded-md">
                           Total Drying Days: <span className="font-bold text-foreground">{dryingDays}</span>
                        </div>
                    )}
                    <div className="grid grid-cols-2 gap-4">
                        <FormField
                            control={form.control}
                            name="customerHamaliPerBag"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Customer Drying Rate</FormLabel>
                                    <FormDescription className="text-xs h-8">Charge per bag (Day 1).</FormDescription>
                                    <FormControl><Input type="number" step="0.01" placeholder="0.00" {...field} value={field.value ?? ''} /></FormControl>
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
                                    <FormControl><Input type="number" step="0.01" placeholder="0.00" {...field} value={field.value ?? ''} /></FormControl>
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
                                    <FormControl><Input type="number" step="0.01" placeholder="0.00" {...field} value={field.value ?? ''} /></FormControl>
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
                                    <FormControl><Input type="number" step="0.01" placeholder="0.00" {...field} value={field.value ?? ''} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>

                    <Separator />

                    <div className="space-y-2">
                        <h4 className="font-medium">Cost Summary for this Drying Process</h4>
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
                            <span>Total Customer Charge</span>
                            <span className="font-mono">{formatCurrency(totalCustomerCharge)}</span>
                        </div>
                        <div className="flex justify-between items-center font-semibold pt-2">
                            <span>Total Hamali Charge</span>
                            <span className="font-mono">{formatCurrency(totalHamaliCharge)}</span>
                        </div>
                    </div>
                </CardContent>
                <CardFooter>
                    <Button type="submit" disabled={isPending || !selectedCustomerId || !selectedUnloadingRecordId} className="w-full">
                        {isPending ? (
                            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Finalizing Process...</>
                        ) : (
                            'Finalize Drying Process'
                        )}
                    </Button>
                </CardFooter>
            </form>
        </Form>
    </Card>
  );
}
