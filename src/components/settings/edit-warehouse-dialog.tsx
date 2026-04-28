'use client';

import { useState, useTransition, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
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
import { updateManagedWarehouse } from '@/lib/data';
import type { ManagedWarehouse } from '@/lib/definitions';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

const WarehouseEditSchema = z.object({
  name: z.string().min(3, 'Warehouse name is required.'),
  ownerName: z.string().min(2, 'Owner name is required.'),
  ownerEmail: z.string().email('A valid owner email is required.'),
  yearlyAmount: z.coerce.number().nonnegative('Yearly amount must be non-negative.'),
  subscriptionStatus: z.enum(['active', 'trial', 'expired', 'suspended']),
  trialMonths: z.coerce.number().int().nonnegative('Trial months must be a non-negative integer.').optional(),
});

export function EditWarehouseDialog({ warehouse, children }: { warehouse: ManagedWarehouse, children: React.ReactNode }) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const firestore = useFirestore();

  const [name, setName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [yearlyAmount, setYearlyAmount] = useState<number | ''>('');
  const [trialMonths, setTrialMonths] = useState<number | ''>('');
  const [subscriptionStatus, setSubscriptionStatus] = useState<'active' | 'trial' | 'expired' | 'suspended'>('trial');
  
  useEffect(() => {
    if(isOpen) {
        setName(warehouse.name);
        setOwnerName(warehouse.ownerName);
        setOwnerEmail(warehouse.ownerEmail);
        setYearlyAmount(warehouse.yearlyAmount);
        setTrialMonths(warehouse.trialMonths || 0);
        setSubscriptionStatus(warehouse.subscriptionStatus);
    }
  }, [isOpen, warehouse]);


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

    const validatedFields = WarehouseEditSchema.safeParse(data);

    if (!validatedFields.success) {
      const firstError = Object.values(validatedFields.error.flatten().fieldErrors)[0]?.[0];
      toast({
        title: 'Validation Error',
        description: firstError || 'Please check your input.',
        variant: 'destructive',
      });
      return;
    }


    startTransition(async () => {
      try {
        const updateData = {
          ...validatedFields.data,
          ownerEmail: validatedFields.data.ownerEmail.toLowerCase(),
        };
        await updateManagedWarehouse(firestore, warehouse.id, updateData);
        toast({ title: 'Success', description: 'Warehouse subscription updated.' });
        setIsOpen(false);
      } catch (error) {
        console.error(error);
        toast({ title: 'Error', description: 'Failed to update warehouse.', variant: 'destructive' });
      }
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>Edit Warehouse Subscription</DialogTitle>
              <DialogDescription>
                Update details for {warehouse.name}.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto pr-4">
              <div className="space-y-2">
                <Label htmlFor="name">Warehouse Name</Label>
                <Input id="name" value={name || ''} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ownerName">Owner Name</Label>
                <Input id="ownerName" value={ownerName || ''} onChange={(e) => setOwnerName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ownerEmail">Owner Email</Label>
                <Input id="ownerEmail" type="email" value={ownerEmail || ''} onChange={(e) => setOwnerEmail(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="yearlyAmount">Yearly Amount</Label>
                    <Input id="yearlyAmount" type="number" value={yearlyAmount || ''} onChange={(e) => setYearlyAmount(e.target.value === '' ? '' : Number(e.target.value))} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="trialMonths">Trial (Months)</Label>
                    <Input id="trialMonths" type="number" value={trialMonths || ''} onChange={(e) => setTrialMonths(e.target.value === '' ? '' : Number(e.target.value))} />
                </div>
              </div>
               <div className="space-y-2">
                  <Label htmlFor="subscriptionStatus">Subscription Status</Label>
                  <Select onValueChange={(value: 'active' | 'trial' | 'expired' | 'suspended') => setSubscriptionStatus(value)} value={subscriptionStatus}>
                      <SelectTrigger><SelectValue/></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="trial">Trial</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="suspended">Suspended</SelectItem>
                        <SelectItem value="expired">Expired</SelectItem>
                      </SelectContent>
                  </Select>
              </div>
            </div>
            <DialogFooter className="pt-4">
              <DialogClose asChild><Button variant="outline" type="button">Cancel</Button></DialogClose>
              <Button type="submit" disabled={isPending}>
                {isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
      </DialogContent>
    </Dialog>
  );
}
