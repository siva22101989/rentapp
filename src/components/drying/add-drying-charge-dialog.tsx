'use client';

import { useState, useTransition, useMemo } from 'react';
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
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase';
import type { DryingRecord, HamaliCharge } from '@/lib/definitions';
import { doc, updateDoc } from 'firebase/firestore';
import { format } from 'date-fns';
import { toDate, cleanForFirestore, formatCurrency } from '@/lib/utils';
import { Separator } from '../ui/separator';

export function AddDryingChargeDialog({ record, children }: { record: DryingRecord; children: React.ReactNode }) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const firestore = useFirestore();
  const isBilled = record.status === 'Billed';

  const [description, setDescription] = useState('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [customerRate, setCustomerRate] = useState<number | ''>('');
  const [workerRate, setWorkerRate] = useState<number | ''>('');
  const [error, setError] = useState<string | null>(null);

  const bagsForDrying = record.bagsForDrying;
  const newCustomerAmount = useMemo(() => (Number(customerRate) || 0) * bagsForDrying, [customerRate, bagsForDrying]);
  const newWorkerAmount = useMemo(() => (Number(workerRate) || 0) * bagsForDrying, [workerRate, bagsForDrying]);


  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    if (!description || description.length < 3) {
      setError('Description must be at least 3 characters.');
      return;
    }
    if ((Number(customerRate) || 0) < 0 || (Number(workerRate) || 0) < 0) {
      setError('Rates must be non-negative.');
      return;
    }
     if ((Number(customerRate) || 0) === 0 && (Number(workerRate) || 0) === 0) {
      setError('At least one rate must be greater than zero.');
      return;
    }
    if (!firestore) {
      toast({ title: 'Error', description: 'Firestore not available.', variant: 'destructive' });
      return;
    }
    if (isBilled) {
      toast({ title: 'Error', description: 'Cannot add charges to a billed record.', variant: 'destructive' });
      return;
    }
    
    startTransition(async () => {
      try {
        const recordRef = doc(firestore, 'dryingRecords', record.id);
        
        const newCharge: HamaliCharge = {
          description,
          date: new Date(date),
          amount: newCustomerAmount,
          workerAmount: newWorkerAmount,
        };

        const newHamaliCharges = [...(record.hamaliCharges || []), newCharge];
        const newTotalDryingHamali = newHamaliCharges.reduce((acc, charge) => acc + charge.amount, 0);
        const newTotalWorkerHamali = newHamaliCharges.reduce((acc, charge) => acc + (charge.workerAmount || 0), 0);

        await updateDoc(recordRef, {
          hamaliCharges: cleanForFirestore(newHamaliCharges),
          totalDryingHamali: newTotalDryingHamali,
          totalWorkerHamali: newTotalWorkerHamali,
        });

        toast({ title: 'Success', description: 'New charge added successfully.' });
        setIsOpen(false);
        // Reset state
        setDescription('');
        setDate(format(new Date(), 'yyyy-MM-dd'));
        setCustomerRate('');
        setWorkerRate('');

      } catch (error) {
        console.error(error);
        toast({ title: 'Error', description: 'Failed to add charge.', variant: 'destructive' });
      }
    });
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>Add Extra Charge</DialogTitle>
              <DialogDescription>
                Add a new hamali charge for this drying process. The amount will be calculated per bag.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4">
                <p className="text-sm font-medium">
                    Applying charges for <span className="font-bold text-primary">{bagsForDrying}</span> bags.
                </p>
                <div className="space-y-2">
                    <Label htmlFor="description">Charge Description</Label>
                    <Input id="description" placeholder="e.g., Packing Charge, Drying Day 2" value={description} onChange={(e) => setDescription(e.target.value)} disabled={isBilled} />
                </div>
                 <div className="space-y-2">
                    <Label htmlFor="date">Charge Date</Label>
                    <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} disabled={isBilled} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="customerRate">Customer Rate/Bag</Label>
                        <Input id="customerRate" type="number" step="0.01" placeholder="0.00" value={customerRate} onChange={(e) => setCustomerRate(e.target.valueAsNumber || '')} disabled={isBilled} />
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="workerRate">Worker Rate/Bag</Label>
                        <Input id="workerRate" type="number" step="0.01" placeholder="0.00" value={workerRate} onChange={(e) => setWorkerRate(e.target.valueAsNumber || '')} disabled={isBilled} />
                    </div>
                </div>
                {error && <p className="text-sm font-medium text-destructive">{error}</p>}
                 <Separator />
                 <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Total Customer Charge:</span>
                        <span className="font-medium">{formatCurrency(newCustomerAmount)}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Total Worker Payable:</span>
                        <span className="font-medium">{formatCurrency(newWorkerAmount)}</span>
                    </div>
                </div>
            </div>
            <DialogFooter>
              <DialogClose asChild><Button variant="outline" type="button">Cancel</Button></DialogClose>
              {!isBilled && (
                <Button type="submit" disabled={isPending}>
                  {isPending ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>
                  ) : (
                      <><PlusCircle className="mr-2 h-4 w-4" /> Add Charge</>
                  )}
                </Button>
              )}
            </DialogFooter>
          </form>
      </DialogContent>
    </Dialog>
  );
}
