
'use client';

import { useState, useTransition, useMemo } from 'react';
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
import { cleanForFirestore, formatCurrency } from '@/lib/utils';
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

  const netPending = useMemo(() => {
    if (!allRecords || !allUnloadingRecords || !allExpenses) return 0;

    const workerLiability = allRecords.reduce((acc, sr) => acc + (sr.workerHamaliPayable ?? sr.hamaliPayable), 0) +
                           allUnloadingRecords.reduce((acc, ur) => {
                               const bagsRemaining = ur.bagsUnloaded - (ur.bagsSentToDrying || 0);
                               const proportion = ur.bagsUnloaded > 0 ? bagsRemaining / ur.bagsUnloaded : 0;
                               return acc + ((ur.workerHamaliPayable ?? ur.totalHamali) * proportion);
                           }, 0);
    
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
    if (!firestore || !appUser?.warehouseId) return;

    if (data.amount > netPending + 0.5) {
        form.setError('amount', { message: `Cannot exceed pending balance of ${formatCurrency(netPending)}` });
        return;
    }

    startTransition(async () => {
      try {
        const newExpense: Partial<Expense> = {
          description: `Worker Hamali Payout recorded on ${format(new Date(data.date), 'dd MMM yyyy')}`,
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
        toast({ title: 'Error', description: 'Failed to record payment.', variant: 'destructive' });
      }
    });
  };

  const isBalanceEmpty = netPending <= 0.5;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {children || (
            <Button className="font-bold h-9">
                <Hammer className="mr-2 h-4 w-4" />
                Record Hamali Payment
            </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <DialogHeader>
              <DialogTitle className="text-xl font-bold uppercase tracking-tight">Staff Payout Console</DialogTitle>
              <DialogDescription className="text-xs">Manage cash distributions to your hamali team.</DialogDescription>
            </DialogHeader>
            
            <div className="grid gap-4 py-4">
              <div className="p-5 rounded-2xl border-2 border-primary/20 bg-primary/5 text-center space-y-1">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/60">Total Hamali Pending</p>
                  <p className={`text-3xl font-black ${isBalanceEmpty ? 'text-slate-400' : 'text-primary'}`}>
                      {formatCurrency(netPending)}
                  </p>
              </div>

              {isBalanceEmpty && (
                  <Alert variant="default" className="bg-emerald-50 border-emerald-200">
                      <AlertCircle className="h-4 w-4 text-emerald-600" />
                      <AlertTitle className="text-emerald-800 text-xs font-bold uppercase tracking-wider">No Dues Pending</AlertTitle>
                      <AlertDescription className="text-emerald-700 text-[11px] font-medium leading-relaxed">
                          All staff earnings have been settled. No further payments are required at this stage.
                      </AlertDescription>
                  </Alert>
              )}

              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-black uppercase tracking-wider text-slate-500">Payout Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} disabled={isBalanceEmpty} className="h-10 text-sm font-bold" />
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
                    <FormLabel className="text-xs font-black uppercase tracking-wider text-slate-500">Amount to Distribute</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        step="0.01" 
                        placeholder="0.00" 
                        {...field} 
                        value={field.value ?? ''} 
                        disabled={isBalanceEmpty}
                        className="h-12 text-lg font-mono font-black"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <DialogFooter>
              <DialogClose asChild><Button variant="outline" type="button" className="text-xs font-bold uppercase h-10">Cancel</Button></DialogClose>
              <Button type="submit" disabled={isPending || isBalanceEmpty} className="text-xs font-black uppercase tracking-widest h-10 shadow-lg shadow-primary/20">
                {isPending ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>
                ) : (
                  'Confirm Payout'
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
