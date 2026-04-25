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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import type { Customer } from '@/lib/definitions';
import { useFirestore } from '@/firebase/provider';
import { updateCustomer } from '@/lib/data';
import { useAppUser } from '@/firebase/auth/use-user';

export function EditCustomerDialog({ customer, children }: { customer: Customer; children: React.ReactNode }) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const firestore = useFirestore();
  const appUser = useAppUser();

  const [name, setName] = useState('');
  const [fatherName, setFatherName] = useState('');
  const [village, setVillage] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');

  useEffect(() => {
    if (customer && isOpen) {
      setName(customer.name || '');
      setFatherName(customer.fatherName || '');
      setVillage(customer.village || '');
      setPhone(customer.phone || '');
      setAddress(customer.address || '');
    }
  }, [customer, isOpen]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!firestore || !appUser) {
      toast({ title: 'Error', description: 'Firestore or User missing.', variant: 'destructive' });
      return;
    }
    if (!customer?.id) {
      toast({ title: 'Error', description: 'Customer ID missing.', variant: 'destructive' });
      return;
    }
     if (name.length < 3) {
      toast({ title: 'Validation Error', description: 'Name must be at least 3 characters.', variant: 'destructive' });
      return;
    }
    if (phone.length < 10) {
      toast({ title: 'Validation Error', description: 'Phone number must be at least 10 digits.', variant: 'destructive' });
      return;
    }

    const updatedData = {
      name,
      fatherName,
      village,
      phone,
      address,
    };

    startTransition(async () => {
      try {
        await updateCustomer(firestore, customer.id, updatedData);
        toast({ title: 'Success', description: 'Customer updated successfully.' });
        setIsOpen(false);
      } catch (error) {
        toast({ title: 'Error', description: 'Failed to update customer.', variant: 'destructive' });
      }
    });
  };

  if (!customer) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit Customer</DialogTitle>
            <DialogDescription>
              Update customer information. Click save when you're done.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto pr-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input id="name" name="name" value={name || ''} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fatherName">Father's Name</Label>
              <Input id="fatherName" name="fatherName" value={fatherName || ''} onChange={(e) => setFatherName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="village">Village</Label>
              <Input id="village" name="village" value={village || ''} onChange={(e) => setVillage(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone *</Label>
              <Input id="phone" name="phone" type="tel" value={phone || ''} onChange={(e) => setPhone(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Input id="address" name="address" value={address || ''} onChange={(e) => setAddress(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">Cancel</Button>
            </DialogClose>
            <Button type="submit" disabled={isPending}>
              {isPending ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>) : ('Save Changes')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
