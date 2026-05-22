'use client';

import { useState, useTransition, useMemo, useEffect } from 'react';
import { Loader2, Hammer, AlertCircle } from 'lucide-react';
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
import { useFirestore } from '@/firebase/provider';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../ui/form';
import { addDoc, collection, query, where } from 'firebase/firestore';
import { cleanForFirestore, formatCurrency, toDate } from '@/lib/utils';
import type { Expense, StorageRecord, UnloadingRecord } from '@/lib/definitions';
import { format } from 'date-fns';
import { useAppUser } from '@/firebase/auth/use-user';
import { useCollection } from '@/firebase/firestore/use-collection';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';

const HamaliPaymentSchema = z.object({
  amount: z.coerce.number().positive('Amount must be a positive number.'),
  date: z.string().refine(val => !isNaN(Date.parse(val)), { message: "Invalid date format" }),
});

type HamaliPaymentFormData = z.infer<typeof HamaliPaymentSchema>;

export function RecordHamaliPaymentDialog({ 
    children, 
}: { 
    children?: React.ReactNode, 
}) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const firestore = useFirestore();
  const appUser = useAppUser();

  // Fetch data to calculate global worker balance
  const recordsQuery = useMemoFirebase(
    () => (firestore && appUser?.warehouseId ? query(collection(firestore, 'storageRecords'), where('warehouseId', '==', appUser.warehouseId)) : null),
    [firestore, appUser]
  );
  const { data: allRecords } = useCollection<StorageRecord>(recordsQuery);

  const unloadingRecordsQuery = useMemoFirebase(
    () => (firestore && appUser?.warehouseId ? query(collection(firestore, 'unloadingRecords'), where('warehouseId', '==', appUser.warehouseId)) : null),
    [firestore, appUser]
  );
  const { data: allUnloadingRecords } = useCollection<UnloadingRecord>(unloadingRecordsQuery);

  const expensesQuery = useMemoFirebase(
    () => (firestore && appUser?.warehouseId ? query(collection(firestore, 'expenses'), where('warehouseId', '==', appUser.warehouseId)) : null),
    [firestore, appUser]
  );
  const { data: allExpenses } = useCollection<Expense>(expensesQuery);

  // Calculate Net Pending Owed to Workers
  const netPending = useMemo(() => {
    if (!allRecords || !allUnloadingRecords || !allExpenses) return 0;

    const workerLiability = allRecords.reduce((acc, sr) => acc + (sr.workerHamaliPayable ?? sr.hamaliPayable), 0) +
                           allUnloadingRecords.reduce((acc, ur) => acc + (ur.workerHamaliPayable ?? ur.totalHamali), 0);
    
    const workerPaid = allExpenses
        .filter(e => e.category === 'Hamali Paid')
        .reduce((acc, e) => acc + e.amount, 0);

    return Math.max(0, workerLiability - workerPaid);
  }, [allRecords, allUnloadingRecords, allExpenses]);

  const form = useForm<HamaliPaymentFormData>({
    resolver: zodResolver(HamaliPaymentSchema),
    defaultValues: {
      amount: undefined,
      date: new Date().toISOString().split('T')[0],
    },
  });

  const onSubmit = (data: HamaliPaymentFormData) => {
    if (!firestore || !appUser?.warehouseId) {
      toast({ title: 'Error', description: 'Context missing.', variant: 'destructive' });
      return;
    }

    if (data.amount > netPending + 0.5) { // Allow minor float tolerance
        form.setError('amount', { message: `Cannot exceed pending balance of ${formatCurrency(netPending)}` });
        return;
    }

    startTransition(async () => {
      try {
        const newExpense: Partial<Expense> = {
          description: `Hamali Payment recorded on ${format(new Date(data.date), 'dd MMM yyyy')}`,
          amount: data.amount,
          date: new Date(data.date),
          category: 'Hamali Paid' as const,
          warehouseId: appUser.warehouseId,
        };
        await addDoc(collection(firestore, 'expenses'), cleanForFirestore(newExpense));
        
        toast({ title: 'Success', description: "Hamali payment recorded successfully." });

        setIsOpen(false);
        form.reset();
      } catch (error) {
        console.error(error);
        toast({ title: 'Error', description: 'Failed to record hamali payment.', variant: 'destructive' });
      }
    });
  };

  const isBalanceEmpty = netPending <= 0.5;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {children || (
            <Button>
                <Hammer className="mr-2 h-4 w-4" />
                Record Hamali Payment
            </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <DialogHeader>
              <DialogTitle>Record Hamali Payment</DialogTitle>
              <DialogDescription className="text-xs">
                Enter the amount paid to workers. This will be capped by the total pending balance.
              </DialogDescription>
            </DialogHeader>
            
            <div className="grid gap-4 py-4">
              <div className="p-4 rounded-xl border bg-secondary/30 text-center space-y-1">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Total Hamali Pending</p>
                  <p className={`text-2xl font-black ${isBalanceEmpty ? 'text-slate-400' : 'text-primary'}`}>
                      {formatCurrency(netPending)}
                  </p>
              </div>

              {isBalanceEmpty && (
                  <Alert variant="default" className="bg-blue-50 border-blue-200">
                      <AlertCircle className="h-4 w-4 text-blue-600" />
                      <AlertTitle className="text-blue-800 text-xs font-bold uppercase">No Dues Pending</AlertTitle>
                      <AlertDescription className="text-blue-700 text-[11px]">
                          The worker ledger is currently clear. No payments are required at this time.
                      </AlertDescription>
                  </Alert>
              )}

              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold">Payment Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} disabled={isBalanceEmpty} className="h-9 text-sm" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold">Amount Paid</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        step="0.01" 
                        placeholder="0.00" 
                        {...field} 
                        value={field.value ?? ''} 
                        disabled={isBalanceEmpty}
                        className="h-9 text-sm font-mono font-bold"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <DialogFooter>
              <DialogClose asChild><Button variant="outline" type="button" className="text-sm h-9">Cancel</Button></DialogClose>
              <Button type="submit" disabled={isPending || isBalanceEmpty} className="text-sm h-9">
                {isPending ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>
                ) : (
                  'Record Payment'
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
