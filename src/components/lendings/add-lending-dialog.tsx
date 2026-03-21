
'use client';

import { useState, useTransition } from 'react';
import { Loader2, HandCoins } from 'lucide-react';
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
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../ui/form';
import { Input } from '../ui/input';
import { addDoc, collection } from 'firebase/firestore';
import { cleanForFirestore } from '@/lib/utils';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';

const LendingSchema = z.object({
  borrowerName: z.string().min(2, 'Borrower name is required.'),
  principal: z.coerce.number().positive('Principal amount must be positive.'),
  interestRate: z.coerce.number().nonnegative('Interest rate must be non-negative.'),
  dateGiven: z.string().refine(val => !isNaN(Date.parse(val)), { message: "Invalid date" }),
});

type LendingFormData = z.infer<typeof LendingSchema>;

export function AddLendingDialog() {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const firestore = useFirestore();

  const form = useForm<LendingFormData>({
    resolver: zodResolver(LendingSchema),
    defaultValues: {
      borrowerName: '',
      principal: undefined,
      interestRate: undefined,
      dateGiven: new Date().toISOString().split('T')[0],
    },
  });

  const onSubmit = (data: LendingFormData) => {
    if (!firestore) {
      toast({ title: 'Error', description: 'Firestore not available.', variant: 'destructive' });
      return;
    }

    startTransition(async () => {
      try {
        const newLending = {
          ...data,
          dateGiven: new Date(data.dateGiven),
          status: 'Active' as const,
        };
        await addDoc(collection(firestore, 'lendings'), cleanForFirestore(newLending));
        toast({ title: 'Success', description: 'Lending record added successfully.' });
        setIsOpen(false);
        form.reset();
      } catch (error) {
        console.error(error);
        toast({ title: 'Error', description: 'Failed to add lending record.', variant: 'destructive' });
      }
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive">
          <HandCoins className="mr-2" />
          Add Lending
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <DialogHeader>
              <DialogTitle>Add New Lending</DialogTitle>
              <DialogDescription>
                Record a new loan you have given out. You can record interest received using the "Add Income" button.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <FormField
                control={form.control}
                name="borrowerName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Borrower's Name</FormLabel>
                    <FormControl><Input placeholder="e.g., Jane Smith" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
               <FormField
                control={form.control}
                name="dateGiven"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date Given</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="principal"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Principal Amount</FormLabel>
                    <FormControl><Input type="number" placeholder="0.00" {...field} value={field.value ?? ''} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                  control={form.control}
                  name="interestRate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Monthly Interest Rate (%)</FormLabel>
                      <FormControl><Input type="number" step="0.01" placeholder="e.g. 2" {...field} value={field.value ?? ''} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
            </div>
            <DialogFooter>
              <DialogClose asChild><Button variant="outline" type="button">Cancel</Button></DialogClose>
              <Button type="submit" disabled={isPending}>
                {isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : 'Save Lending'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
