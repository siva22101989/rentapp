
'use client';

import { useState, useTransition, useEffect } from 'react';
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
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import type { Expense } from '@/lib/definitions';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { expenseCategories, type ExpenseCategory } from '@/lib/definitions';
import { Textarea } from '../ui/textarea';
import { format } from 'date-fns';
import { toDate, cleanForFirestore } from '@/lib/utils';
import { useFirestore } from '@/firebase/provider';
import { z } from 'zod';
import { doc, updateDoc } from 'firebase/firestore';

const ExpenseSchema = z.object({
  description: z.string().min(2, 'Description is required.'),
  amount: z.coerce.number().positive('Amount must be a positive number.'),
  date: z.string().refine(val => !isNaN(Date.parse(val)), { message: "Invalid date format" }),
  category: z.enum(expenseCategories, { required_error: 'Category is required.' }),
});

export function EditExpenseDialog({ expense, children }: { expense: Expense, children: React.ReactNode }) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const firestore = useFirestore();

  const [date, setDate] = useState('');
  const [category, setCategory] = useState<ExpenseCategory|undefined>(undefined);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState<number|''>('');
  const [errors, setErrors] = useState<Record<string,string>>({});


  useEffect(() => {
    if(isOpen) {
      setDate(format(toDate(expense.date), 'yyyy-MM-dd'));
      setCategory(expense.category);
      setDescription(expense.description);
      setAmount(expense.amount);
      setErrors({});
    }
  }, [expense, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    if (!firestore) {
      toast({ title: 'Error', description: 'Firestore not available.', variant: 'destructive' });
      return;
    }

    const validationResult = ExpenseSchema.safeParse({
      description,
      amount: Number(amount),
      date,
      category
    });

    if (!validationResult.success) {
      const fieldErrors = validationResult.error.flatten().fieldErrors;
      const newErrors: Record<string, string> = {};
      Object.keys(fieldErrors).forEach(key => {
          if (fieldErrors[key as keyof typeof fieldErrors]) newErrors[key] = fieldErrors[key as keyof typeof fieldErrors]![0];
      });
      setErrors(newErrors);
      toast({ title: "Validation Error", description: "Please check your input.", variant: "destructive"});
      return;
    }

    startTransition(async () => {
      try {
        const updatedExpense = {
          ...validationResult.data,
          date: new Date(validationResult.data.date),
        };
        await updateDoc(doc(firestore, 'expenses', expense.id), cleanForFirestore(updatedExpense));
        toast({ title: 'Success', description: 'Expense updated successfully.' });
        setIsOpen(false);
      } catch (error) {
        console.error(error);
        toast({ title: 'Error', description: 'Failed to update expense.', variant: 'destructive' });
      }
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit Expense</DialogTitle>
            <DialogDescription>
              Update details for this expense. Reference No is read-only.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="editRefNo">Reference No</Label>
              <Input id="editRefNo" disabled value={expense.refNo || '-'} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Input id="date" type="date" value={date} onChange={e => setDate(e.target.value)} />
              {errors.date && <p className="text-sm font-medium text-destructive">{errors.date}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select onValueChange={(value: ExpenseCategory) => setCategory(value)} value={category}>
                <SelectTrigger id="category"><SelectValue placeholder="Select a category" /></SelectTrigger>
                <SelectContent>
                  {expenseCategories.map(cat => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.category && <p className="text-sm font-medium text-destructive">{errors.category}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" value={description} onChange={e => setDescription(e.target.value)} />
              {errors.description && <p className="text-sm font-medium text-destructive">{errors.description}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="amount">Amount</Label>
              <Input id="amount" type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value === '' ? '' : Number(e.target.value))} />
              {errors.amount && <p className="text-sm font-medium text-destructive">{errors.amount}</p>}
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button type="submit" disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
