
'use client';

import { useState, useTransition, useEffect } from 'react';
import { Loader2, Banknote } from 'lucide-react';
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
import { doc, setDoc } from 'firebase/firestore';
import { cleanForFirestore } from '@/lib/utils';
import type { WarehouseInfo } from '@/lib/definitions';
import { useAppUser } from '@/firebase/auth/use-user';

const InvestmentSchema = z.object({
  capitalInvestment: z.coerce.number().nonnegative('Investment must be a non-negative number.'),
  annualInterestRate: z.coerce.number().nonnegative('Interest rate must be a non-negative number.'),
});

type InvestmentFormData = z.infer<typeof InvestmentSchema>;

export function ManageInvestmentDialog({ initialData }: { initialData?: WarehouseInfo | null }) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const firestore = useFirestore();
  const appUser = useAppUser();

  const form = useForm<InvestmentFormData>({
    resolver: zodResolver(InvestmentSchema),
    defaultValues: {
      capitalInvestment: 0,
      annualInterestRate: 0,
    },
  });

  useEffect(() => {
    if (initialData) {
      form.reset({
        capitalInvestment: initialData.capitalInvestment || 0,
        annualInterestRate: initialData.annualInterestRate || 0,
      });
    }
  }, [initialData, form]);

  const onSubmit = (data: InvestmentFormData) => {
    if (!firestore || !appUser?.warehouseId) {
      toast({ title: 'Error', description: 'User or warehouse context is missing.', variant: 'destructive' });
      return;
    }

    startTransition(async () => {
      try {
        const docRef = doc(firestore, 'warehouses', appUser.warehouseId);
        await setDoc(docRef, cleanForFirestore(data), { merge: true });
        toast({ title: 'Success', description: 'Investment details saved.' });
        setIsOpen(false);
      } catch (error) {
        console.error(error);
        toast({ title: 'Error', description: 'Failed to save investment details.', variant: 'destructive' });
      }
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Banknote className="mr-2" />
          Manage Investment
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <DialogHeader>
              <DialogTitle>Manage Capital Investment</DialogTitle>
              <DialogDescription>
                Set your total investment and annual interest rate to automatically calculate the cost of capital.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-2 py-4">
              <FormField
                control={form.control}
                name="capitalInvestment"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Total Capital Investment</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="e.g., 10000000" {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="annualInterestRate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Annual Interest Rate (%)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.1" placeholder="e.g., 9" {...field} value={field.value ?? ''} />
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
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Investment Details'
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
