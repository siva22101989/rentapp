
'use client';

import { useState, useTransition, useEffect } from 'react';
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
import { expenseCategories, type Borrowing, type Payment, type ExpenseCategory } from '@/lib/definitions';
import { Textarea } from '../ui/textarea';
import { useFirestore } from '@/firebase/provider';
import { z } from 'zod';
import { Label } from '../ui/label';
import { doc, writeBatch, arrayUnion, collection } from 'firebase/firestore';
import { cleanForFirestore, formatCurrency } from '@/lib/utils';
import { useAppUser } from '@/firebase/auth/use-user';

const ExpenseSchema = z.object({
  refNo: z.string().regex(/^\d+$/, 'Reference No must be numerical only.').min(1, 'Reference No is required.'),
  description: z.string().min(2, 'Description is required.'),
  amount: z.coerce.number().positive('Amount must be a positive number.'),
  date: z.string().refine(val => !isNaN(Date.parse(val)), { message: "Invalid date format" }),
  category: z.enum(expenseCategories, { required_error: 'Category is required.' }),
  borrowingId: z.string().optional(),
}).superRefine((data, ctx) => {
    if (data.category === 'Loan Repayment' && !data.borrowingId) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Please select the loan account for this payment.',
            path: ['borrowingId'],
        });
    }
});

export function AddExpenseDialog({ borrowings, nextRefNo }: { borrowings: Borrowing[], nextRefNo: string }) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const firestore = useFirestore();
  const appUser = useAppUser();

  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [category, setCategory] = useState<ExpenseCategory | undefined>(undefined);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState<number | ''>('');
  const [refNo, setRefNo] = useState(nextRefNo);
  const [borrowingId, setBorrowingId] = useState<string | undefined>(undefined);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen) setRefNo(nextRefNo);
  }, [isOpen, nextRefNo]);

  const isLoanPayment = category === 'Loan Repayment';
  
  const resetForm = () => {
    setDate(new Date().toISOString().split('T')[0]);
    setCategory(undefined);
    setDescription('');
    setAmount('');
    setRefNo(nextRefNo);
    setBorrowingId(undefined);
    setErrors({});
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    if (!firestore || !appUser?.warehouseId) {
      toast({ title: 'Error', description: 'Could not add expense: user or warehouse context is missing.', variant: 'destructive' });
      return;
    }

    const dataToValidate = {
        refNo,
        description,
        amount: Number(amount),
        date,
        category,
        borrowingId,
    };

    const validationResult = ExpenseSchema.safeParse(dataToValidate);
    if (!validationResult.success) {
        const fieldErrors = validationResult.error.flatten().fieldErrors;
        const newErrors: Record<string, string> = {};
        Object.keys(fieldErrors).forEach(key => {
          const errorKey = key as keyof typeof fieldErrors;
          if (fieldErrors[errorKey]) {
            newErrors[key] = fieldErrors[errorKey]![0];
          }
        });
        setErrors(newErrors);
        toast({ title: "Validation Error", description: "Please check your input.", variant: "destructive"});
        return;
    }
    
    const data = validationResult.data;

    startTransition(async () => {
      try {
        const batch = writeBatch(firestore);
        
        let finalDescription = data.description;
        if (data.borrowingId && isLoanPayment) {
            const borrowing = borrowings.find(b => b.id === data.borrowingId);
            if (borrowing) {
                finalDescription = `Payment to ${borrowing.lenderName}: ${data.description}`;
            }
        }

        const newExpense = {
          refNo: data.refNo,
          description: finalDescription,
          amount: data.amount,
          date: new Date(data.date),
          category: data.category,
          warehouseId: appUser.warehouseId,
        };
        const expenseRef = doc(collection(firestore, 'expenses'));
        batch.set(expenseRef, cleanForFirestore(newExpense));

        if (data.borrowingId && isLoanPayment) {
            const borrowingRef = doc(firestore, 'borrowings', data.borrowingId);
            const newPayment: Payment = {
              amount: data.amount,
              date: new Date(data.date),
              type: 'repayment',
            };
            batch.update(borrowingRef, {
                payments: arrayUnion(cleanForFirestore(newPayment))
            });
        }

        await batch.commit();
        
        toast({ title: 'Success', description: "Expense added successfully." });

        setIsOpen(false);
        resetForm();
      } catch (error) {
        console.error(error);
        toast({ title: 'Error', description: 'Failed to add expense.', variant: 'destructive' });
      }
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); if (!open) resetForm(); }}>
      <DialogTrigger asChild>
        <Button variant="default">
          <PlusCircle className="mr-2" />
          Add Expense
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>Add New Expense</DialogTitle>
              <DialogDescription>
                Enter the details for the new expense.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto pr-2">
              <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="refNo">Voucher / Ref No</Label>
                    <Input id="refNo" type="number" value={refNo} onChange={e => setRefNo(e.target.value)} />
                    {errors.refNo && <p className="text-sm font-medium text-destructive">{errors.refNo}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="date">Date</Label>
                    <Input type="date" id="date" value={date} onChange={e => setDate(e.target.value)} />
                    {errors.date && <p className="text-sm font-medium text-destructive">{errors.date}</p>}
                  </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select onValueChange={(value: ExpenseCategory) => setCategory(value)} value={category}>
                  <SelectTrigger id="category"><SelectValue placeholder="Select a category" /></SelectTrigger>
                  <SelectContent>
                    {expenseCategories.map(cat => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.category && <p className="text-sm font-medium text-destructive">{errors.category}</p>}
              </div>

              {isLoanPayment && (
                <div className="space-y-2">
                  <Label htmlFor="borrowingId">Loan Account (Borrowing)</Label>
                  <Select onValueChange={setBorrowingId} value={borrowingId}>
                    <SelectTrigger id="borrowingId"><SelectValue placeholder="Select loan to pay against" /></SelectTrigger>
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
                  {errors.borrowingId && <p className="text-sm font-medium text-destructive">{errors.borrowingId}</p>}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" placeholder="e.g., Petrol for generator" value={description} onChange={e => setDescription(e.target.value)} />
                {errors.description && <p className="text-sm font-medium text-destructive">{errors.description}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="amount">Amount</Label>
                <Input id="amount" type="number" step="0.01" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value === '' ? '' : Number(e.target.value))} />
                {errors.amount && <p className="text-sm font-medium text-destructive">{errors.amount}</p>}
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild><Button variant="outline" type="button">Cancel</Button></DialogClose>
              <Button type="submit" disabled={isPending}>
                {isPending ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>
                ) : (
                  'Save Expense'
                )}
              </Button>
            </DialogFooter>
          </form>
      </DialogContent>
    </Dialog>
  );
}
