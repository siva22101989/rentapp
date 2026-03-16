
'use client';

import { useState, useTransition } from 'react';
import { Loader2, TrendingUp } from 'lucide-react';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { incomeCategories, type Lending, type Payment } from '@/lib/definitions';
import { Textarea } from '../ui/textarea';
import { useFirestore } from '@/firebase/provider';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../ui/form';
import { doc, writeBatch, arrayUnion, collection } from 'firebase/firestore';
import { cleanForFirestore, formatCurrency } from '@/lib/utils';

const IncomeSchema = z.object({
  description: z.string().min(2, 'Description is required.'),
  amount: z.coerce.number().positive('Amount must be a positive number.'),
  date: z.string().refine(val => !isNaN(Date.parse(val)), { message: "Invalid date format" }),
  category: z.enum(incomeCategories, { required_error: 'Category is required.' }),
  lendingId: z.string().optional(),
}).superRefine((data, ctx) => {
    if (data.category === 'Loan Payment Received' && !data.lendingId) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Please select the loan account for this payment.',
            path: ['lendingId'],
        });
    }
});


type IncomeFormData = z.infer<typeof IncomeSchema>;

export function AddIncomeDialog({ lendings }: { lendings: Lending[] }) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const firestore = useFirestore();

  const form = useForm<IncomeFormData>({
    resolver: zodResolver(IncomeSchema),
    defaultValues: {
      description: '',
      amount: undefined,
      date: new Date().toISOString().split('T')[0],
      category: undefined,
      lendingId: undefined,
    },
  });

  const selectedCategory = form.watch('category');
  const isLoanPayment = selectedCategory === 'Loan Payment Received';

  const onSubmit = (data: IncomeFormData) => {
    if (!firestore) {
      toast({ title: 'Error', description: 'Firestore not available.', variant: 'destructive' });
      return;
    }

    startTransition(async () => {
      try {
        const batch = writeBatch(firestore);
        
        const newIncome = {
          description: data.description,
          amount: data.amount,
          date: new Date(data.date),
          category: data.category,
        };
        const incomeRef = doc(collection(firestore, 'otherIncomes'));
        batch.set(incomeRef, cleanForFirestore(newIncome));

        if (data.lendingId && isLoanPayment) {
            const lendingRef = doc(firestore, 'lendings', data.lendingId);
            const newPayment: Payment = {
              amount: data.amount,
              date: new Date(data.date),
              type: 'repayment',
            };
            batch.update(lendingRef, {
                payments: arrayUnion(cleanForFirestore(newPayment))
            });
        }

        await batch.commit();
        
        const successMessage = isLoanPayment 
            ? "Loan payment received and recorded as income."
            : "Income added successfully.";
        toast({ title: 'Success', description: successMessage });

        setIsOpen(false);
        form.reset({
          description: '',
          amount: undefined,
          date: new Date().toISOString().split('T')[0],
          category: undefined,
          lendingId: undefined,
        });
      } catch (error) {
        console.error(error);
        toast({ title: 'Error', description: 'Failed to add income.', variant: 'destructive' });
      }
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="success">
          <TrendingUp className="mr-2" />
          Add Income
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <DialogHeader>
              <DialogTitle>Add Miscellaneous Income</DialogTitle>
              <DialogDescription>
                Record any income received by the business.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-2 py-4">
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {incomeCategories.map(cat => (
                          <SelectItem key={cat} value={cat}>
                            {cat}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

               {isLoanPayment && (
                <FormField
                  control={form.control}
                  name="lendingId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Loan Account (Lending)</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select loan account" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="w-auto min-w-[var(--radix-select-trigger-width)]">
                          {lendings
                            .filter(l => l.status !== 'Paid Off')
                            .map(l => (
                            <SelectItem key={l.id} value={l.id}>
                              {l.borrowerName} ({formatCurrency(l.principal)})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea placeholder="e.g., Interest from John Doe" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" placeholder="0.00" {...field} value={field.value ?? ''} />
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
                  'Save Income'
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
