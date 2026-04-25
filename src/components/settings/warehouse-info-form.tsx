
'use client';

import { useTransition, useEffect, useState } from 'react';
import { Loader2, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase/provider';
import type { WarehouseInfo } from '@/lib/definitions';
import { doc, setDoc } from 'firebase/firestore';
import { useDoc } from '@/firebase/firestore/use-doc';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { cleanForFirestore } from '@/lib/utils';
import { Skeleton } from '../ui/skeleton';
import { Textarea } from '../ui/textarea';
import { useAppUser } from '@/firebase/auth/use-user';
import { z } from 'zod';

const WarehouseInfoSchema = z.object({
  name: z.string().min(3, 'Warehouse name is required.'),
  phone: z.string().optional(),
  email: z.string().email('Invalid email address.').optional().or(z.literal('')),
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  ownerName: z.string().optional(),
  bankDetails: z.string().optional(),
});


export function WarehouseInfoForm() {
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();
    const firestore = useFirestore();
    const appUser = useAppUser();

    const warehouseInfoRef = useMemoFirebase(
        () => (firestore && appUser?.warehouseId ? doc(firestore, 'warehouses', appUser.warehouseId) : null),
        [firestore, appUser]
    );
    const { data: warehouseInfo, loading: loadingInfo } = useDoc<WarehouseInfo>(warehouseInfoRef);

    const [name, setName] = useState('');
    const [ownerName, setOwnerName] = useState('');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [addressLine1, setAddressLine1] = useState('');
    const [addressLine2, setAddressLine2] = useState('');
    const [bankDetails, setBankDetails] = useState('');


    useEffect(() => {
        if (warehouseInfo) {
            setName(warehouseInfo.name || '');
            setOwnerName(warehouseInfo.ownerName || '');
            setPhone(warehouseInfo.phone || '');
            setEmail(warehouseInfo.email || '');
            setAddressLine1(warehouseInfo.addressLine1 || '');
            setAddressLine2(warehouseInfo.addressLine2 || '');
            setBankDetails(warehouseInfo.bankDetails || '');
        }
    }, [warehouseInfo]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!firestore || !appUser?.warehouseId) {
            toast({ title: 'Error', description: 'Firestore or User context not available.', variant: 'destructive' });
            return;
        }

        const dataToValidate = { name, ownerName, phone, email, addressLine1, addressLine2, bankDetails };
        const result = WarehouseInfoSchema.safeParse(dataToValidate);

        if (!result.success) {
            const firstError = Object.values(result.error.flatten().fieldErrors)[0]?.[0];
            toast({
                title: "Validation Error",
                description: firstError || "Please check your input.",
                variant: "destructive",
            });
            return;
        }

        startTransition(async () => {
            try {
                const docRef = doc(firestore, 'warehouses', appUser.warehouseId);
                await setDoc(docRef, cleanForFirestore(result.data), { merge: true });
                toast({ title: 'Success', description: 'Warehouse information updated.' });
            } catch (error) {
                console.error(error);
                toast({ title: 'Error', description: 'Failed to update warehouse info.', variant: 'destructive' });
            }
        });
    };

    if (loadingInfo) {
        return (
            <div className="space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-20 w-full" />
                <div className="flex justify-end">
                    <Skeleton className="h-10 w-32" />
                </div>
            </div>
        );
    }

  return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="name">Warehouse Name</Label>
                <Input id="name" placeholder="e.g., Sri Lakshmi Warehouse" value={name} onChange={e => setName(e.target.value)} />
            </div>
             <div className="space-y-2">
                <Label htmlFor="ownerName">Owner Name (Proprietor)</Label>
                <Input id="ownerName" placeholder="e.g., John Doe" value={ownerName} onChange={e => setOwnerName(e.target.value)} />
            </div>
            <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input id="phone" placeholder="e.g., 9160606633" value={phone} onChange={e => setPhone(e.target.value)} />
            </div>
             <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input id="email" type="email" placeholder="e.g., contact@warehouse.com" value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
                <Label htmlFor="addressLine1">Address Line 1</Label>
                <Input id="addressLine1" placeholder="e.g., Survey No. 165,237/2" value={addressLine1} onChange={e => setAddressLine1(e.target.value)} />
            </div>
            <div className="space-y-2">
                <Label htmlFor="addressLine2">Address Line 2</Label>
                <Input id="addressLine2" placeholder="e.g., Owk (M), Kurnool (Dt.), A.P." value={addressLine2} onChange={e => setAddressLine2(e.target.value)} />
            </div>
            <div className="space-y-2">
                <Label htmlFor="bankDetails">Bank Details</Label>
                <Textarea id="bankDetails" placeholder="Bank Name, Account Number, IFSC Code" value={bankDetails} onChange={e => setBankDetails(e.target.value)} />
                 <p className="text-xs text-muted-foreground">This will be displayed on customer statements for payment.</p>
            </div>

             <div className="flex justify-end">
                <Button type="submit" disabled={isPending}>
                    {isPending ? (
                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>
                    ) : (
                        <><Building2 className="mr-2 h-4 w-4" /> Save Details</>
                    )}
                </Button>
            </div>
        </form>
  );
}
