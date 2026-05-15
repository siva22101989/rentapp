'use client';

import { useState, useTransition } from 'react';
import { Loader2, HandCoins } from 'lucide-react';
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
import { addDoc, collection } from 'firebase/firestore';
import { cleanForFirestore } from '@/lib/utils';
import { useAppUser } from '@/firebase/auth/use-user';
import { Label } from '../ui/label';

const LendingSchema = z.object({
  borrowerName: z.string().min(2, 'Borrower name is required.'),
  principal: z.coerce.number().positive('Principal amount must be positive.'),
  interestRate: z.coerce.number().nonnegative('Interest rate must be non-negative.'),
  dateGiven: z.string().min(1, 'Date is required.'),
});


export function AddLendingDialog() {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const firestore = useFirestore();
  const appUser = useAppUser();

  const [borrowerName, setBorrowerName] = useState('');
  const [principal, setPrincipal] = useState<number | ''>('');
  const [interestRate, setInterestRate] = useState<number | ''>('');
  const [dateGiven, setDateGiven] = useState(new Date().toISOString().split('T')[0]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const resetForm = () => {
    setBorrowerName('');
    setPrincipal('');
    setInterestRate('');
    setDateGiven(new Date().toISOString().split('T')[0]);
    setErrors({});
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    if (!firestore || !appUser?.warehouseId) {
      toast({ title: 'Error', description: 'Could not add record: user or warehouse context is missing.', variant: 'destructive' });
      return;
    }
    
    const data = { borrowerName, principal, interestRate, dateGiven };

    const validationResult = LendingSchema.safeParse(data);
    if(!validationResult.success) {
        const fieldErrors = validationResult.error.flatten().fieldErrors;
        const newErrors: Record<string, string> = {};
        Object.keys(fieldErrors).forEach(key => {
            if (fieldErrors[key as keyof typeof fieldErrors]) newErrors[key] = fieldErrors[key as keyof typeof fieldErrors]![0];
        });
        setErrors(newErrors);
        return;
    }

    startTransition(async () => {
      try {
        const newLending = {
          ...validationResult.data,
          dateGiven: new Date(validationResult.data.dateGiven),
          status: 'Active' as const,
          warehouseId: appUser.warehouseId,
        };
        await addDoc(collection(firestore, 'lendings'), cleanForFirestore(newLending));
        toast({ title: 'Success', description: 'Lending record added successfully.' });
        setIsOpen(false);
        resetForm();
      } catch (error) {
        console.error(error);
        toast({ title: 'Error', description: 'Failed to add lending record.', variant: 'destructive' });
      }
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); if(!open) resetForm(); }}>
      <DialogTrigger asChild>
        <Button variant="default" className="text-sm">
          <HandCoins className="mr-2 h-4 w-4" />
          Add Lending
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>Add New Lending</DialogTitle>
              <DialogDescription className="text-xs">
                Record a new loan you have given out to an individual or entity.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-1.5">
                <Label htmlFor="borrowerName" className="text-xs">Borrower's Name</Label>
                <Input id="borrowerName" placeholder="e.g., Jane Smith" value={borrowerName} onChange={e => setBorrowerName(e.target.value)} className="text-sm" />
                {errors.borrowerName && <p className="text-[10px] font-medium text-destructive">{errors.borrowerName}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dateGiven" className="text-xs">Date Given</Label>
                <Input id="dateGiven" type="date" value={dateGiven} onChange={e => setDateGiven(e.target.value)} className="text-sm" />
                {errors.dateGiven && <p className="text-[10px] font-medium text-destructive">{errors.dateGiven}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="principal" className="text-xs">Principal Amount</Label>
                <Input id="principal" type="number" step="0.01" placeholder="0.00" value={principal} onChange={e => setPrincipal(e.target.value === '' ? '' : Number(e.target.value))} className="text-sm" />
                {errors.principal && <p className="text-[10px] font-medium text-destructive">{errors.principal}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="interestRate" className="text-xs">Monthly Interest Rate (%)</Label>
                <Input id="interestRate" type="number" step="0.01" placeholder="e.g. 2" value={interestRate} onChange={e => setInterestRate(e.target.value === '' ? '' : Number(e.target.value))} className="text-sm" />
                {errors.interestRate && <p className="text-[10px] font-medium text-destructive">{errors.interestRate}</p>}
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild><Button variant="outline" type="button" className="text-sm">Cancel</Button></DialogClose>
              <Button type="submit" disabled={isPending} className="text-sm">
                {isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : 'Save Lending'}
              </Button>
            </DialogFooter>
          </form>
      </DialogContent>
    </Dialog>
  );
}
