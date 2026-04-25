
'use client';

import { useState, useTransition, useEffect } from 'react';
import { Loader2, Banknote } from 'lucide-react';
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
import { doc, setDoc } from 'firebase/firestore';
import { cleanForFirestore } from '@/lib/utils';
import type { WarehouseInfo } from '@/lib/definitions';
import { useAppUser } from '@/firebase/auth/use-user';
import { Label } from '../ui/label';

const InvestmentSchema = z.object({
  capitalInvestment: z.coerce.number().nonnegative('Investment must be a non-negative number.'),
  annualInterestRate: z.coerce.number().nonnegative('Interest rate must be a non-negative number.'),
});

export function ManageInvestmentDialog({ initialData }: { initialData?: WarehouseInfo | null }) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const firestore = useFirestore();
  const appUser = useAppUser();

  const [capitalInvestment, setCapitalInvestment] = useState<number | ''>('');
  const [annualInterestRate, setAnnualInterestRate] = useState<number | ''>('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (initialData && isOpen) {
        setCapitalInvestment(initialData.capitalInvestment || '');
        setAnnualInterestRate(initialData.annualInterestRate || '');
    }
  }, [initialData, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    if (!firestore || !appUser?.warehouseId) {
      toast({ title: 'Error', description: 'User or warehouse context is missing.', variant: 'destructive' });
      return;
    }

    const dataToValidate = {
        capitalInvestment: Number(capitalInvestment),
        annualInterestRate: Number(annualInterestRate),
    };

    const result = InvestmentSchema.safeParse(dataToValidate);
    if (!result.success) {
        const fieldErrors = result.error.flatten().fieldErrors;
        const newErrors: Record<string, string> = {};
        Object.keys(fieldErrors).forEach(key => {
            if(fieldErrors[key as keyof typeof fieldErrors]) newErrors[key] = fieldErrors[key as keyof typeof fieldErrors]![0];
        });
        setErrors(newErrors);
        toast({ title: "Validation Error", description: "Please check your input.", variant: "destructive"});
        return;
    }

    startTransition(async () => {
      try {
        const docRef = doc(firestore, 'warehouses', appUser.warehouseId);
        await setDoc(docRef, cleanForFirestore(result.data), { merge: true });
        toast({ title: 'Success', description: 'Investment details saved.' });
        setIsOpen(false);
      } catch (error) {
        console.error(error);
        toast({ title: 'Error', description: 'Failed to save investment details.', variant: 'destructive' });
      }
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Banknote className="mr-2" />
          Manage Investment
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>Manage Capital Investment</DialogTitle>
              <DialogDescription>
                Set your total investment and annual interest rate to automatically calculate the cost of capital.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-2 py-4">
              <div className="space-y-2">
                <Label htmlFor="capitalInvestment">Total Capital Investment</Label>
                <Input id="capitalInvestment" type="number" placeholder="e.g., 10000000" value={capitalInvestment} onChange={e => setCapitalInvestment(e.target.value === '' ? '' : Number(e.target.value))} />
                {errors.capitalInvestment && <p className="text-sm font-medium text-destructive">{errors.capitalInvestment}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="annualInterestRate">Annual Interest Rate (%)</Label>
                <Input id="annualInterestRate" type="number" step="0.1" placeholder="e.g., 9" value={annualInterestRate} onChange={e => setAnnualInterestRate(e.target.value === '' ? '' : Number(e.target.value))} />
                 {errors.annualInterestRate && <p className="text-sm font-medium text-destructive">{errors.annualInterestRate}</p>}
              </div>
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
                  'Save Investment Details'
                )}
              </Button>
            </DialogFooter>
          </form>
      </DialogContent>
    </Dialog>
  );
}
