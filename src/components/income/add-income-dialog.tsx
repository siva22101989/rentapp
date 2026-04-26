
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
import { incomeCategories, type Lending, type Payment, type IncomeCategory } from '@/lib/definitions';
import { Textarea } from '../ui/textarea';
import { useFirestore } from '@/firebase/provider';
import { z } from 'zod';
import { Label } from '../ui/label';
import { doc, writeBatch, arrayUnion, collection } from 'firebase/firestore';
import { cleanForFirestore, formatCurrency } from '@/lib/utils';
import { useAppUser } from '@/firebase/auth/use-user';

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

export function AddIncomeDialog({ lendings }: { lendings: Lending[] }) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const firestore = useFirestore();
  const appUser = useAppUser();

  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [category, setCategory] = useState<IncomeCategory | undefined>(undefined);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState<number | ''>('');
  const [lendingId, setLendingId] = useState<string | undefined>(undefined);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const isLoanPayment = category === 'Loan Payment Received';

  const resetForm = () => {
    setDate(new Date().toISOString().split('T')[0]);
    setCategory(undefined);
    setDescription('');
    setAmount('');
    setLendingId(undefined);
    setErrors({});
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    if (!firestore || !appUser?.warehouseId) {
      toast({ title: 'Error', description: 'Could not add income: user or warehouse context is missing.', variant: 'destructive' });
      return;
    }

    const dataToValidate = { description, amount, date, category, lendingId };

    const validationResult = IncomeSchema.safeParse(dataToValidate);
    if(!validationResult.success) {
        const fieldErrors = validationResult.error.flatten().fieldErrors;
        const newErrors: Record<string, string> = {};
        Object.keys(fieldErrors).forEach(key => {
            if (fieldErrors[key as keyof typeof fieldErrors]) newErrors[key] = fieldErrors[key as keyof typeof fieldErrors]![0];
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
        if (data.lendingId && isLoanPayment) {
            const lending = lendings.find(l => l.id === data.lendingId);
            if (lending) {
                finalDescription = `Payment from ${lending.borrowerName}: ${data.description}`;
            }
        }

        const newIncome = {
          description: finalDescription,
          amount: data.amount,
          date: new Date(data.date),
          category: data.category,
          warehouseId: appUser.warehouseId,
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
        resetForm();
      } catch (error) {
        console.error(error);
        toast({ title: 'Error', description: 'Failed to add income.', variant: 'destructive' });
      }
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); if(!open) resetForm(); }}>
      <DialogTrigger asChild>
        <Button variant="default">
          <TrendingUp className="mr-2" />
          Add Income
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>Add Miscellaneous Income</DialogTitle>
              <DialogDescription>
                Record any income received by the business.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-2 py-4">
              <div className="space-y-2">
                <Label htmlFor="date">Date</Label>
                <Input id="date" type="date" value={date} onChange={e => setDate(e.target.value)} />
                {errors.date && <p className="text-sm font-medium text-destructive">{errors.date}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select onValueChange={(value: IncomeCategory) => setCategory(value)} value={category}>
                    <SelectTrigger id="category"><SelectValue placeholder="Select a category" /></SelectTrigger>
                  <SelectContent>
                    {incomeCategories.map(cat => (
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
                    <Label htmlFor="lendingId">Loan Account (Lending)</Label>
                    <Select onValueChange={setLendingId} value={lendingId}>
                        <SelectTrigger id="lendingId"><SelectValue placeholder="Select loan account" /></SelectTrigger>
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
                    {errors.lendingId && <p className="text-sm font-medium text-destructive">{errors.lendingId}</p>}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" placeholder="e.g., Interest from John Doe" value={description} onChange={e => setDescription(e.target.value)} />
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
      </DialogContent>
    </Dialog>
  );
}
