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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase/provider';
import { saveCustomer } from '@/lib/data';
import { useAppUser } from '@/firebase/auth/use-user';

export function AddCustomerDialog() {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const firestore = useFirestore();
  const appUser = useAppUser();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [fatherName, setFatherName] = useState('');
  const [village, setVillage] = useState('');

  const resetForm = () => {
    setName('');
    setPhone('');
    setEmail('');
    setFatherName('');
    setVillage('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestore || !appUser) {
      toast({ title: 'Error', description: 'Firestore not available or user not logged in.', variant: 'destructive' });
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


    startTransition(async () => {
      try {
        await saveCustomer(firestore, { name, phone, email, fatherName, village });
        toast({ title: 'Success', description: 'Customer added successfully.' });
        setIsOpen(false);
        resetForm();
      } catch (error) {
        console.error(error);
        toast({ title: 'Error', description: 'Failed to save customer.', variant: 'destructive' });
      }
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button>
          <PlusCircle className="mr-2" />
          Add Customer
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add New Customer</DialogTitle>
            <DialogDescription>
              Enter the details for the new customer. Click save when you're done.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={name || ''} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fatherName">Father's Name</Label>
              <Input id="fatherName" value={fatherName || ''} onChange={(e) => setFatherName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="village">Village</Label>
              <Input id="village" value={village || ''} onChange={(e) => setVillage(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" type="tel" value={phone || ''} onChange={(e) => setPhone(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email (Optional)</Label>
              <Input id="email" type="email" value={email || ''} onChange={(e) => setEmail(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline" type="button">Cancel</Button></DialogClose>
            <Button type="submit" disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Customer'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
