'use client';

import { useState, useTransition } from 'react';
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
import { useFirestore } from '@/firebase';
import type { DryingRecord } from '@/lib/definitions';
import { doc, updateDoc, increment } from 'firebase/firestore';
import { formatCurrency } from '@/lib/utils';

const HamaliSchema = z.object({
  hamaliPerBag: z.coerce.number().positive('Rate must be a positive number.'),
  day: z.string().min(1, 'Day is required'),
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

  const form = useForm<HamaliFormData>({
    resolver: zodResolver(HamaliSchema),
    defaultValues: {
      hamaliPerBag: '' as any,
      day: '',
    },
  });

  const onSubmit = (data: HamaliFormData) => {
    if (!firestore) {
      toast({ title: 'Error', description: 'Firestore not available.', variant: 'destructive' });
      return;
    }

    startTransition(async () => {
      try {
        const additionalAmount = data.hamaliPerBag * record.bagsForDrying;
        const recordRef = doc(firestore, 'dryingRecords', record.id);
        
        await updateDoc(recordRef, {
          totalDryingHamali: increment(additionalAmount),
        });

        toast({ 
          title: 'Success', 
          description: `Added ${formatCurrency(additionalAmount)} for ${data.day} hamali.` 
        });
        setIsOpen(false);
        form.reset();
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
                Calculate and add hamali for {record.bagsForDrying} bags in record {record.id}.
                Current total hamali is {formatCurrency(record.totalDryingHamali)}.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 grid gap-4">
               <FormField
                control={form.control}
                name="day"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Day Description</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., 2nd Day, 3rd Day" {...field} />
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
                      <Input type="number" step="0.01" placeholder="0.00" {...field} value={field.value ?? ''} />
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
