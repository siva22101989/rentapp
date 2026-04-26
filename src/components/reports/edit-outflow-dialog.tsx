
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import type { StorageRecord, Outflow } from '@/lib/definitions';
import { useFirestore } from '@/firebase/provider';
import { z } from 'zod';
import { editOutflowEvent } from '@/lib/data';
import { format } from 'date-fns';
import { toDate } from '@/lib/utils';

const OutflowEditSchema = z.object({
  date: z.string().refine(val => !isNaN(Date.parse(val)), { message: "Invalid date format" }),
  discount: z.coerce.number().nonnegative('Discount must be a non-negative number.').optional(),
});

export function EditOutflowDialog({ record, outflow, outflowIndex, children }: { record: StorageRecord, outflow: Outflow, outflowIndex: number, children: React.ReactNode }) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const firestore = useFirestore();

  const [date, setDate] = useState('');
  const [discount, setDiscount] = useState<number | ''>('');

  useEffect(() => {
    if (isOpen) {
      setDate(format(toDate(outflow.date), 'yyyy-MM-dd'));
      setDiscount(outflow.discount || 0);
    }
  }, [isOpen, outflow]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestore) {
      toast({ title: 'Error', description: 'Firestore not available.', variant: 'destructive' });
      return;
    }

    const dataToValidate = {
      date,
      discount: Number(discount)
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
          discount: result.data.discount || 0,
        };
        await editOutflowEvent(firestore, record.id, outflowIndex, newData);
        toast({ title: 'Success', description: 'Outflow event updated successfully.' });
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
      <DialogContent className="sm:max-w-[425px]">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>Edit Outflow Event</DialogTitle>
              <DialogDescription>
                Editing details for outflow on {format(toDate(outflow.date), 'dd MMM yyyy')}. Bags withdrawn ({outflow.bagsWithdrawn}) cannot be changed.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
               <div className="space-y-2">
                <Label htmlFor="date">Withdrawal Date</Label>
                <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="discount">Discount Amount</Label>
                <Input id="discount" type="number" step="0.01" value={discount} onChange={(e) => setDiscount(e.target.value === '' ? '' : Number(e.target.value))} />
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Cancel</Button>
              </DialogClose>
              <Button type="submit" disabled={isPending}>
                {isPending ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>
                ) : (
                  'Save Changes'
                )}
              </Button>
            </DialogFooter>
          </form>
      </DialogContent>
    </Dialog>
  );
}
