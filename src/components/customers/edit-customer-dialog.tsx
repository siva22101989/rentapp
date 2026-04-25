'use client';

import { useState, useTransition } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import type { Customer } from '@/lib/definitions';
import { useFirestore } from '@/firebase/provider';
import { updateCustomer } from '@/lib/data';
import { useAppUser } from '@/firebase/auth/use-user';

export function EditCustomerForm({ customer }: { customer: Customer }) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const firestore = useFirestore();
  const appUser = useAppUser();

  // Initialize state directly — no useEffect needed!
  const [name, setName] = useState(customer?.name || '');
  const [fatherName, setFatherName] = useState(customer?.fatherName || '');
  const [village, setVillage] = useState(customer?.village || '');
  const [phone, setPhone] = useState(customer?.phone || '');
  const [email, setEmail] = useState(customer?.email || '');
  const [address, setAddress] = useState(customer?.address || '');

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!firestore || !appUser) {
      return toast({ title: 'Error', description: 'Firestore or User missing.', variant: 'destructive' });
    }
    if (!customer?.id) {
      return toast({ title: 'Error', description: 'Customer ID missing.', variant: 'destructive' });
    }

    startTransition(async () => {
      try {
        await updateCustomer(firestore, customer.id, { name, fatherName, village, phone, email, address });
        toast({ title: 'Success', description: 'Customer updated successfully.' });
      } catch (error) {
        toast({ title: 'Error', description: 'Failed to update customer.', variant: 'destructive' });
      }
    });
  };

  // Safety catch to prevent the red crash screen
  if (!customer) return <p className="text-red-500">Loading customer data...</p>;

  return (
    <form onSubmit={handleSubmit} className="border p-4 rounded-md shadow-sm max-w-[425px]">
      <h3 className="text-lg font-semibold mb-4">Edit Details for {customer.name}</h3>
      <div className="grid gap-4 mb-4">
        <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div className="space-y-2">
            <Label htmlFor="village">Village</Label>
            <Input id="village" value={village} onChange={(e) => setVillage(e.target.value)} />
        </div>
      </div>
      <Button type="submit" disabled={isPending}>
        {isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : 'Save Changes'}
      </Button>
    </form>
  );
}