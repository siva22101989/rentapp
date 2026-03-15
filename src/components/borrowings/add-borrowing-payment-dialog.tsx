'use client';

import { useState, useTransition } from 'react';
import { Loader2, IndianRupee } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import type { Payment, Borrowing } from '@/lib/definitions';
import { formatCurrency, cleanForFirestore } from '@/lib/utils';
import { useFirestore } from '@/firebase/provider';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../ui/form';

const PaymentSchema = z.object({
  paymentDate: z.string().refine(val => !isNaN(Date.parse(val)), { message: "Invalid date" }),
  principalPayment: z.coerce.number().nonnegative('Principal must be non-negative.').optional(),
  interestPayment: z.coerce.number().nonnegative('Interest must be non-negative.').optional(),
}).refine(data => (data.principalPayment ?? 0) > 0 || (data.interestPayment ?? 0) > 0, {
    message: 'At least one payment amount is required.',
    path: ['principalPayment']
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
        principalPayment: '', // Use empty string to keep it controlled
        interestPayment: '', // Use empty string to keep it controlled
    },
  });

  const onOpenChange = (open: boolean) => {
    if (open) {
      form.reset({
        paymentDate: new Date().toISOString().split('T')[0],
        principalPayment: '',
        interestPayment: '',
      });
    }
    setIsOpen(open);
  };

  const onSubmit = (data: PaymentFormData) => {
    if (!firestore) {
      toast({ title: 'Error', description: 'Firestore not available.', variant: 'destructive' });
      return;
    }

    startTransition(async () => {
      try {
        const paymentsToAdd: Payment[] = [];
        const paymentDate = new Date(data.paymentDate);

        if (data.principalPayment && data.principalPayment > 0) {
            paymentsToAdd.push({ amount: data.principalPayment, date: paymentDate, type: 'principal' });
        }
        if (data.interestPayment && data.interestPayment > 0) {
            paymentsToAdd.push({ amount: data.interestPayment, date: paymentDate, type: 'interest' });
        }

        if (paymentsToAdd.length > 0) {
            const recordRef = doc(firestore, 'borrowings', borrowing.id);
            await updateDoc(recordRef, {
              payments: arrayUnion(...paymentsToAdd.map(p => cleanForFirestore(p)))
            });
            toast({ title: 'Success', description: 'Payment recorded successfully.' });
        }
        
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
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
            <DialogHeader>
                <DialogTitle>Add Payment to Loan</DialogTitle>
                <DialogDescription>
                For loan from {borrowing.lenderName}.
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
                    name="interestPayment"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Interest Paid</FormLabel>
                            <FormControl><Input type="number" step="0.01" placeholder="0.00" {...field} value={field.value ?? ''} /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="principalPayment"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Principal Paid</FormLabel>
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
