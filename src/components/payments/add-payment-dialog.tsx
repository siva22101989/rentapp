'use client';

import { useState, useTransition } from 'react';
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
import { useToast } from '@/hooks/use-toast';
import type { StorageRecord } from '@/lib/definitions';
import { formatCurrency } from '@/lib/utils';
import { useFirestore } from '@/firebase';
import { doc, updateDoc, arrayUnion, Timestamp } from 'firebase/firestore';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../ui/form';
import { Separator } from '../ui/separator';

const PaymentSchema = z.object({
  paymentDate: z.string().refine(val => !isNaN(Date.parse(val)), { message: "Invalid date" }),
  payForHamali: z.coerce.number().nonnegative('Must be a positive number').optional(),
  payForRent: z.coerce.number().nonnegative('Must be a positive number').optional(),
}).refine(data => (data.payForHamali && data.payForHamali > 0) || (data.payForRent && data.payForRent > 0), {
  message: "At least one payment amount is required.",
  path: ["payForHamali"],
});

type PaymentFormData = z.infer<typeof PaymentSchema>;

type AddPaymentDialogProps = {
    record: StorageRecord & {
        balanceDue: number;
        hamaliPending: number;
        rentPending: number;
    }
};

export function AddPaymentDialog({ record }: AddPaymentDialogProps) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const firestore = useFirestore();

  const form = useForm<PaymentFormData>({
    resolver: zodResolver(PaymentSchema),
    defaultValues: {
        paymentDate: new Date().toISOString().split('T')[0],
        payForHamali: undefined,
        payForRent: undefined,
    },
  });

  const onSubmit = (data: PaymentFormData) => {
    if (!firestore) {
      toast({ title: 'Error', description: 'Firestore not available.', variant: 'destructive' });
      return;
    }

    startTransition(async () => {
      try {
        const newPayments = [];
        const paymentDate = Timestamp.fromDate(new Date(data.paymentDate));

        if (data.payForHamali && data.payForHamali > 0) {
          newPayments.push({
            amount: data.payForHamali,
            date: paymentDate,
            type: 'hamali',
          });
        }
        if (data.payForRent && data.payForRent > 0) {
          newPayments.push({
            amount: data.payForRent,
            date: paymentDate,
            type: 'rent',
          });
        }

        if (newPayments.length === 0) {
          toast({ title: 'Info', description: 'No payment amount entered.' });
          return;
        }

        const recordRef = doc(firestore, 'storageRecords', record.id);
        await updateDoc(recordRef, {
          payments: arrayUnion(...newPayments)
        });

        toast({ title: 'Success', description: 'Payment recorded successfully.' });
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
      <DialogTrigger asChild>
        <Button size="sm">Add Payment</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
            <DialogHeader>
                <DialogTitle>Record a Payment</DialogTitle>
                <DialogDescription>
                For storage record {record.id}. The total amount due is {formatCurrency(record.balanceDue)}.
                </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
                <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Hamali Pending</span>
                    <span className="font-medium text-orange-600">{formatCurrency(record.hamaliPending)}</span>
                </div>
                <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Rent Pending</span>
                    <span className="font-medium text-blue-600">{formatCurrency(record.rentPending)}</span>
                </div>
                <Separator className="my-2" />

                <FormField
                    control={form.control}
                    name="paymentDate"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Payment Date</FormLabel>
                            <FormControl>
                                <Input 
                                    type="date"
                                    {...field}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="payForHamali"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Pay towards Hamali</FormLabel>
                            <FormControl>
                                <Input 
                                    type="number" 
                                    step="0.01" 
                                    placeholder="0.00" 
                                    max={record.hamaliPending}
                                    {...field}
                                    value={field.value ?? ''}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                 <FormField
                    control={form.control}
                    name="payForRent"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Pay towards Rent</FormLabel>
                            <FormControl>
                                 <Input 
                                    type="number" 
                                    step="0.01" 
                                    placeholder="0.00" 
                                    max={record.rentPending}
                                    {...field}
                                    value={field.value ?? ''}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

            </div>
            <DialogFooter>
                <DialogClose asChild>
                    <Button variant="outline" type="button">Cancel</Button>
                </DialogClose>
                <Button type="submit" disabled={isPending}>
                {isPending ? (
                    <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                    </>
                ) : (
                    'Record Payment'
                )}
                </Button>
            </DialogFooter>
            </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
