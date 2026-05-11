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
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase/provider';
import { z } from 'zod';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import type { Borrowing } from '@/lib/definitions';
import { format } from 'date-fns';
import { toDate, formatManualDate, parseManualDate, cleanForFirestore } from '@/lib/utils';
import { updateBorrowing } from '@/lib/data';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

const BorrowingSchema = z.object({
  lenderName: z.string().min(2, 'Lender name is required.'),
  principal: z.coerce.number().positive('Principal amount must be positive.'),
  interestRate: z.coerce.number().nonnegative('Interest rate must be non-negative.'),
  dateTaken: z.string().min(1, 'Date is required.'),
  status: z.enum(['Active', 'Paid Off']).optional(),
});


export function EditBorrowingDialog({ borrowing, children }: { borrowing: Borrowing; children: React.ReactNode }) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const firestore = useFirestore();

  const [lenderName, setLenderName] = useState('');
  const [principal, setPrincipal] = useState<number|''>('');
  const [interestRate, setInterestRate] = useState<number|''>('');
  const [dateTaken, setDateTaken] = useState('');
  const [status, setStatus] = useState<'Active' | 'Paid Off'>('Active');
  const [errors, setErrors] = useState<Record<string,string>>({});


  useEffect(() => {
    if (isOpen) {
      setLenderName(borrowing.lenderName);
      setPrincipal(borrowing.principal);
      setInterestRate(borrowing.interestRate);
      setDateTaken(formatManualDate(borrowing.dateTaken));
      setStatus(borrowing.status || 'Active');
      setErrors({});
    }
  }, [borrowing, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    if (!firestore) {
      toast({ title: 'Error', description: 'Firestore not available.', variant: 'destructive' });
      return;
    }

    const finalDate = parseManualDate(dateTaken);
    if (!finalDate) {
      setErrors(prev => ({ ...prev, dateTaken: 'Invalid format. Use DD-MM-YYYY' }));
      return;
    }
    
    const validationResult = BorrowingSchema.safeParse({
      lenderName,
      principal: Number(principal),
      interestRate: Number(interestRate),
      dateTaken,
      status,
    });

    if (!validationResult.success) {
      const fieldErrors = validationResult.error.flatten().fieldErrors;
      const newErrors: Record<string, string> = {};
      Object.keys(fieldErrors).forEach(key => {
        if (fieldErrors[key as keyof typeof fieldErrors]) {
          newErrors[key] = fieldErrors[key as keyof typeof fieldErrors]![0];
        }
      });
      setErrors(newErrors);
      return;
    }

    startTransition(async () => {
      try {
        const updatedData = {
          ...validationResult.data,
          dateTaken: finalDate,
        };
        await updateBorrowing(firestore, borrowing.id, updatedData);
        toast({ title: 'Success', description: 'Borrowing record updated successfully.' });
        setIsOpen(false);
      } catch (error) {
        console.error(error);
        toast({ title: 'Error', description: 'Failed to update borrowing record.', variant: 'destructive' });
      }
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit Borrowing</DialogTitle>
            <DialogDescription>
              Update details for the loan from {borrowing.lenderName}.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="lenderName">Lender's Name</Label>
              <Input id="lenderName" value={lenderName} onChange={e => setLenderName(e.target.value)} />
              {errors.lenderName && <p className="text-sm font-medium text-destructive">{errors.lenderName}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="dateTaken">Date Taken (DD-MM-YYYY)</Label>
              <Input id="dateTaken" placeholder="DD-MM-YYYY" value={dateTaken} onChange={e => setDateTaken(e.target.value)} />
              {errors.dateTaken && <p className="text-sm font-medium text-destructive">{errors.dateTaken}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="principal">Principal Amount</Label>
              <Input id="principal" type="number" step="0.01" value={principal} onChange={e => setPrincipal(e.target.value === '' ? '' : Number(e.target.value))} />
              {errors.principal && <p className="text-sm font-medium text-destructive">{errors.principal}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="interestRate">Monthly Interest Rate (%)</Label>
              <Input id="interestRate" type="number" step="0.01" value={interestRate} onChange={e => setInterestRate(e.target.value === '' ? '' : Number(e.target.value))} />
              {errors.interestRate && <p className="text-sm font-medium text-destructive">{errors.interestRate}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select onValueChange={(value: 'Active' | 'Paid Off') => setStatus(value)} value={status}>
                <SelectTrigger id="status"><SelectValue/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Paid Off">Paid Off</SelectItem>
                </SelectContent>
              </Select>
              {errors.status && <p className="text-sm font-medium text-destructive">{errors.status}</p>}
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline" type="button">Cancel</Button></DialogClose>
            <Button type="submit" disabled={isPending}>
              {isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
