'use client';

import { useState, useTransition } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import type { Payment, Borrowing } from '@/lib/definitions';
import { cleanForFirestore, toDate } from '@/lib/utils';
import { useFirestore } from '@/firebase/provider';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../ui/form';
import { differenceInDays } from 'date-fns';

const PaymentSchema = z.object({
  paymentDate: z.string().refine(val => !isNaN(Date.parse(val)), { message: "Invalid date" }),
  paymentAmount: z.coerce.number().positive('Payment amount must be a positive number.'),
});
type PaymentFormData = z.infer<typeof PaymentSchema>;

type AddBorrowingPaymentDialogProps = {
    borrowing: Borrowing;
    children: React.ReactNode;
};

export function AddBorrowingPaymentDialog({ borrowing, children }: AddBorrowingPaymentDialogProps) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const firestore = useFirestore();

  const form = useForm<PaymentFormData>({
    resolver: zodResolver(PaymentSchema),
    defaultValues: {
        paymentDate: new Date().toISOString().split('T')[0],
        paymentAmount: undefined,
    },
  });

  const onSubmit = (data: PaymentFormData) => {
    if (!firestore) {
      toast({ title: 'Error', description: 'Firestore not available.', variant: 'destructive' });
      return;
    }

    startTransition(async () => {
      try {
        const paymentDate = new Date(data.paymentDate);
        let amountToApply = data.paymentAmount;
        const payments: Payment[] = [];

        // Calculate interest due up to payment date
        const startDate = toDate(borrowing.dateTaken);
        const daysElapsed = differenceInDays(paymentDate, startDate);
        let totalAccruedInterest = 0;
        if (daysElapsed > 0) {
            if (borrowing.interestType === 'Monthly') {
                const dailyRate = (borrowing.interestRate / 100) / 30;
                totalAccruedInterest = borrowing.principal * dailyRate * daysElapsed;
            } else { // Yearly
                const dailyRate = (borrowing.interestRate / 100) / 365;
                totalAccruedInterest = borrowing.principal * dailyRate * daysElapsed;
            }
        }
        
        const interestPaidSoFar = (borrowing.payments || [])
            .filter(p => p.type === 'interest')
            .reduce((acc, p) => acc + p.amount, 0);

        const interestDue = totalAccruedInterest - interestPaidSoFar;
        
        // Apply to interest first
        if (interestDue > 0) {
            const interestPayment = Math.min(amountToApply, interestDue);
            if (interestPayment > 0) {
                payments.push({ amount: interestPayment, date: paymentDate, type: 'interest' });
                amountToApply -= interestPayment;
            }
        }

        // Apply remaining to principal
        if (amountToApply > 0) {
            payments.push({ amount: amountToApply, date: paymentDate, type: 'principal' });
        }

        if (payments.length > 0) {
            const recordRef = doc(firestore, 'borrowings', borrowing.id);
            await updateDoc(recordRef, {
              payments: arrayUnion(...payments.map(p => cleanForFirestore(p)))
            });
            toast({ title: 'Success', description: 'Payment recorded successfully.' });
        } else {
            toast({ title: 'Info', description: 'Payment amount was zero, nothing recorded.' });
        }

        setIsOpen(false);
        form.reset();
      } catch (error) {
        console.error(error);
        toast({ title: 'Error', description: 'Failed to record payment.', variant: 'destructive' });
      }
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
            <DialogHeader>
                <DialogTitle>Add Payment to Loan</DialogTitle>
                <DialogDescription>
                For loan from {borrowing.lenderName}. Payment will be applied to interest first, then principal.
                </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
                <FormField
                    control={form.control}
                    name="paymentDate"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Payment Date</FormLabel>
                            <FormControl><Input type="date" {...field} /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="paymentAmount"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Payment Amount</FormLabel>
                            <FormControl><Input type="number" step="0.01" placeholder="0.00" {...field} value={field.value ?? ''} /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
            </div>
            <DialogFooter>
                <DialogClose asChild><Button variant="outline" type="button">Cancel</Button></DialogClose>
                <Button type="submit" disabled={isPending}>
                {isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : 'Record Payment'}
                </Button>
            </DialogFooter>
            </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
