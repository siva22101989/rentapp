'use client';

import { useState, useTransition } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import type { Payment, Borrowing } from '@/lib/definitions';
import { cleanForFirestore } from '@/lib/utils';
import { useFirestore } from '@/firebase/provider';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
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

  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentType, setPaymentType] = useState<'principal' | 'interest'>('principal');

  const onOpenChange = (open: boolean) => {
    if (open) {
      // Reset state when opening
      setPaymentDate(new Date().toISOString().split('T')[0]);
      setPaymentAmount('');
      setPaymentType('principal');
    }
    setIsOpen(open);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestore) {
      toast({ title: 'Error', description: 'Firestore not available.', variant: 'destructive' });
      return;
    }

    const amountNumber = parseFloat(paymentAmount);
    if (isNaN(amountNumber) || amountNumber <= 0) {
        toast({ title: 'Error', description: 'Please enter a valid positive amount.', variant: 'destructive' });
        return;
    }

    startTransition(async () => {
      try {
        const newPayment: Payment = {
          amount: amountNumber,
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
            <form onSubmit={handleSubmit}>
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
                    <Input id="paymentAmount" type="number" step="0.01" placeholder="0.00" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} />
                </div>
                <div className="space-y-2">
                    <Label>Payment For</Label>
                    <RadioGroup
                        value={paymentType}
                        onValueChange={(value: 'principal' | 'interest') => setPaymentType(value)}
                        className="flex items-center space-x-4 pt-2"
                    >
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="principal" id="r1" />
                            <Label htmlFor="r1" className="font-normal">Principal</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="interest" id="r2" />
                            <Label htmlFor="r2" className="font-normal">Interest</Label>
                        </div>
                    </RadioGroup>
                </div>
            </div>
            <DialogFooter>
                <DialogClose asChild><Button variant="outline" type="button">Cancel</Button></DialogClose>
                <Button type="submit" disabled={isPending}>
                {isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : 'Record Payment'}
                </Button>
            </DialogFooter>
            </form>
      </DialogContent>
    </Dialog>
  );
}
