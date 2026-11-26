'use client';

import { useState, useTransition, useMemo } from 'react';
import { Loader2, Hammer, TrendingDown, Banknote } from 'lucide-react';
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
import type { Expense, StorageRecord, UnloadingRecord, Customer } from '@/lib/definitions';
import { format } from 'date-fns';
import { useAppUser } from '@/firebase/auth/use-user';
import { useCollection } from '@/firebase/firestore/use-collection';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Separator } from '../ui/separator';
import { Combobox } from '../ui/combobox';

const HamaliPaymentSchema = z.object({
  customerId: z.string().optional(),
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

  const customersQuery = useMemoFirebase(
    () => (firestore && appUser?.warehouseId ? query(collection(firestore, 'customers'), where('warehouseId', '==', appUser.warehouseId)) : null),
    [firestore, appUser]
  );
  const { data: customers } = useCollection<Customer>(customersQuery);

  const customerOptions = useMemo(() => (customers || []).map(c => ({ value: c.id, label: c.name })), [customers]);

  const form = useForm<HamaliPaymentFormData>({
    resolver: zodResolver(HamaliPaymentSchema),
    defaultValues: {
      customerId: '',
      amount: undefined,
      date: new Date().toISOString().split('T')[0],
    },
  });

  const selectedCustomerId = form.watch('customerId');

  const { totalEarned, totalPaid, netPending } = useMemo(() => {
    if (!allRecords || !allUnloadingRecords || !allExpenses) return { totalEarned: 0, totalPaid: 0, netPending: 0 };

    let workerLiability = 0;
    
    // Filter by customer if selected
    const records = selectedCustomerId ? allRecords.filter(r => r.customerId === selectedCustomerId) : allRecords;
    const unloadings = selectedCustomerId ? allUnloadingRecords.filter(r => r.customerId === selectedCustomerId) : allUnloadingRecords;
    const expenses = selectedCustomerId ? allExpenses.filter(e => e.customerId === selectedCustomerId) : allExpenses;

    workerLiability = records.reduce((acc, sr) => {
        const val = (sr.workerHamaliPayable !== undefined && sr.workerHamaliPayable !== null) 
            ? Number(sr.workerHamaliPayable) 
            : (Number(sr.hamaliPayable) || 0);
        return acc + val;
    }, 0) +
    unloadings.reduce((acc, ur) => {
        const totalBags = Number(ur.bagsUnloaded) || 0;
        const sentBags = Number(ur.bagsSentToDrying) || 0;
        const bagsRemaining = Math.max(0, totalBags - sentBags);
        const proportion = totalBags > 0 ? bagsRemaining / totalBags : 0;
        
        const liabilityVal = (ur.workerHamaliPayable !== undefined && ur.workerHamaliPayable !== null)
            ? Number(ur.workerHamaliPayable)
            : (Number(ur.totalHamali) || 0);
            
        return acc + (liabilityVal * proportion);
    }, 0);
    
    const workerPaid = expenses
        .filter(e => e.category === 'Hamali Paid')
        .reduce((acc, e) => acc + (Number(e.amount) || 0), 0);

    return {
        totalEarned: workerLiability,
        totalPaid: workerPaid,
        netPending: workerLiability - workerPaid
    };
  }, [allRecords, allUnloadingRecords, allExpenses, selectedCustomerId]);

  const onSubmit = (data: HamaliPaymentFormData) => {
    if (!firestore || !appUser?.warehouseId) return;

    startTransition(async () => {
      try {
        const customer = customers?.find(c => c.id === data.customerId);
        const description = data.customerId && customer 
            ? `Hamali Workers Payout (for ${customer.name}): ${format(new Date(data.date), 'dd MMM yyyy')}`
            : `Global Hamali Workers Payout: ${format(new Date(data.date), 'dd MMM yyyy')}`;

        const newExpense: Partial<Expense> = {
          description,
          amount: data.amount,
          date: new Date(data.date),
          category: 'Hamali Paid' as const,
          warehouseId: appUser.warehouseId,
          customerId: data.customerId || undefined,
        };
        await addDoc(collection(firestore, 'expenses'), cleanForFirestore(newExpense));
        toast({ title: 'Payment Recorded', description: `${formatCurrency(data.amount)} has been added to hamali expenses.` });
        setIsOpen(false);
        form.reset();
      } catch (error) {
        toast({ title: 'Error', description: 'Failed to record payment.', variant: 'destructive' });
      }
    });
  };

  const isInAdvance = netPending < -0.5;
  const isBalanceSettled = Math.abs(netPending) <= 0.5;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {children || (
            <Button className="font-bold h-9 bg-orange-600 hover:bg-orange-700 text-white">
                <Hammer className="mr-2 h-4 w-4" />
                Hamali Workers Payment
            </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <DialogHeader>
              <DialogTitle className="text-xl font-bold uppercase tracking-tight text-center">Hamali Payout Console</DialogTitle>
              <DialogDescription className="text-xs font-medium text-center">Distribute cash to workers. Selecting a customer correctly reconciles their labor pool.</DialogDescription>
            </DialogHeader>
            
            <div className="grid gap-4 py-4">
              <FormField
                control={form.control}
                name="customerId"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel className="text-xs font-black uppercase tracking-wider text-slate-500">Target Account (Optional)</FormLabel>
                    <Combobox 
                        options={customerOptions} 
                        value={field.value} 
                        onChange={field.onChange} 
                        placeholder="Select customer for specific payout..." 
                        modal={true} 
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-2 mb-2">
                  <div className="p-3 rounded-xl border bg-slate-50 text-center space-y-1">
                      <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Total Earned</p>
                      <p className="text-sm font-black text-slate-700">{formatCurrency(totalEarned)}</p>
                  </div>
                  <div className="p-3 rounded-xl border bg-slate-50 text-center space-y-1">
                      <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Total Distributed</p>
                      <p className="text-sm font-black text-green-700">{formatCurrency(totalPaid)}</p>
                  </div>
              </div>

              <div className={`p-5 rounded-2xl border-2 transition-colors text-center space-y-1 ${
                  isInAdvance ? 'border-emerald-200 bg-emerald-50' : 
                  isBalanceSettled ? 'border-slate-200 bg-slate-50' : 'border-primary/20 bg-primary/5'
              }`}>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                      {isInAdvance ? 'Current Hamali Advance' : 'Net Pending Balance'}
                  </p>
                  <p className={`text-3xl font-black ${
                      isInAdvance ? 'text-emerald-700' : 
                      isBalanceSettled ? 'text-slate-400' : 'text-primary'
                  }`}>
                      {formatCurrency(Math.abs(netPending))}
                  </p>
              </div>

              {isInAdvance && (
                  <Alert variant="default" className="bg-emerald-50 border-emerald-200">
                      <TrendingDown className="h-4 w-4 text-emerald-600" />
                      <AlertTitle className="text-emerald-800 text-xs font-bold uppercase tracking-wider text-center">Labor Advance</AlertTitle>
                      <AlertDescription className="text-emerald-700 text-[11px] font-medium leading-relaxed text-center">
                          Total payouts exceed earnings by {formatCurrency(Math.abs(netPending))}. New distributions will increase this advance.
                      </AlertDescription>
                  </Alert>
              )}

              <Separator />

              <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-black uppercase tracking-wider text-slate-500">Payment Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} className="h-10 text-sm font-bold" />
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
                        <FormLabel className="text-xs font-black uppercase tracking-wider text-slate-500">Amount to Pay Now</FormLabel>
                        <FormControl>
                          <div className="relative">
                              <Input 
                                type="number" 
                                step="0.01" 
                                placeholder="0.00" 
                                {...field} 
                                value={field.value ?? ''} 
                                className="h-12 text-lg font-mono font-black border-primary/30 shadow-inner pl-10"
                              />
                              <Banknote className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-primary opacity-50" />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
              </div>
            </div>
            <DialogFooter className="gap-2">
              <DialogClose asChild><Button variant="outline" type="button" className="text-xs font-bold uppercase h-10 flex-1">Cancel</Button></DialogClose>
              <Button type="submit" disabled={isPending} className="text-xs font-black uppercase tracking-widest h-10 flex-1 shadow-lg shadow-primary/20">
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