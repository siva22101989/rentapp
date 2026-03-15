
'use client';

import { useState, useTransition } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import type { Payment, Borrowing } from '@/lib/definitions';
import { cleanForFirestore } from '@/lib/utils';
import { useFirestore } from '@/firebase/provider';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../ui/form';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';

const PaymentSchema = z.object({
  paymentDate: z.string().refine(val => !isNaN(Date.parse(val)), { message: "Invalid date" }),
  paymentAmount: z.coerce.number().positive('Payment amount must be a positive number.'),
  paymentType: z.enum(['principal', 'interest'], { required_error: 'You must select a payment type.' }),
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
        paymentType: 'principal',
    },
  });

  const onOpenChange = (open: boolean) => {
    if (open) {
      form.reset({
        paymentDate: new Date().toISOString().split('T')[0],
        paymentAmount: undefined,
        paymentType: 'principal',
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
        const newPayment: Payment = {
          amount: data.paymentAmount,
          date: new Date(data.paymentDate),
          type: data.paymentType,
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
                    name="paymentAmount"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Payment Amount</FormLabel>
                            <FormControl><Input type="number" step="0.01" placeholder="0.00" {...field} value={field.value ?? ''} /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                  control={form.control}
                  name="paymentType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Payment For</FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          className="flex items-center space-x-4 pt-2"
                        >
                          <FormItem className="flex items-center space-x-2 space-y-0">
                            <FormControl><RadioGroupItem value="principal" /></FormControl>
                            <FormLabel className="font-normal">Principal</FormLabel>
                          </FormItem>
                          <FormItem className="flex items-center space-x-2 space-y-0">
                            <FormControl><RadioGroupItem value="interest" /></FormControl>
                            <FormLabel className="font-normal">Interest</FormLabel>
                          </FormItem>
                        </RadioGroup>
                      </FormControl>
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
