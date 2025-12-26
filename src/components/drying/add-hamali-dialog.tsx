'use client';

import { useState, useTransition, useEffect } from 'react';
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
import type { DryingRecord, HamaliCharge, UnloadingRecord } from '@/lib/definitions';
import { useFirestore } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { doc, updateDoc, arrayUnion, Timestamp } from 'firebase/firestore';
import { toDate } from '@/lib/utils';
import { differenceInDays } from 'date-fns';

const AddHamaliSchema = z.object({
  hamaliPerBag: z.coerce.number().positive('Rate must be a positive number.'),
  chargeDate: z.string().refine(val => !isNaN(Date.parse(val)), { message: "Invalid date" }),
});

type HamaliFormData = z.infer<typeof AddHamaliSchema>;

interface AddHamaliDialogProps {
    record: DryingRecord;
    unloadingRecord?: UnloadingRecord;
    children: React.ReactNode;
}

export function AddHamaliDialog({ record, unloadingRecord, children }: AddHamaliDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const firestore = useFirestore();
  const { toast } = useToast();

  const form = useForm<HamaliFormData>({
    resolver: zodResolver(AddHamaliSchema),
    defaultValues: {
        hamaliPerBag: undefined,
        chargeDate: new Date().toISOString().split('T')[0],
    }
  });
  
  useEffect(() => {
    if (isOpen) {
      form.reset({
        hamaliPerBag: undefined,
        chargeDate: new Date().toISOString().split('T')[0],
      });
    }
  }, [isOpen, form]);

  const chargeDate = form.watch('chargeDate');
  const dryingDay = chargeDate ? differenceInDays(new Date(chargeDate), toDate(record.dryingStartDate)) + 1 : 0;
  const description = dryingDay > 1 ? `Drying Day ${dryingDay}` : 'Drying Day 1 (Adjustment)';

  const onSubmit = (data: HamaliFormData) => {
    if (!firestore) {
      toast({ title: 'Error', description: 'Firestore not available.', variant: 'destructive' });
      return;
    }

    startTransition(async () => {
      try {
        const recordRef = doc(firestore, 'dryingRecords', record.id);
        
        const bags = record.bagsPacked ?? record.bagsForDrying;
        const newChargeAmount = data.hamaliPerBag * bags;

        const newCharge: HamaliCharge = {
          description: description,
          amount: newChargeAmount,
          date: Timestamp.fromDate(new Date(data.chargeDate)),
        };

        const newTotalDryingHamali = (record.totalDryingHamali || 0) + newChargeAmount;

        await updateDoc(recordRef, {
          hamaliCharges: arrayUnion(newCharge),
          totalDryingHamali: newTotalDryingHamali
        });

        toast({ title: 'Success', description: 'Additional hamali charge added.' });
        setIsOpen(false);
      } catch (error) {
        console.error("Failed to add hamali charge:", error);
        toast({ title: "Error", description: "Failed to add hamali charge.", variant: "destructive" });
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
                Add a new hamali charge for Bill No. {unloadingRecord?.billNo ?? record.unloadingRecordId}. Bags: {record.bagsPacked ?? record.bagsForDrying}.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4">
              <FormField
                control={form.control}
                name="chargeDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date of Charge</FormLabel>
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
                    <FormLabel>Hamali Rate per Bag</FormLabel>
                    <FormControl>
                       <Input 
                          type="number" 
                          step="0.01" 
                          placeholder="0.00"
                          {...field}
                          value={field.value ?? ''}
                        />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="text-sm text-muted-foreground">
                This will be recorded as: <span className="font-semibold text-foreground">{description}</span>
              </div>
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
