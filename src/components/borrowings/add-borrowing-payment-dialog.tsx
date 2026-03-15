'use client';

import { useState, useTransition } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import type { Payment, Borrowing } from '@/lib/definitions';
import { cleanForFirestore } from '@/lib/utils';
import { useFirestore } from '@/firebase/provider';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';

type AddBorrowingPaymentDialogProps = {
    borrowing: Borrowing;
    children: React.ReactNode;
};

export function AddBorrowingPaymentDialog({ borrowing, children }: AddBorrowingPaymentDialogProps) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const firestore = useFirestore();

  // Using simple React state to avoid form library issues
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentType, setPaymentType] = useState<'principal' | 'interest'>('principal');
  const [error, setError] = useState('');

  const onOpenChange = (open: boolean) => {
    if (open) {
      // Reset state when opening the dialog
      setPaymentDate(new Date().toISOString().split('T')[0]);
      setPaymentAmount('');
      setPaymentType('principal');
      setError('');
    }
    setIsOpen(open);
  };

  const handleSubmit = () => {
    if (!firestore) {
      toast({ title: 'Error', description: 'Firestore not available.', variant: 'destructive' });
      return;
    }
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      setError('Please enter a valid positive amount.');
      return;
    }
    setError('');

    startTransition(async () => {
      try {
        const newPayment: Payment = {
          amount: amount,
          date: new Date(paymentDate),
          type: paymentType,
        };

        const recordRef = doc(firestore, 'borrowings', borrowing.id);
        await updateDoc(recordRef, {
          payments: arrayUnion(cleanForFirestore(newPayment))
        });
        toast({ title: 'Success', description: 'Payment recorded successfully.' });
        
        setIsOpen(false);
      } catch (error) {
        console.error(error);
        toast({ title: 'Error', description: 'Failed to record payment.', variant: 'destructive' });
      }
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Payment to Loan</DialogTitle>
          <DialogDescription>
            For loan from {borrowing.lenderName}.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="paymentDate">Payment Date</Label>
            <Input id="paymentDate" type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="paymentAmount">Payment Amount</Label>
            <Input id="paymentAmount" type="number" placeholder="0.00" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} />
            {error && <p className="text-sm font-medium text-destructive">{error}</p>}
          </div>
          <div className="space-y-2">
            <Label>Payment For</Label>
            <RadioGroup value={paymentType} onValueChange={(value: 'principal' | 'interest') => setPaymentType(value)} className="flex items-center space-x-4 pt-2">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="principal" id="r1-borrow" />
                <Label htmlFor="r1-borrow" className="font-normal">Principal</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="interest" id="r2-borrow" />
                <Label htmlFor="r2-borrow" className="font-normal">Interest</Label>
              </div>
            </RadioGroup>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline" type="button">Cancel</Button></DialogClose>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : 'Record Payment'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
