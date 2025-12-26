
'use client';

import { useState, useTransition } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Plus, Trash2 } from 'lucide-react';
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
import { useFirestore } from '@/firebase';
import type { DryingRecord, HamaliCharge, UnloadingRecord } from '@/lib/definitions';
import { doc, Timestamp, updateDoc } from 'firebase/firestore';
import { format } from 'date-fns';
import { formatCurrency, toDate } from '@/lib/utils';
import { Separator } from '../ui/separator';

const HamaliChargeSchema = z.object({
  description: z.string().min(1, 'Description is required.'),
  amount: z.coerce.number().nonnegative('Amount must be non-negative.'),
  date: z.string().refine(val => !isNaN(Date.parse(val)), { message: "Invalid date" }),
});

const ManageHamaliSchema = z.object({
  charges: z.array(HamaliChargeSchema),
});

type ManageHamaliFormData = z.infer<typeof ManageHamaliSchema>;

export function ManageHamaliDialog({ record, unloadingRecord, children }: { record: DryingRecord; unloadingRecord?: UnloadingRecord; children: React.ReactNode }) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const firestore = useFirestore();
  const isBilled = record.status === 'Billed';

  const form = useForm<ManageHamaliFormData>({
    resolver: zodResolver(ManageHamaliSchema),
    defaultValues: {
      charges: (record.hamaliCharges || []).map(charge => ({
        ...charge,
        date: format(toDate(charge.date), 'yyyy-MM-dd'),
      })),
    },
  });

  const { fields, append, remove, update } = useFieldArray({
    control: form.control,
    name: 'charges',
  });

  const onSubmit = (data: ManageHamaliFormData) => {
    if (!firestore) {
      toast({ title: 'Error', description: 'Firestore not available.', variant: 'destructive' });
      return;
    }

    startTransition(async () => {
      try {
        const hamaliCharges: HamaliCharge[] = data.charges.map(charge => ({
          ...charge,
          date: Timestamp.fromDate(new Date(charge.date)),
        }));
        
        const totalDryingHamali = hamaliCharges.reduce((acc, charge) => acc + charge.amount, 0);

        const recordRef = doc(firestore, 'dryingRecords', record.id);
        await updateDoc(recordRef, {
          hamaliCharges,
          totalDryingHamali,
        });

        toast({ title: 'Success', description: 'Hamali charges updated successfully.' });
        setIsOpen(false);
      } catch (error) {
        console.error(error);
        toast({ title: 'Error', description: 'Failed to update hamali charges.', variant: 'destructive' });
      }
    });
  };

  const addNewCharge = () => {
    append({
        description: 'Drying Hamali',
        amount: 0,
        date: format(new Date(), 'yyyy-MM-dd')
    })
  }

  const totalHamali = form.watch('charges').reduce((acc, charge) => acc + (charge.amount || 0), 0);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <DialogHeader>
              <DialogTitle>Manage Hamali Charges</DialogTitle>
              <DialogDescription>
                Edit, add, or delete hamali charges for this drying process. Unloading hamali is read-only.
              </DialogDescription>
            </DialogHeader>
            <div className="max-h-[60vh] overflow-y-auto p-1">
                <div className="space-y-4 py-4">
                {fields.map((field, index) => {
                    const isUnloadingCharge = field.description.toLowerCase().includes('unloading');
                    return (
                    <div key={field.id} className="grid grid-cols-12 items-start gap-2 p-2 rounded-md border">
                        <FormField
                            control={form.control}
                            name={`charges.${index}.description`}
                            render={({ field }) => (
                                <FormItem className="col-span-4">
                                <FormControl>
                                    <Input placeholder="Description" {...field} readOnly={isUnloadingCharge || isBilled} />
                                </FormControl>
                                <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name={`charges.${index}.date`}
                            render={({ field }) => (
                                <FormItem className="col-span-3">
                                <FormControl>
                                    <Input type="date" {...field} readOnly={isUnloadingCharge || isBilled} />
                                </FormControl>
                                <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name={`charges.${index}.amount`}
                            render={({ field }) => (
                                <FormItem className="col-span-3">
                                <FormControl>
                                    <Input type="number" step="0.01" placeholder="0.00" {...field} readOnly={isUnloadingCharge || isBilled} />
                                </FormControl>
                                <FormMessage />
                                </FormItem>
                            )}
                        />
                        <div className="col-span-2 flex items-center justify-end h-10">
                            {!isUnloadingCharge && !isBilled && (
                                <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)}>
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                            )}
                        </div>
                    </div>
                )})}
                {!isBilled && (
                    <Button type="button" variant="outline" size="sm" onClick={addNewCharge} className="mt-4">
                        <Plus className="mr-2 h-4 w-4" /> Add New Charge
                    </Button>
                )}
                <Separator className="my-4" />
                <div className="flex justify-end items-center font-bold text-lg">
                    <span>Total Hamali:</span>
                    <span className="ml-4 font-mono">{formatCurrency(totalHamali)}</span>
                </div>
                </div>
            </div>
            <DialogFooter>
              <DialogClose asChild><Button variant="outline" type="button">Cancel</Button></DialogClose>
              {!isBilled && (
                <Button type="submit" disabled={isPending}>
                  {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Changes
                </Button>
              )}
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
