
'use client';

import { useState, useTransition } from 'react';
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
import { useToast } from '@/hooks/use-toast';
import type { StorageRecord, Outflow } from '@/lib/definitions';
import { useFirestore } from '@/firebase/provider';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../ui/form';
import { editOutflowEvent } from '@/lib/data';
import { format } from 'date-fns';
import { toDate } from '@/lib/utils';

const OutflowEditSchema = z.object({
  date: z.string().refine(val => !isNaN(Date.parse(val)), { message: "Invalid date format" }),
  discount: z.coerce.number().nonnegative('Discount must be a non-negative number.').optional(),
});

type OutflowEditFormData = z.infer<typeof OutflowEditSchema>;

export function EditOutflowDialog({ record, outflow, outflowIndex, children }: { record: StorageRecord, outflow: Outflow, outflowIndex: number, children: React.ReactNode }) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const firestore = useFirestore();

  const form = useForm<OutflowEditFormData>({
    resolver: zodResolver(OutflowEditSchema),
    defaultValues: {
      date: format(toDate(outflow.date), 'yyyy-MM-dd'),
      discount: outflow.discount || 0,
    },
  });

  const onSubmit = (data: OutflowEditFormData) => {
    if (!firestore) {
      toast({ title: 'Error', description: 'Firestore not available.', variant: 'destructive' });
      return;
    }

    startTransition(async () => {
      try {
        const newData = {
          date: new Date(data.date),
          discount: data.discount || 0,
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
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <DialogHeader>
              <DialogTitle>Edit Outflow Event</DialogTitle>
              <DialogDescription>
                Editing details for outflow on {format(toDate(outflow.date), 'dd MMM yyyy')}. Bags withdrawn ({outflow.bagsWithdrawn}) cannot be changed.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Withdrawal Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="discount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Discount Amount</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} value={field.value ?? ''}/>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
        </Form>
      </DialogContent>
    </Dialog>
  );
}
