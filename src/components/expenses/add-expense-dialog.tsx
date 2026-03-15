
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
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { expenseCategories, type Borrowing, type Payment } from '@/lib/definitions';
import { Textarea } from '../ui/textarea';
import { useFirestore } from '@/firebase/provider';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../ui/form';
import { doc, writeBatch, arrayUnion, collection } from 'firebase/firestore';
import { cleanForFirestore, formatCurrency } from '@/lib/utils';

const ExpenseSchema = z.object({
  description: z.string().min(2, 'Description is required.'),
  amount: z.coerce.number().positive('Amount must be a positive number.'),
  date: z.string().refine(val => !isNaN(Date.parse(val)), { message: "Invalid date format" }),
  category: z.enum(expenseCategories, { required_error: 'Category is required.' }),
  borrowingId: z.string().optional(),
}).superRefine((data, ctx) => {
    if ((data.category === 'Interest Paid' || data.category === 'Principal Repayment') && !data.borrowingId) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Please select the loan account for this payment.',
            path: ['borrowingId'],
        });
    }
});


type ExpenseFormData = z.infer<typeof ExpenseSchema>;

export function AddExpenseDialog({ borrowings }: { borrowings: Borrowing[] }) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const firestore = useFirestore();

  const form = useForm<ExpenseFormData>({
    resolver: zodResolver(ExpenseSchema),
    defaultValues: {
      description: '',
      amount: '',
      date: new Date().toISOString().split('T')[0],
      category: undefined,
      borrowingId: undefined,
    },
  });

  const selectedCategory = form.watch('category');
  const isLoanPayment = selectedCategory === 'Interest Paid' || selectedCategory === 'Principal Repayment';

  const onSubmit = (data: ExpenseFormData) => {
    if (!firestore) {
      toast({ title: 'Error', description: 'Firestore not available.', variant: 'destructive' });
      return;
    }

    startTransition(async () => {
      try {
        const batch = writeBatch(firestore);
        
        const newExpense = {
          description: data.description,
          amount: data.amount,
          date: new Date(data.date),
          category: data.category,
        };
        const expenseRef = doc(collection(firestore, 'expenses'));
        batch.set(expenseRef, cleanForFirestore(newExpense));

        if (data.borrowingId && isLoanPayment) {
            const borrowingRef = doc(firestore, 'borrowings', data.borrowingId);
            const newPayment: Payment = {
              amount: data.amount,
              date: new Date(data.date),
              type: data.category === 'Interest Paid' ? 'interest' : 'principal',
            };
            batch.update(borrowingRef, {
                payments: arrayUnion(cleanForFirestore(newPayment))
            });
        }

        await batch.commit();
        
        const successMessage = isLoanPayment 
            ? "Loan payment recorded as an expense."
            : "Expense added successfully.";
        toast({ title: 'Success', description: successMessage });

        setIsOpen(false);
        form.reset();
      } catch (error) {
        console.error(error);
        toast({ title: 'Error', description: 'Failed to add expense.', variant: 'destructive' });
      }
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive">
          <PlusCircle className="mr-2" />
          Add Expense
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <DialogHeader>
              <DialogTitle>Add New Expense</DialogTitle>
              <DialogDescription>
                Enter the details for the new expense.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
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
                        {expenseCategories.map(cat => (
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
                  name="borrowingId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Loan Account (Borrowing)</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select loan to pay against" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {borrowings
                            .filter(b => b.status !== 'Paid Off')
                            .map(b => (
                            <SelectItem key={b.id} value={b.id}>
                              {b.lenderName} ({formatCurrency(b.principal)})
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
                      <Textarea placeholder="e.g., Petrol for generator" {...field} />
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
                  'Save Expense'
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
