
'use client';

import { useTransition, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Building2 } from 'lucide-react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase/provider';
import type { WarehouseInfo } from '@/lib/definitions';
import { doc, setDoc } from 'firebase/firestore';
import { useDoc } from '@/firebase/firestore/use-doc';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { cleanForFirestore } from '@/lib/utils';
import { Skeleton } from '../ui/skeleton';
import { Textarea } from '../ui/textarea';

const WarehouseInfoSchema = z.object({
  name: z.string().min(3, 'Warehouse name is required.'),
  phone: z.string().optional(),
  email: z.string().email('Invalid email address.').optional().or(z.literal('')),
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  ownerName: z.string().optional(),
  bankDetails: z.string().optional(),
});

type WarehouseInfoFormData = z.infer<typeof WarehouseInfoSchema>;

export function WarehouseInfoForm() {
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();
    const firestore = useFirestore();

    const warehouseInfoRef = useMemoFirebase(
        () => (firestore ? doc(firestore, 'settings', 'main') : null),
        [firestore]
    );
    const { data: warehouseInfo, loading: loadingInfo } = useDoc<WarehouseInfo>(warehouseInfoRef);

    const form = useForm<WarehouseInfoFormData>({
        resolver: zodResolver(WarehouseInfoSchema),
        defaultValues: {
            name: '',
            phone: '',
            email: '',
            addressLine1: '',
            addressLine2: '',
            ownerName: '',
            bankDetails: '',
        }
    });

    useEffect(() => {
        if (warehouseInfo) {
            form.reset({
                name: warehouseInfo.name || '',
                phone: warehouseInfo.phone || '',
                email: warehouseInfo.email || '',
                addressLine1: warehouseInfo.addressLine1 || '',
                addressLine2: warehouseInfo.addressLine2 || '',
                ownerName: warehouseInfo.ownerName || '',
                bankDetails: warehouseInfo.bankDetails || '',
            });
        }
    }, [warehouseInfo, form]);

    const onSubmit = (data: WarehouseInfoFormData) => {
        if (!firestore) {
            toast({ title: 'Error', description: 'Firestore not available.', variant: 'destructive' });
            return;
        }

        startTransition(async () => {
            try {
                const docRef = doc(firestore, 'settings', 'main');
                await setDoc(docRef, cleanForFirestore(data), { merge: true });
                toast({ title: 'Success', description: 'Warehouse information updated.' });
            } catch (error) {
                console.error(error);
                toast({ title: 'Error', description: 'Failed to update warehouse info.', variant: 'destructive' });
            }
        });
    };

    if (loadingInfo) {
        return (
            <Card className="w-full max-w-md mx-auto">
                <CardHeader>
                    <CardTitle>Warehouse Details</CardTitle>
                    <CardDescription>Edit your warehouse name, address, and phone.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-20 w-full" />
                </CardContent>
                <CardFooter>
                    <Skeleton className="h-10 w-24" />
                </CardFooter>
            </Card>
        );
    }

  return (
    <Card className="w-full max-w-md mx-auto">
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
                <CardHeader>
                    <CardTitle>Warehouse Details</CardTitle>
                    <CardDescription>Edit your warehouse name, address, and phone number. This information will appear on all receipts.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Warehouse Name</FormLabel>
                                <FormControl><Input placeholder="e.g., Sri Lakshmi Warehouse" {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                     <FormField
                        control={form.control}
                        name="ownerName"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Owner Name (Proprietor)</FormLabel>
                                <FormControl><Input placeholder="e.g., John Doe" {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="phone"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Phone Number</FormLabel>
                                <FormControl><Input placeholder="e.g., 9160606633" {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                     <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Email Address</FormLabel>
                                <FormControl><Input type="email" placeholder="e.g., contact@warehouse.com" {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="addressLine1"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Address Line 1</FormLabel>
                                <FormControl><Input placeholder="e.g., Survey No. 165,237/2" {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="addressLine2"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Address Line 2</FormLabel>
                                <FormControl><Input placeholder="e.g., Owk (M), Kurnool (Dt.), A.P." {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="bankDetails"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Bank Details</FormLabel>
                                <FormControl><Textarea placeholder="Bank Name, Account Number, IFSC Code" {...field} /></FormControl>
                                <FormDescription>This will be displayed on customer statements for payment.</FormDescription>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </CardContent>
                <CardFooter>
                    <Button type="submit" disabled={isPending}>
                        {isPending ? (
                            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>
                        ) : (
                            <><Building2 className="mr-2 h-4 w-4" /> Save Details</>
                        )}
                    </Button>
                </CardFooter>
            </form>
        </Form>
    </Card>
  );
}
