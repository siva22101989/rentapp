'use client';
import { useState, useTransition } from 'react';
import { Loader2, PlusCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase/provider';
import { z } from 'zod';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import { cleanForFirestore } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

const WarehouseSchema = z.object({
  name: z.string().min(3, 'Warehouse name is required.'),
  ownerName: z.string().min(2, 'Owner name is required.'),
  ownerEmail: z.string().email('A valid owner email is required.'),
  yearlyAmount: z.coerce.number().nonnegative('Yearly amount must be non-negative.'),
  subscriptionStatus: z.enum(['active', 'trial', 'expired', 'suspended']).default('trial'),
  trialMonths: z.coerce.number().int().nonnegative('Trial months must be a non-negative integer.').optional(),
});

export function AddWarehouseDialog() {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const firestore = useFirestore();

  const [name, setName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [yearlyAmount, setYearlyAmount] = useState<number | ''>('');
  const [subscriptionStatus, setSubscriptionStatus] = useState<'active' | 'trial' | 'expired' | 'suspended'>('trial');
  const [trialMonths, setTrialMonths] = useState<number | ''>(1);

  const resetForm = () => {
    setName('');
    setOwnerName('');
    setOwnerEmail('');
    setYearlyAmount('');
    setSubscriptionStatus('trial');
    setTrialMonths(1);
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      resetForm();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!firestore) {
      toast({ title: 'Error', description: 'Firestore not available.', variant: 'destructive' });
      return;
    }

    const data = {
      name,
      ownerName,
      ownerEmail,
      yearlyAmount: Number(yearlyAmount),
      subscriptionStatus,
      trialMonths: Number(trialMonths),
    };

    const validatedFields = WarehouseSchema.safeParse(data);
    if (!validatedFields.success) {
      const firstError = Object.values(validatedFields.error.flatten().fieldErrors)[0]?.[0];
      toast({
        title: "Validation Error",
        description: firstError || "Please check your input.",
        variant: "destructive",
      });
      return;
    }

    startTransition(async () => {
      try {
        const warehousesCollection = collection(firestore, 'managedWarehouses');
        const q = query(warehousesCollection, where('ownerEmail', '==', validatedFields.data.ownerEmail.toLowerCase()));
        const existingOwnerSnap = await getDocs(q);

        if (!existingOwnerSnap.empty) {
          toast({
            title: 'Owner Exists',
            description: 'This email is already assigned as an owner to another warehouse.',
            variant: 'destructive',
          });
          return;
        }

        await addDoc(collection(firestore, 'managedWarehouses'), cleanForFirestore({
            ...validatedFields.data,
            ownerEmail: validatedFields.data.ownerEmail.toLowerCase(),
            createdAt: new Date(),
        }));

        toast({ title: 'Success', description: 'New warehouse subscription created. The owner can now sign in.' });
        setIsOpen(false);
        resetForm();
      } catch (error) {
        console.error(error);
        toast({ title: 'Error', description: 'Failed to add warehouse.', variant: 'destructive' });
      }
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <PlusCircle className="mr-2" />
          Add Warehouse
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>Onboard New Warehouse</DialogTitle>
              <DialogDescription>
                Create a new warehouse subscription record. The owner will be able to log in with the specified email.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto pr-4">
               <div className="space-y-2">
                <Label htmlFor="name">Warehouse Name</Label>
                <Input id="name" placeholder="e.g., National Cold Storage" value={name || ''} onChange={(e) => setName(e.target.value)} />
              </div>
               <div className="space-y-2">
                <Label htmlFor="ownerName">Owner's Full Name</Label>
                <Input id="ownerName" placeholder="e.g., Jane Doe" value={ownerName || ''} onChange={(e) => setOwnerName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ownerEmail">Owner's Email (for login)</Label>
                <Input id="ownerEmail" type="email" placeholder="owner@example.com" value={ownerEmail || ''} onChange={(e) => setOwnerEmail(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="yearlyAmount">Yearly Amount</Label>
                    <Input id="yearlyAmount" type="number" placeholder="0.00" value={yearlyAmount} onChange={(e) => setYearlyAmount(e.target.value === '' ? '' : Number(e.target.value))} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="subscriptionStatus">Status</Label>
                    <Select onValueChange={(value: 'active' | 'trial' | 'expired' | 'suspended') => setSubscriptionStatus(value)} value={subscriptionStatus}>
                        <SelectTrigger id="subscriptionStatus"><SelectValue/></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="trial">Trial</SelectItem>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="expired">Expired</SelectItem>
                            <SelectItem value="suspended">Suspended</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="trialMonths">Trial Duration (Months)</Label>
                <Input id="trialMonths" type="number" placeholder="e.g. 1" value={trialMonths} onChange={(e) => setTrialMonths(e.target.value === '' ? '' : Number(e.target.value))} />
              </div>
            </div>
            <DialogFooter className="pt-4">
              <DialogClose asChild><Button variant="outline" type="button">Cancel</Button></DialogClose>
              <Button type="submit" disabled={isPending}>
                {isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : 'Add Subscription'}
              </Button>
            </DialogFooter>
          </form>
      </DialogContent>
    </Dialog>
  );
}