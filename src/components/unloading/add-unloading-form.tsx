'use client';

import { useTransition, useState, useEffect } from 'react';
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
import { useFirestore } from '@/firebase';
import type { Customer, Commodity } from '@/lib/definitions';
import { addDoc, collection, Timestamp } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { formatCurrency, cleanForFirestore } from '@/lib/utils';
import { Separator } from '../ui/separator';
import { Combobox } from '../ui/combobox';

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
    // Adjust for timezone offset to get local time in ISO-like format
    const timezoneOffsetInMs = now.getTimezoneOffset() * 60000;
    const localDate = new Date(now.getTime() - timezoneOffsetInMs);
    // Return formatted string for datetime-local input
    return localDate.toISOString().slice(0, 16);
};


export function AddUnloadingRecordForm({ customers, commodities, nextBillNo }: { customers: Customer[], commodities: Commodity[], nextBillNo: string }) {
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();
    const firestore = useFirestore();
    const router = useRouter();

    const form = useForm<UnloadingFormData>({
        resolver: zodResolver(UnloadingRecordSchema),
        defaultValues: {
          customerId: '',
          commodityDescription: '',
          lorryTractorNo: '',
          unloadingDate: getLocalDateTimeForInput(),
          bagsUnloaded: '',
          hamaliPerBag: '',
          billNo: nextBillNo,
        },
        values: { // Use `values` to ensure billNo is always up-to-date
            customerId: '',
            commodityDescription: '',
            lorryTractorNo: '',
            unloadingDate: getLocalDateTimeForInput(),
            bagsUnloaded: '',
            hamaliPerBag: '',
            billNo: nextBillNo,
        }
      });
    
    const customerOptions = customers.map(c => ({ value: c.id, label: c.name }));
      
    const bagsUnloaded = form.watch('bagsUnloaded');
    const hamaliPerBag = form.watch('hamaliPerBag');
    const totalHamali = (Number(bagsUnloaded) || 0) * (Number(hamaliPerBag) || 0);

    const onSubmit = (data: UnloadingFormData) => {
        if (!firestore) {
            toast({ title: 'Error', description: 'Firestore not available.', variant: 'destructive' });
            return;
        }

        startTransition(async () => {
            try {
                const totalHamali = data.bagsUnloaded * data.hamaliPerBag;
                const rawRecord = {
                    ...data,
                    billNo: nextBillNo, // Ensure the latest bill number is used
                    unloadingDate: Timestamp.fromDate(new Date(data.unloadingDate)),
                    bagsSentToDrying: 0,
                    totalHamali,
                    workerHamaliPayable: totalHamali,
                };
                const docRef = await addDoc(collection(firestore, 'unloadingRecords'), cleanForFirestore(rawRecord));
                toast({ title: 'Success', description: 'Unloading record added.' });
                form.reset();
                router.push(`/unloading/receipt/${docRef.id}`);
            } catch (error) {
                console.error(error);
                toast({ title: 'Error', description: 'Failed to add unloading record.', variant: 'destructive' });
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
                                <FormControl><Input placeholder="e.g., AP 21 1234" {...field} /></FormControl>
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
