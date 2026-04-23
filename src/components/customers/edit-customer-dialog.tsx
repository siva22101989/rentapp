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

export function EditCustomerDialog({ customer, children }: { customer: Customer, children: React.ReactNode }) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const firestore = useFirestore();
  const appUser = useAppUser();

  // State for each input field
  const [name, setName] = useState(customer.name || '');
  const [fatherName, setFatherName] = useState(customer.fatherName || '');
  const [village, setVillage] = useState(customer.village || '');
  const [phone, setPhone] = useState(customer.phone || '');
  const [email, setEmail] = useState(customer.email || '');

  // Reset state when dialog opens with new customer data
  useEffect(() => {
    if (isOpen) {
      setName(customer.name || '');
      setFatherName(customer.fatherName || '');
      setVillage(customer.village || '');
      setPhone(customer.phone || '');
      setEmail(customer.email || '');
    }
  }, [isOpen, customer]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!firestore || !appUser) {
      toast({ title: 'Error', description: 'Firestore not available or user not logged in.', variant: 'destructive' });
      return;
    }
    
    // Basic validation
    if (name.length < 3) {
      toast({ title: 'Validation Error', description: 'Name must be at least 3 characters.', variant: 'destructive' });
      return;
    }
    if (phone.length < 10) {
      toast({ title: 'Validation Error', description: 'Phone number must be at least 10 digits.', variant: 'destructive' });
      return;
    }

    startTransition(async () => {
      try {
        const updatedData: Partial<Customer> = {
          name,
          fatherName,
          village,
          phone,
          email,
        };
        await updateCustomer(firestore, customer.id, updatedData);
        toast({ title: 'Success', description: 'Customer updated successfully.' });
        setIsOpen(false);
      } catch (error) {
        console.error(error);
        toast({ title: 'Error', description: 'Failed to update customer.', variant: 'destructive' });
      }
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit Customer</DialogTitle>
            <DialogDescription>
              Update the details for {customer.name}.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Customer's full name" />
            </div>
            <div className="space-y-2">
                <Label htmlFor="fatherName">Father's Name</Label>
                <Input id="fatherName" value={fatherName} onChange={(e) => setFatherName(e.target.value)} placeholder="Father's name (optional)" />
            </div>
            <div className="space-y-2">
                <Label htmlFor="village">Village</Label>
                <Input id="village" value={village} onChange={(e) => setVillage(e.target.value)} placeholder="Village (optional)" />
            </div>
            <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="10-digit phone number" />
            </div>
            <div className="space-y-2">
                <Label htmlFor="email">Email (Optional)</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="example@email.com" />
            </div>
          </div>
          <DialogFooter>
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
