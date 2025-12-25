
'use client';

import { useTransition, useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase';
import type { Customer, UnloadingRecord, HamaliCharge } from '@/lib/definitions';
import { addDoc, collection, Timestamp, doc, updateDoc } from 'firebase/firestore';

const InitiateDryingSchema = z.object({
  customerId: z.string().min(1, 'Customer is required.'),
  unloadingRecordId: z.string().min(1, 'Unloading bill is required.'),
  dryingStartDate: z.string().refine(val => !isNaN(Date.parse(val)), { message: "Invalid date format" }),
  hamaliPerBag: z.coerce.number().nonnegative('Hamali rate must be non-negative.'),
  bagsForDrying: z.coerce.number().int().positive('Number of bags must be positive.'),
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
    const [selectedCustomerId, setSelectedCustomerId] = useState('');

    const form = useForm<DryingFormData>({
        resolver: zodResolver(InitiateDryingSchema),
        defaultValues: {
          customerId: '',
          unloadingRecordId: '',
          dryingStartDate: new Date().toISOString().split('T')[0],
          hamaliPerBag: undefined,
          bagsForDrying: undefined,
        },
      });

    const customerUnloadingRecords = unloadingRecords.filter(ur => ur.customerId === selectedCustomerId);

    useEffect(() => {
        form.reset({
            ...form.getValues(),
            unloadingRecordId: '',
        });
        onCustomerChange(selectedCustomerId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedCustomerId, form]);

    const selectedUnloadingRecordId = form.watch('unloadingRecordId');
    const selectedUnloadingRecord = unloadingRecords.find(ur => ur.id === selectedUnloadingRecordId);

    useEffect(() => {
      if (selectedUnloadingRecord) {
        form.setValue('bagsForDrying', selectedUnloadingRecord.bagsUnloaded);
      } else {
        form.setValue('bagsForDrying', undefined);
      }
    }, [selectedUnloadingRecord, form]);


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

        if (data.bagsForDrying > selectedUnloadingRecord.bagsUnloaded) {
          form.setError('bagsForDrying', { message: `Cannot exceed unloaded bags (${selectedUnloadingRecord.bagsUnloaded}).`});
          return;
        }

        startTransition(async () => {
            try {
                const dryingDay1Hamali = data.bagsForDrying * data.hamaliPerBag;
                const unloadingHamali = selectedUnloadingRecord.totalHamali || 0;
                
                const hamaliCharges: HamaliCharge[] = [
                  { description: "Unloading Hamali", amount: unloadingHamali },
                  { description: "Drying Day 1", amount: dryingDay1Hamali },
                ];
                
                const totalDryingHamali = hamaliCharges.reduce((acc, charge) => acc + charge.amount, 0);
                
                // 1. Create new drying record
                const newRecord = {
                    unloadingRecordId: data.unloadingRecordId,
                    customerId: selectedUnloadingRecord.customerId,
                    commodityDescription: selectedUnloadingRecord.commodityDescription,
                    bagsForDrying: data.bagsForDrying,
                    dryingStartDate: Timestamp.fromDate(new Date(data.dryingStartDate)),
                    status: 'Drying' as const,
                    hamaliCharges,
                    totalDryingHamali,
                    packingDate: null,
                    billingDate: null,
                    bagsPacked: null,
                };
                await addDoc(collection(firestore, 'dryingRecords'), newRecord);

                // 2. Update status of unloading record
                const unloadingRecordRef = doc(firestore, 'unloadingRecords', data.unloadingRecordId);
                await updateDoc(unloadingRecordRef, { status: 'Drying' });

                toast({ title: 'Success', description: 'Drying process initiated.' });
                form.reset();
                setSelectedCustomerId('');
                onCustomerChange(null);
            } catch (error) {
                console.error(error);
                toast({ title: 'Error', description: 'Failed to initiate drying process.', variant: 'destructive' });
            }
        });
    };

  return (
    <Card>
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
                <CardHeader>
                    <CardTitle>Initiate Drying Process</CardTitle>
                    <CardDescription>Select a customer and an unloading bill to start drying.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <FormField
                        control={form.control}
                        name="customerId"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Customer</FormLabel>
                                <Select onValueChange={(value) => {
                                    field.onChange(value);
                                    setSelectedCustomerId(value);
                                }} value={field.value}>
                                    <FormControl>
                                        <SelectTrigger><SelectValue placeholder="Select a customer" /></SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        {customers.map(customer => (
                                            <SelectItem key={customer.id} value={customer.id}>{customer.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    {selectedCustomerId && (
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
                                                    Bill #{ur.billNo} - {ur.commodityDescription} ({ur.bagsUnloaded} bags)
                                                </SelectItem>
                                            )) : (
                                                <SelectItem value="none" disabled>No available records for drying</SelectItem>
                                            )}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    )}
                     <FormField
                        control={form.control}
                        name="bagsForDrying"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Bags for Drying</FormLabel>
                                <FormControl><Input type="number" placeholder="0" {...field} value={field.value ?? ''} /></FormControl>
                                {selectedUnloadingRecord && <FormDescription>Unloaded: {selectedUnloadingRecord.bagsUnloaded} bags</FormDescription>}
                                <FormMessage />
                            </FormItem>
                        )}
                    />
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
                        name="hamaliPerBag"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Drying Hamali per Bag (Day 1)</FormLabel>
                                <FormControl><Input type="number" step="0.01" placeholder="0.00" {...field} value={field.value ?? ''} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </CardContent>
                <CardFooter>
                    <Button type="submit" disabled={isPending || !selectedCustomerId} className="w-full">
                        {isPending ? (
                            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Starting Process...</>
                        ) : (
                            'Initiate Drying Process'
                        )}
                    </Button>
                </CardFooter>
            </form>
        </Form>
    </Card>
  );
}
