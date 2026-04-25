'use client';

import { useState, useTransition } from 'react';
import { Loader2, Landmark } from 'lucide-react';
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
import { useAppUser } from '@/firebase/auth/use-user';

const BorrowingSchema = z.object({
  lenderName: z.string().min(2, 'Lender name is required.'),
  principal: z.coerce.number().positive('Principal amount must be positive.'),
  interestRate: z.coerce.number().nonnegative('Interest rate must be non-negative.'),
  dateTaken: z.string().refine(val => !isNaN(Date.parse(val)), { message: "Invalid date" }),
});

type BorrowingFormData = z.infer<typeof BorrowingSchema>;

export function AddBorrowingDialog() {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const firestore = useFirestore();
  const appUser = useAppUser();

  const form = useForm<BorrowingFormData>({
    resolver: zodResolver(BorrowingSchema),
    defaultValues: {
      lenderName: '',
      principal: undefined,
      interestRate: undefined,
      dateTaken: new Date().toISOString().split('T')[0],
    },
  });

  const onSubmit = (data: BorrowingFormData) => {
    if (!firestore || !appUser?.warehouseId) {
      toast({ title: 'Error', description: 'Could not add record: user or warehouse context is missing.', variant: 'destructive' });
      return;
    }

    startTransition(async () => {
      try {
        const newBorrowing = {
          ...data,
          dateTaken: new Date(data.dateTaken),
          status: 'Active' as const,
          warehouseId: appUser.warehouseId,
        };
        await addDoc(collection(firestore, 'borrowings'), cleanForFirestore(newBorrowing));
        toast({ title: 'Success', description: 'Borrowing record added successfully.' });
        setIsOpen(false);
        form.reset();
      } catch (error) {
        console.error(error);
        toast({ title: 'Error', description: 'Failed to add borrowing record.', variant: 'destructive' });
      }
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="default">
          <Landmark className="mr-2" />
          Add Borrowing
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <DialogHeader>
              <DialogTitle>Add New Borrowing</DialogTitle>
              <DialogDescription>
                Record a new loan you have taken. The interest you pay on this can be recorded as an "Interest Paid" expense.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <FormField
                control={form.control}
                name="lenderName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Lender's Name</FormLabel>
                    <FormControl><Input placeholder="e.g., John Doe" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
               <FormField
                control={form.control}
                name="dateTaken"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date Taken</FormLabel>
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
                {isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : 'Save Borrowing'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
