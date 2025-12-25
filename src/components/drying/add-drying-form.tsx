
'use client';

import { useTransition } from 'react';
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
import type { Customer } from '@/lib/definitions';
import { addDoc, collection, Timestamp } from 'firebase/firestore';

const DryingRecordSchema = z.object({
  customerId: z.string().min(1, 'Customer is required.'),
  commodityDescription: z.string().min(2, 'Commodity is required.'),
  dryingStartDate: z.string().refine(val => !isNaN(Date.parse(val)), { message: "Invalid date format" }),
  bagsUnloaded: z.coerce.number().int().positive('Number of bags must be positive.'),
  hamaliPerBag: z.coerce.number().nonnegative('Hamali rate must be non-negative.'),
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
          commodityDescription: '',
          dryingStartDate: new Date().toISOString().split('T')[0],
          bagsUnloaded: '' as any,
          hamaliPerBag: '' as any,
        },
      });

    const onSubmit = (data: DryingFormData) => {
        if (!firestore) {
            toast({ title: 'Error', description: 'Firestore not available.', variant: 'destructive' });
            return;
        }

        startTransition(async () => {
            try {
                const totalDryingHamali = data.bagsUnloaded * data.hamaliPerBag;
                const newRecord = {
                    ...data,
                    dryingStartDate: Timestamp.fromDate(new Date(data.dryingStartDate)),
                    status: 'Drying' as const,
                    totalDryingHamali,
                    packingDate: null,
                    billingDate: null,
                };
                await addDoc(collection(firestore, 'dryingRecords'), newRecord);
                toast({ title: 'Success', description: 'Drying record added.' });
                form.reset();
            } catch (error) {
                console.error(error);
                toast({ title: 'Error', description: 'Failed to add drying record.', variant: 'destructive' });
            }
        });
    };

  return (
    <Card>
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
                <CardHeader>
                    <CardTitle>Add New Drying Record</CardTitle>
                    <CardDescription>Enter details for a new drying process.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <FormField
                        control={form.control}
                        name="customerId"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Customer</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                    <FormField
                        control={form.control}
                        name="commodityDescription"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Commodity</FormLabel>
                                <FormControl><Input placeholder="e.g., Paddy" {...field} /></FormControl>
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
                        name="bagsUnloaded"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Bags Unloaded</FormLabel>
                                <FormControl><Input type="number" placeholder="0" {...field} /></FormControl>
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
                                <FormControl><Input type="number" step="0.01" placeholder="0.00" {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </CardContent>
                <CardFooter>
                    <Button type="submit" disabled={isPending} className="w-full">
                        {isPending ? (
                            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>
                        ) : (
                            'Add Record'
                        )}
                    </Button>
                </CardFooter>
            </form>
        </Form>
    </Card>
  );
}

    