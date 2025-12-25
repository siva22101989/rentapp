'use client';

import { useState, useTransition, useMemo, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import type { DryingRecord, HamaliCharge } from '@/lib/definitions';
import { doc, updateDoc, increment, arrayUnion, Timestamp } from 'firebase/firestore';
import { formatCurrency, toDate } from '@/lib/utils';
import { differenceInDays, addDays } from 'date-fns';
import { useFirestore } from '@/firebase';

const HamaliSchema = z.object({
  hamaliPerBag: z.coerce.number().positive('Rate must be a positive number.'),
  chargeDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "A valid date is required.",
  }),
});

type HamaliFormData = z.infer<typeof HamaliSchema>;

interface AddHamaliDialogProps {
    record: DryingRecord;
    children: React.ReactNode;
}

export function AddHamaliDialog({ record, children }: AddHamaliDialogProps) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const firestore = useFirestore();

  const nextChargeDate = useMemo(() => {
    if (!record.hamaliCharges || record.hamaliCharges.length === 0) {
      const firstChargeDate = record.hamaliCharges && record.hamaliCharges.length > 0 ? toDate(record.hamaliCharges[0].date) : toDate(record.dryingStartDate);
      return addDays(firstChargeDate, 1);
    }
    const lastCharge = record.hamaliCharges[record.hamaliCharges.length - 1];
    return addDays(toDate(lastCharge.date), 1);
  }, [record.hamaliCharges, record.dryingStartDate]);

  const form = useForm<HamaliFormData>({
    resolver: zodResolver(HamaliSchema),
    defaultValues: {
      hamaliPerBag: '' as any, // Use empty string for controlled component
      chargeDate: new Date().toISOString().split('T')[0],
    },
  });

  useEffect(() => {
    if (isOpen) {
        form.reset({
          hamaliPerBag: '' as any, // Reset to empty string
          chargeDate: nextChargeDate.toISOString().split('T')[0],
        });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, form, nextChargeDate]);


  const chargeDate = form.watch('chargeDate');

  const dayNumber = useMemo(() => {
    if (!chargeDate) return 0;
    const dryingStart = toDate(record.dryingStartDate);
    const currentChargeDate = new Date(chargeDate);
    return differenceInDays(currentChargeDate, dryingStart) + 1;
  }, [chargeDate, record.dryingStartDate]);

  const dayDescription = `Drying Day ${dayNumber}`;

  const onSubmit = (data: HamaliFormData) => {
    if (!firestore) {
      toast({ title: 'Error', description: 'Firestore not available.', variant: 'destructive' });
      return;
    }
    if (dayNumber <= 1) {
        form.setError('chargeDate', { message: 'Date must be after the first drying day.' });
        return;
    }

    startTransition(async () => {
      try {
        const additionalAmount = data.hamaliPerBag * record.bagsForDrying;
        const newCharge: HamaliCharge = {
            description: dayDescription,
            amount: additionalAmount,
            date: Timestamp.fromDate(new Date(data.chargeDate))
        };
        
        const recordRef = doc(firestore, 'dryingRecords', record.id);
        
        await updateDoc(recordRef, {
          hamaliCharges: arrayUnion(newCharge),
          totalDryingHamali: increment(additionalAmount),
        });

        toast({ 
          title: 'Success', 
          description: `Added ${formatCurrency(additionalAmount)} for ${dayDescription} hamali.` 
        });
        setIsOpen(false);
      } catch (error) {
        console.error(error);
        toast({ title: 'Error', description: 'Failed to add hamali charge.', variant: 'destructive' });
      }
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <DialogHeader>
              <DialogTitle>Add Additional Hamali</DialogTitle>
              <DialogDescription>
                Add a charge for {record.bagsForDrying} bags. Current total hamali is {formatCurrency(record.totalDryingHamali)}.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 grid gap-4">
              <FormField
                control={form.control}
                name="chargeDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date for Charge</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
               <FormField
                control={form.control}
                name="hamaliPerBag"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Hamali Rate per Bag (for {dayDescription})</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" placeholder="Enter rate..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline" type="button">Cancel</Button>
              </DialogClose>
              <Button type="submit" disabled={isPending}>
                {isPending ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>
                ) : (
                  'Add Charge'
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
