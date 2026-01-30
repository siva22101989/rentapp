'use client';

import { useState, useTransition, useEffect, useMemo } from 'react';
import { Loader2, PlusCircle, Save, Trash2 } from 'lucide-react';
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
import { cleanForFirestore, formatCurrency, toDate } from '@/lib/utils';
import { Separator } from '../ui/separator';

type EditableCharge = {
    key: number; // For react list key
    description: string;
    date: string; // yyyy-MM-dd format
    amountPerBag: number;
    workerAmountPerBag: number;
};

function calculatePerBagRates(charge: HamaliCharge, bagsForDrying: number): { amountPerBag: number; workerAmountPerBag: number } {
    if (bagsForDrying > 0) {
        return {
            amountPerBag: charge.amount / bagsForDrying,
            workerAmountPerBag: (charge.workerAmount || 0) / bagsForDrying,
        };
    }
    return { amountPerBag: 0, workerAmountPerBag: 0 };
}


export function ManageDryingChargesDialog({ record, children }: { record: DryingRecord; children: React.ReactNode }) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const firestore = useFirestore();
  const isBilled = record.status === 'Billed';

  const [charges, setCharges] = useState<EditableCharge[]>([]);
  
  useEffect(() => {
    if (isOpen) {
        const initialCharges = (record.hamaliCharges || []).map((charge, index) => {
            const { amountPerBag, workerAmountPerBag } = calculatePerBagRates(charge, record.bagsForDrying);
            return {
                key: index,
                description: charge.description,
                date: format(toDate(charge.date), 'yyyy-MM-dd'),
                amountPerBag: isNaN(amountPerBag) ? 0 : amountPerBag,
                workerAmountPerBag: isNaN(workerAmountPerBag) ? 0 : workerAmountPerBag,
            }
        });
      setCharges(initialCharges);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const handleChargeChange = (index: number, field: keyof EditableCharge, value: string | number) => {
      const newCharges = [...charges];
      (newCharges[index] as any)[field] = value;
      setCharges(newCharges);
  };

  const addNewCharge = () => {
      const nextDryingDay = charges.filter(c => c.description.toLowerCase().includes('drying day')).length + 1;
      setCharges([
          ...charges,
          {
              key: Date.now(),
              description: `Drying Day ${nextDryingDay}`,
              date: format(new Date(), 'yyyy-MM-dd'),
              amountPerBag: 0,
              workerAmountPerBag: 0
          }
      ]);
  };
  
  const deleteCharge = (indexToDelete: number) => {
      setCharges(charges.filter((_, index) => index !== indexToDelete));
  };
  
  const { totalCustomerHamali, totalWorkerHamali } = useMemo(() => {
    return charges.reduce((acc, charge) => {
        acc.totalCustomerHamali += (Number(charge.amountPerBag) || 0) * record.bagsForDrying;
        acc.totalWorkerHamali += (Number(charge.workerAmountPerBag) || 0) * record.bagsForDrying;
        return acc;
    }, { totalCustomerHamali: 0, totalWorkerHamali: 0 });
  }, [charges, record.bagsForDrying]);


  const handleSaveChanges = () => {
    if (!firestore || isBilled) return;

    startTransition(async () => {
      try {
        const finalHamaliCharges: HamaliCharge[] = charges.map(charge => ({
            description: charge.description,
            date: new Date(charge.date),
            amount: (Number(charge.amountPerBag) || 0) * record.bagsForDrying,
            workerAmount: (Number(charge.workerAmountPerBag) || 0) * record.bagsForDrying,
        }));
        
        const recordRef = doc(firestore, 'dryingRecords', record.id);
        await updateDoc(recordRef, {
            hamaliCharges: cleanForFirestore(finalHamaliCharges),
            totalDryingHamali: totalCustomerHamali,
            totalWorkerHamali: totalWorkerHamali,
        });

        toast({ title: 'Success', description: 'Hamali charges updated successfully.' });
        setIsOpen(false);
      } catch (error) {
        console.error(error);
        toast({ title: 'Error', description: 'Failed to save changes.', variant: 'destructive' });
      }
    });
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Manage Hamali Charges</DialogTitle>
              <DialogDescription>
                Edit, add, or delete hamali charges for this drying process ({record.bagsForDrying} bags).
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                {charges.map((charge, index) => (
                    <div key={charge.key} className="p-4 border rounded-lg space-y-4 relative">
                        <div className="grid grid-cols-2 gap-4">
                             <div className="space-y-2">
                                <Label>Description</Label>
                                <Input 
                                    value={charge.description} 
                                    onChange={e => handleChargeChange(index, 'description', e.target.value)}
                                    disabled={isBilled}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Date</Label>
                                <Input 
                                    type="date" 
                                    value={charge.date}
                                    onChange={e => handleChargeChange(index, 'date', e.target.value)}
                                    disabled={isBilled}
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                             <div className="space-y-2">
                                <Label>Customer Rate/Bag</Label>
                                <Input 
                                    type="number"
                                    step="0.01"
                                    value={charge.amountPerBag}
                                    onChange={e => handleChargeChange(index, 'amountPerBag', e.target.value)}
                                    disabled={isBilled}
                                />
                            </div>
                             <div className="space-y-2">
                                <Label>Worker Rate/Bag</Label>
                                <Input 
                                    type="number"
                                    step="0.01"
                                    value={charge.workerAmountPerBag}
                                    onChange={e => handleChargeChange(index, 'workerAmountPerBag', e.target.value)}
                                    disabled={isBilled}
                                />
                            </div>
                        </div>
                        {!isBilled && (
                             <Button 
                                type="button" 
                                variant="ghost" 
                                size="icon" 
                                className="absolute top-1 right-1 h-7 w-7"
                                onClick={() => deleteCharge(index)}
                            >
                                <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                        )}
                    </div>
                ))}
                 {!isBilled && (
                    <Button type="button" variant="outline" onClick={addNewCharge} className="w-full">
                        <PlusCircle className="mr-2" /> Add New Charge
                    </Button>
                 )}
            </div>
            <Separator />
            <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center font-semibold">
                    <span>Total Customer Hamali:</span>
                    <span className="font-mono">{formatCurrency(totalCustomerHamali)}</span>
                </div>
                <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Total Worker Payable:</span>
                    <span className="font-mono">{formatCurrency(totalWorkerHamali)}</span>
                </div>
            </div>
            <DialogFooter>
              <DialogClose asChild><Button variant="outline" type="button">Cancel</Button></DialogClose>
              {!isBilled && (
                <Button onClick={handleSaveChanges} disabled={isPending}>
                  {isPending ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>
                  ) : (
                      <><Save className="mr-2 h-4 w-4" /> Save Changes</>
                  )}
                </Button>
              )}
            </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
