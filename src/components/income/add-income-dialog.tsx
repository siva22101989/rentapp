
'use client';

import { useState, useTransition, useEffect } from 'react';
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
  refNo: z.string().min(1, 'Reference No is required.'),
  description: z.string().min(2, 'Description is required.'),
  amount: z.coerce.number().positive('Amount must be a positive number.'),
  date: z.string().min(1, "Date is required."),
  category: z.enum(incomeCategories, { required_error: 'Category is required.' }),
  lendingId: z.string().optional(),
  lorryTractorNo: z.string().optional(),
}).superRefine((data, ctx) => {
    if ((data.category === 'Loan Payment Received') && !data.lendingId) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Please select the loan account for this payment.',
            path: ['lendingId'],
        });
    }
});

export function AddIncomeDialog({ lendings, nextRefNo }: { lendings: Lending[], nextRefNo: string }) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const firestore = useFirestore();
  const appUser = useAppUser();

  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [category, setCategory] = useState<IncomeCategory | undefined>(undefined);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState<number | ''>('');
  const [refNo, setRefNo] = useState(nextRefNo);
  const [lendingId, setLendingId] = useState<string | undefined>(undefined);
  const [vehicleType, setVehicleType] = useState<'Lorry' | 'Tractor' | ''>('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  useEffect(() => {
    if (isOpen) setRefNo(nextRefNo);
  }, [isOpen, nextRefNo]);

  const isLoanPayment = category === 'Loan Payment Received';
  const isKhataIncome = category === 'Khata Income';

  const resetForm = () => {
    setDate(new Date().toISOString().split('T')[0]);
    setCategory(undefined);
    setDescription('');
    setAmount('');
    setRefNo(nextRefNo);
    setLendingId(undefined);
    setVehicleType('');
    setErrors({});
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    if (!firestore || !appUser?.warehouseId) {
      toast({ title: 'Error', description: 'User or warehouse context is missing.', variant: 'destructive' });
      return;
    }

    const dataToValidate = { 
      refNo, 
      description, 
      amount: Number(amount), 
      date, 
      category, 
      lendingId, 
      lorryTractorNo: isKhataIncome ? vehicleType : undefined 
    };

    const validationResult = IncomeSchema.safeParse(dataToValidate);
    if(!validationResult.success) {
        const fieldErrors = validationResult.error.flatten().fieldErrors;
        const newErrors: Record<string, string> = {};
        Object.keys(fieldErrors).forEach(key => {
            if (fieldErrors[key as keyof typeof fieldErrors]) newErrors[key] = fieldErrors[key as keyof typeof fieldErrors]![0];
        });
        setErrors(newErrors);
        return;
    }
    
    const data = validationResult.data;

    startTransition(async () => {
      try {
        const batch = writeBatch(firestore);
        const finalDate = new Date(data.date);
        
        let finalDescription = data.description;
        if (data.lendingId && isLoanPayment) {
            const lending = lendings.find(l => l.id === data.lendingId);
            if (lending) {
                finalDescription = `${data.category} from ${lending.borrowerName}: ${data.description}`;
            }
        } else if (isKhataIncome && vehicleType) {
            finalDescription = `${vehicleType} Khata: ${data.description}`;
        }

        const newIncome = {
          refNo: data.refNo,
          description: finalDescription,
          amount: data.amount,
          date: finalDate,
          category: data.category,
          lorryTractorNo: isKhataIncome ? vehicleType : undefined,
          warehouseId: appUser.warehouseId,
        };
        const incomeRef = doc(collection(firestore, 'otherIncomes'));
        batch.set(incomeRef, cleanForFirestore(newIncome));

        if (data.lendingId && isLoanPayment) {
            const lendingRef = doc(firestore, 'lendings', data.lendingId);
            const newPayment: Payment = {
              amount: data.amount,
              date: finalDate,
              type: 'repayment',
            };
            batch.update(lendingRef, {
                payments: arrayUnion(cleanForFirestore(newPayment))
            });
        }

        await batch.commit();
        toast({ title: 'Success', description: "Income added successfully." });
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
        <Button variant="default" className="text-sm">
          <TrendingUp className="mr-2 h-4 w-4" />
          Add Income
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>Add Miscellaneous Income</DialogTitle>
              <DialogDescription className="text-xs">
                Reference No (Numerical) is auto-generated.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto pr-2">
              <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="incRefNo" className="text-xs">Ref No</Label>
                    <Input id="incRefNo" disabled={true} className="bg-muted font-mono font-bold text-sm cursor-not-allowed" value={refNo} readOnly />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="incDate" className="text-xs">Income Date</Label>
                    <Input id="incDate" type="date" value={date} onChange={e => setDate(e.target.value)} className="text-sm" />
                    {errors.date && <p className="text-[10px] font-medium text-destructive">{errors.date}</p>}
                  </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="category" className="text-xs">Category</Label>
                <Select onValueChange={(value: IncomeCategory) => setCategory(value)} value={category}>
                    <SelectTrigger id="category" className="text-sm"><SelectValue placeholder="Select a category" /></SelectTrigger>
                  <SelectContent>
                    {incomeCategories.map(cat => (
                      <SelectItem key={cat} value={cat} className="text-sm">
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.category && <p className="text-[10px] font-medium text-destructive">{errors.category}</p>}
              </div>

               {isLoanPayment && (
                <div className="space-y-1.5">
                    <Label htmlFor="lendingId" className="text-xs">Loan Account (Lending)</Label>
                    <Select onValueChange={setLendingId} value={lendingId}>
                        <SelectTrigger id="lendingId" className="text-sm"><SelectValue placeholder="Select loan account" /></SelectTrigger>
                        <SelectContent>
                        {lendings
                            .filter(l => l.status !== 'Paid Off')
                            .map(l => (
                            <SelectItem key={l.id} value={l.id} className="text-sm">
                                {l.borrowerName} ({formatCurrency(b.principal)})
                            </SelectItem>
                        ))}
                        </SelectContent>
                    </Select>
                    {errors.lendingId && <p className="text-[10px] font-medium text-destructive">{errors.lendingId}</p>}
                </div>
              )}

              {isKhataIncome && (
                <div className="space-y-1.5">
                  <Label htmlFor="vehicleType" className="text-xs">Vehicle Type</Label>
                  <Select onValueChange={(v: any) => setVehicleType(v)} value={vehicleType}>
                      <SelectTrigger id="vehicleType" className="text-sm"><SelectValue placeholder="Select Lorry or Tractor" /></SelectTrigger>
                      <SelectContent>
                          <SelectItem value="Lorry" className="text-sm">Lorry</SelectItem>
                          <SelectItem value="Tractor" className="text-sm">Tractor</SelectItem>
                      </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="description" className="text-xs">Description</Label>
                <Textarea id="description" placeholder="e.g., Weighbridge charges" value={description} onChange={e => setDescription(e.target.value)} className="text-sm min-h-[60px]" />
                {errors.description && <p className="text-[10px] font-medium text-destructive">{errors.description}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="amount" className="text-xs">Amount</Label>
                <Input id="amount" type="number" step="0.01" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value === '' ? '' : Number(e.target.value))} className="text-sm" />
                {errors.amount && <p className="text-[10px] font-medium text-destructive">{errors.amount}</p>}
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild><Button variant="outline" type="button" className="text-sm">Cancel</Button></DialogClose>
              <Button type="submit" disabled={isPending} className="text-sm">
                {isPending ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>
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
