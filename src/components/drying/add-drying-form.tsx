
'use client';

import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase';
import type { Customer } from '@/lib/definitions';
import { addDoc, collection, Timestamp } from 'firebase/firestore';

const DryingRecordSchema = z.object({
  customerId: z.string().min(1, 'Customer is required.'),
  paddyType: z.string().min(2, 'Paddy type is required.'),
  unloadingDate: z.string().refine(val => !isNaN(Date.parse(val)), { message: "Invalid date" }),
  unloadedBags: z.coerce.number().int().positive('Must be a positive number.'),
  unloadingVehicleNo: z.string().optional(),
  weightBeforeDrying: z.coerce.number().positive('Must be a positive number.').optional(),
});

type DryingFormData = z.infer<typeof DryingRecordSchema>;

export function AddDryingRecordForm({ customers }: { customers: Customer[] }) {
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();
    const firestore = useFirestore();

    const form = useForm<DryingFormData>({
        resolver: zodResolver(DryingRecordSchema),
        defaultValues: {
            customerId: '',
            paddyType: '',
            unloadingDate: new Date().toISOString().split('T')[0],
            unloadedBags: undefined,
            unloadingVehicleNo: '',
            weightBeforeDrying: undefined,
        },
    });

    const onSubmit = (data: DryingFormData) => {
        if (!firestore) {
            toast({ title: 'Error', description: 'Firestore not available.', variant: 'destructive' });
            return;
        }

        startTransition(async () => {
            try {
                const newRecord = {
                    ...data,
                    unloadingDate: Timestamp.fromDate(new Date(data.unloadingDate)),
                    status: 'Unloaded' as const,
                };
                await addDoc(collection(firestore, 'dryingRecords'), newRecord);
                toast({ title: 'Success', description: 'New drying record added.' });
                form.reset();
            } catch (error) {
                console.error(error);
                toast({ title: 'Error', description: 'Failed to add record.', variant: 'destructive' });
            }
        });
    };

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
                <Card className="max-w-2xl mx-auto">
                    <CardHeader>
                        <CardTitle>New Paddy Unloading</CardTitle>
                        <CardDescription>Start a new drying process by recording the initial unloading details.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <FormField
                            control={form.control}
                            name="customerId"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Customer</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select a customer" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                             <FormField
                                control={form.control}
                                name="paddyType"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Paddy Type</FormLabel>
                                        <FormControl><Input placeholder="e.g. Sona Masoori" {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="unloadingDate"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Unloading Date</FormLabel>
                                        <FormControl><Input type="date" {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                           <FormField
                                control={form.control}
                                name="unloadedBags"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Bags Unloaded</FormLabel>
                                        <FormControl><Input type="number" {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                             <FormField
                                control={form.control}
                                name="weightBeforeDrying"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Weight (optional)</FormLabel>
                                        <FormControl><Input type="number" placeholder="in Kgs" {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                         <FormField
                            control={form.control}
                            name="unloadingVehicleNo"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Vehicle No. (optional)</FormLabel>
                                    <FormControl><Input placeholder="e.g. AP 01 AB 1234" {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </CardContent>
                    <CardFooter>
                         <Button type="submit" disabled={isPending}>
                            {isPending ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Saving...
                            </>
                            ) : (
                            'Add Unloading Record'
                            )}
                        </Button>
                    </CardFooter>
                </Card>
            </form>
        </Form>
    );
}
