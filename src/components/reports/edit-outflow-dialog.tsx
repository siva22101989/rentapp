
'use client';

import { useState, useTransition, useEffect } from 'react';
import { Loader2, Save } from 'lucide-react';
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
import type { StorageRecord, Outflow } from '@/lib/definitions';
import { useFirestore } from '@/firebase/provider';
import { z } from 'zod';
import { editOutflowEvent } from '@/lib/data';
import { format } from 'date-fns';
import { toDate } from '@/lib/utils';
import { Separator } from '../ui/separator';

const OutflowEditSchema = z.object({
  date: z.string().refine(val => !isNaN(Date.parse(val)), { message: "Invalid date format" }),
  bagsWithdrawn: z.coerce.number().positive('Bags withdrawn must be a positive number.'),
  rentBilled: z.coerce.number().nonnegative('Rent billed must be a non-negative number.'),
  discount: z.coerce.number().nonnegative('Discount must be a non-negative number.').optional(),
  khataAmount: z.coerce.number().nonnegative('Khata amount must be a non-negative number.').optional(),
});

export function EditOutflowDialog({ record, outflow, outflowIndex, children }: { record: StorageRecord, outflow: Outflow, outflowIndex: number, children: React.ReactNode }) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const firestore = useFirestore();

  const [date, setDate] = useState('');
  const [bagsWithdrawn, setBagsWithdrawn] = useState<number | ''>('');
  const [rentBilled, setRentBilled] = useState<number | ''>('');
  const [discount, setDiscount] = useState<number | ''>('');
  const [khataAmount, setKhataAmount] = useState<number | ''>('');

  useEffect(() => {
    if (isOpen) {
      setDate(format(toDate(outflow.date), 'yyyy-MM-dd'));
      setBagsWithdrawn(outflow.bagsWithdrawn);
      setRentBilled(outflow.rentBilled);
      setDiscount(outflow.discount || 0);
      setKhataAmount(record.khataAmount || 0);
    }
  }, [isOpen, outflow, record]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestore) {
      toast({ title: 'Error', description: 'Firestore not available.', variant: 'destructive' });
      return;
    }

    const dataToValidate = {
      date,
      bagsWithdrawn: bagsWithdrawn === '' ? 0 : Number(bagsWithdrawn),
      rentBilled: rentBilled === '' ? 0 : Number(rentBilled),
      discount: discount === '' ? 0 : Number(discount),
      khataAmount: khataAmount === '' ? 0 : Number(khataAmount),
    };

    const result = OutflowEditSchema.safeParse(dataToValidate);

    if (!result.success) {
      const firstError = Object.values(result.error.flatten().fieldErrors)[0]?.[0];
      toast({
        title: "Validation Error",
        description: firstError || "Please check your input.",
        variant: "destructive",
      });
      return;
    }

    startTransition(async () => {
      try {
        const newData = {
          date: new Date(result.data.date),
          bagsWithdrawn: result.data.bagsWithdrawn,
          rentBilled: result.data.rentBilled,
          discount: result.data.discount || 0,
          khataAmount: result.data.khataAmount,
        };
        await editOutflowEvent(firestore, record.id, outflowIndex, newData);
        toast({ title: 'Success', description: 'Outflow bill updated and stock balances recalculated.' });
        setIsOpen(false);
      } catch (error) {
        console.error(error);
        toast({ title: 'Error', description: `Failed to update outflow event. ${error instanceof Error ? error.message : ''}`, variant: 'destructive' });
      }
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[450px]">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>Edit Outflow Bill</DialogTitle>
              <DialogDescription>
                Correct any details for this withdrawal. Changing the bags will automatically update the Patti's current stock balance.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="date">Withdrawal Date</Label>
                <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="bags">Bags Withdrawn</Label>
                    <Input 
                        id="bags" 
                        type="number" 
                        step="0.01" 
                        value={bagsWithdrawn} 
                        onChange={(e) => setBagsWithdrawn(e.target.value === '' ? '' : Number(e.target.value))} 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="rent">Rent Billed</Label>
                    <Input 
                        id="rent" 
                        type="number" 
                        step="0.01" 
                        value={rentBilled} 
                        onChange={(e) => setRentBilled(e.target.value === '' ? '' : Number(e.target.value))} 
                    />
                  </div>
              </div>

              <Separator className="my-2" />

              <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="khata">Khata Amount</Label>
                    <Input 
                        id="khata" 
                        type="number" 
                        step="0.01" 
                        value={khataAmount} 
                        onChange={(e) => setKhataAmount(e.target.value === '' ? '' : Number(e.target.value))} 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="discount">Discount</Label>
                    <Input 
                        id="discount" 
                        type="number" 
                        step="0.01" 
                        value={discount} 
                        onChange={(e) => setDiscount(e.target.value === '' ? '' : Number(e.target.value))} 
                    />
                  </div>
              </div>
            </div>
            <DialogFooter className="gap-2">
              <DialogClose asChild>
                <Button variant="outline">Cancel</Button>
              </DialogClose>
              <Button type="submit" disabled={isPending}>
                {isPending ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>
                ) : (
                  <><Save className="mr-2 h-4 w-4" /> Save Changes</>
                )}
              </Button>
            </DialogFooter>
          </form>
      </DialogContent>
    </Dialog>
  );
}
