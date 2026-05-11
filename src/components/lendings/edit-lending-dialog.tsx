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
import type { Lending } from '@/lib/definitions';
import { format } from 'date-fns';
import { toDate, formatManualDate, parseManualDate, cleanForFirestore } from '@/lib/utils';
import { updateLending } from '@/lib/data';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

const LendingSchema = z.object({
  borrowerName: z.string().min(2, 'Borrower name is required.'),
  principal: z.coerce.number().positive('Principal amount must be positive.'),
  interestRate: z.coerce.number().nonnegative('Interest rate must be non-negative.'),
  dateGiven: z.string().min(1, 'Date is required.'),
  status: z.enum(['Active', 'Paid Off']).optional(),
});

export function EditLendingDialog({ lending, children }: { lending: Lending; children: React.ReactNode }) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const firestore = useFirestore();

  const [borrowerName, setBorrowerName] = useState('');
  const [principal, setPrincipal] = useState<number|''>('');
  const [interestRate, setInterestRate] = useState<number|''>('');
  const [dateGiven, setDateGiven] = useState('');
  const [status, setStatus] = useState<'Active' | 'Paid Off'>('Active');
  const [errors, setErrors] = useState<Record<string,string>>({});

  useEffect(() => {
    if (isOpen) {
      setBorrowerName(lending.borrowerName);
      setPrincipal(lending.principal);
      setInterestRate(lending.interestRate);
      setDateGiven(formatManualDate(lending.dateGiven));
      setStatus(lending.status || 'Active');
      setErrors({});
    }
  }, [lending, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    if (!firestore) {
      toast({ title: 'Error', description: 'Firestore not available.', variant: 'destructive' });
      return;
    }

    const finalDate = parseManualDate(dateGiven);
    if (!finalDate) {
      setErrors(prev => ({ ...prev, dateGiven: 'Invalid format. Use DD-MM-YYYY' }));
      return;
    }

    const validationResult = LendingSchema.safeParse({
      borrowerName,
      principal: Number(principal),
      interestRate: Number(interestRate),
      dateGiven,
      status,
    });

    if (!validationResult.success) {
        const fieldErrors = validationResult.error.flatten().fieldErrors;
        const newErrors: Record<string, string> = {};
        Object.keys(fieldErrors).forEach(key => {
            if (fieldErrors[key as keyof typeof fieldErrors]) newErrors[key] = fieldErrors[key as keyof typeof fieldErrors]![0];
        });
        setErrors(newErrors);
        return;
    }

    startTransition(async () => {
      try {
        const updatedData = {
          ...validationResult.data,
          dateGiven: finalDate,
        };
        await updateLending(firestore, lending.id, updatedData);
        toast({ title: 'Success', description: 'Lending record updated successfully.' });
        setIsOpen(false);
      } catch (error) {
        console.error(error);
        toast({ title: 'Error', description: 'Failed to update lending record.', variant: 'destructive' });
      }
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>Edit Lending</DialogTitle>
              <DialogDescription>
                Update details for the loan to {lending.borrowerName}. Date format: DD-MM-YYYY.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
                <div className="space-y-2">
                    <Label htmlFor="borrowerName">Borrower's Name</Label>
                    <Input id="borrowerName" value={borrowerName} onChange={(e) => setBorrowerName(e.target.value)} />
                    {errors.borrowerName && <p className="text-sm font-medium text-destructive">{errors.borrowerName}</p>}
                </div>
                <div className="space-y-2">
                    <Label htmlFor="dateGiven">Date Given (DD-MM-YYYY)</Label>
                    <Input id="dateGiven" placeholder="DD-MM-YYYY" value={dateGiven} onChange={(e) => setDateGiven(e.target.value)} />
                    {errors.dateGiven && <p className="text-sm font-medium text-destructive">{errors.dateGiven}</p>}
                </div>
                <div className="space-y-2">
                    <Label htmlFor="principal">Principal Amount</Label>
                    <Input id="principal" type="number" step="0.01" value={principal} onChange={(e) => setPrincipal(e.target.value === '' ? '' : Number(e.target.value))} />
                    {errors.principal && <p className="text-sm font-medium text-destructive">{errors.principal}</p>}
                </div>
                <div className="space-y-2">
                    <Label htmlFor="interestRate">Monthly Interest Rate (%)</Label>
                    <Input id="interestRate" type="number" step="0.01" value={interestRate} onChange={(e) => setInterestRate(e.target.value === '' ? '' : Number(e.target.value))} />
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
