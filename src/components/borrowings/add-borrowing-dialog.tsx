'use client';

import { useState, useTransition } from 'react';
import { Loader2, Landmark } from 'lucide-react';
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
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase/provider';
import { z } from 'zod';
import { Input } from '../ui/input';
import { addDoc, collection } from 'firebase/firestore';
import { cleanForFirestore, formatManualDate, parseManualDate } from '@/lib/utils';
import { useAppUser } from '@/firebase/auth/use-user';
import { Label } from '../ui/label';

const BorrowingSchema = z.object({
  lenderName: z.string().min(2, { message: "Lender name is required and must be at least 2 characters." }),
  principal: z.coerce.number().positive({ message: "Principal amount must be a positive number." }),
  interestRate: z.coerce.number().nonnegative({ message: "Interest rate must be a non-negative number." }),
  dateTaken: z.string().min(1, { message: "A date is required." }),
});

export function AddBorrowingDialog() {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const firestore = useFirestore();
  const appUser = useAppUser();
  
  const [lenderName, setLenderName] = useState('');
  const [principal, setPrincipal] = useState<number | ''>('');
  const [interestRate, setInterestRate] = useState<number | ''>('');
  const [dateTaken, setDateTaken] = useState(formatManualDate(new Date()));
  const [errors, setErrors] = useState<Record<string, string>>({});

  const resetForm = () => {
    setLenderName('');
    setPrincipal('');
    setInterestRate('');
    setDateTaken(formatManualDate(new Date()));
    setErrors({});
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    
    if (!firestore || !appUser?.warehouseId) {
      toast({ title: 'Error', description: 'Could not add record: user or warehouse context is missing.', variant: 'destructive' });
      return;
    }

    const finalDate = parseManualDate(dateTaken);
    if (!finalDate) {
      setErrors(prev => ({ ...prev, dateTaken: 'Invalid format. Use DD-MM-YYYY' }));
      return;
    }

    const validationResult = BorrowingSchema.safeParse({
      lenderName,
      principal,
      interestRate,
      dateTaken
    });

    if (!validationResult.success) {
      const fieldErrors = validationResult.error.flatten().fieldErrors;
      const newErrors: Record<string, string> = {};
      Object.keys(fieldErrors).forEach(key => {
        if (fieldErrors[key]) {
          newErrors[key] = fieldErrors[key]![0];
        }
      });
      setErrors(newErrors);
      return;
    }
    
    const data = validationResult.data;

    startTransition(async () => {
      try {
        const newBorrowing = {
          ...data,
          dateTaken: finalDate,
          status: 'Active' as const,
          warehouseId: appUser.warehouseId,
        };
        await addDoc(collection(firestore, 'borrowings'), cleanForFirestore(newBorrowing));
        toast({ title: 'Success', description: 'Borrowing record added successfully.' });
        setIsOpen(false);
        resetForm();
      } catch (error) {
        console.error(error);
        toast({ title: 'Error', description: 'Failed to add borrowing record.', variant: 'destructive' });
      }
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); if (!open) resetForm(); }}>
      <DialogTrigger asChild>
        <Button variant="default">
          <Landmark className="mr-2" />
          Add Borrowing
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add New Borrowing</DialogTitle>
            <DialogDescription>
              Record a new loan you have taken. Manual date format: DD-MM-YYYY.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="lenderName">Lender's Name</Label>
                <Input id="lenderName" placeholder="e.g., John Doe" value={lenderName} onChange={e => setLenderName(e.target.value)} />
                {errors.lenderName && <p className="text-sm font-medium text-destructive">{errors.lenderName}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="dateTaken">Date Taken (DD-MM-YYYY)</Label>
                <Input id="dateTaken" placeholder="DD-MM-YYYY" value={dateTaken} onChange={e => setDateTaken(e.target.value)} />
                 {errors.dateTaken && <p className="text-sm font-medium text-destructive">{errors.dateTaken}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="principal">Principal Amount</Label>
                <Input id="principal" type="number" step="0.01" placeholder="0.00" value={principal} onChange={e => setPrincipal(e.target.value === '' ? '' : Number(e.target.value))} />
                {errors.principal && <p className="text-sm font-medium text-destructive">{errors.principal}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="interestRate">Monthly Interest Rate (%)</Label>
                <Input id="interestRate" type="number" step="0.01" placeholder="e.g. 2" value={interestRate} onChange={e => setInterestRate(e.target.value === '' ? '' : Number(e.target.value))} />
                 {errors.interestRate && <p className="text-sm font-medium text-destructive">{errors.interestRate}</p>}
              </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline" type="button">Cancel</Button></DialogClose>
            <Button type="submit" disabled={isPending}>
              {isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : 'Save Borrowing'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
