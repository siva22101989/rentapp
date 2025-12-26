'use client';

import { useState, useTransition, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Plus, Trash2, Edit } from 'lucide-react';
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import type { DryingRecord, HamaliCharge } from '@/lib/definitions';
import { useFirestore } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { doc, updateDoc, Timestamp } from 'firebase/firestore';
import { toDate, formatCurrency } from '@/lib/utils';
import { format } from 'date-fns';
import { Separator } from '../ui/separator';

const HamaliChargeSchema = z.object({
  description: z.string().min(1, 'Description is required.'),
  amount: z.coerce.number().nonnegative('Amount must be a non-negative number.'),
  chargeDate: z.string().refine(val => !isNaN(Date.parse(val)), { message: "Invalid date" }),
});

type HamaliFormData = z.infer<typeof HamaliChargeSchema>;

interface ManageHamaliDialogProps {
    record: DryingRecord;
    children: React.ReactNode;
}

export function ManageHamaliDialog({ record, children }: ManageHamaliDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isAdding, setIsAdding] = useState(false);
  const [editingCharge, setEditingCharge] = useState<{ index: number; charge: HamaliCharge } | null>(null);
  
  const firestore = useFirestore();
  const { toast } = useToast();

  const form = useForm<HamaliFormData>({
    resolver: zodResolver(HamaliChargeSchema),
  });
  
  useEffect(() => {
    if (isOpen) {
        setIsAdding(false);
        setEditingCharge(null);
        form.reset();
    }
  }, [isOpen, form]);

  useEffect(() => {
    if (editingCharge) {
        form.reset({
            description: editingCharge.charge.description,
            amount: editingCharge.charge.amount,
            chargeDate: format(toDate(editingCharge.charge.date), 'yyyy-MM-dd')
        });
        setIsAdding(true); // Show the form
    } else {
        form.reset({
            description: '',
            amount: '' as any,
            chargeDate: new Date().toISOString().split('T')[0]
        });
    }
  }, [editingCharge, form]);

  const onSave = (data: HamaliFormData) => {
    if (!firestore) {
      toast({ title: 'Error', description: 'Firestore not available.', variant: 'destructive' });
      return;
    }

    startTransition(async () => {
      try {
        const recordRef = doc(firestore, 'dryingRecords', record.id);
        const currentCharges = record.hamaliCharges || [];
        let newCharges: HamaliCharge[];

        const newCharge: HamaliCharge = {
          description: data.description,
          amount: data.amount,
          date: Timestamp.fromDate(new Date(data.chargeDate)),
        };

        if (editingCharge !== null) {
            newCharges = [...currentCharges];
            newCharges[editingCharge.index] = newCharge;
        } else {
            newCharges = [...currentCharges, newCharge];
        }

        const newTotalDryingHamali = newCharges.reduce((acc, charge) => acc + charge.amount, 0);

        await updateDoc(recordRef, {
          hamaliCharges: newCharges,
          totalDryingHamali: newTotalDryingHamali
        });

        toast({ title: 'Success', description: 'Hamali charges updated successfully.' });
        setIsAdding(false);
        setEditingCharge(null);
      } catch (error) {
        console.error("Failed to update hamali charges:", error);
        toast({ title: "Error", description: "Failed to update hamali charges.", variant: "destructive" });
      }
    });
  };

  const onDelete = (indexToDelete: number) => {
     if (!firestore) {
      toast({ title: 'Error', description: 'Firestore not available.', variant: 'destructive' });
      return;
    }

    startTransition(async () => {
        try {
            const recordRef = doc(firestore, 'dryingRecords', record.id);
            const currentCharges = record.hamaliCharges || [];
            const newCharges = currentCharges.filter((_, index) => index !== indexToDelete);
            const newTotalDryingHamali = newCharges.reduce((acc, charge) => acc + charge.amount, 0);

             await updateDoc(recordRef, {
                hamaliCharges: newCharges,
                totalDryingHamali: newTotalDryingHamali
            });
            toast({ title: 'Success', description: 'Hamali charge deleted.' });
        } catch (error) {
            console.error("Failed to delete hamali charge:", error);
            toast({ title: "Error", description: "Failed to delete hamali charge.", variant: "destructive" });
        }
    });
  }

  const sortedCharges = (record.hamaliCharges || []).map((charge, index) => ({...charge, originalIndex: index}))
    .sort((a,b) => toDate(a.date).getTime() - toDate(b.date).getTime());

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Manage Hamali for Record {record.id}</DialogTitle>
          <DialogDescription>
            Add, edit, or delete hamali charges. The total is calculated automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-y-auto p-1">
            <div className="space-y-4">
                {sortedCharges.map((charge, sortedIndex) => (
                    <div key={sortedIndex} className="flex items-center justify-between p-2 rounded-md border">
                        <div className="flex-1">
                            <p className="font-medium">{charge.description}</p>
                            <p className="text-sm text-muted-foreground">
                                {format(toDate(charge.date), 'dd MMM yyyy')} - <span className="font-mono">{formatCurrency(charge.amount)}</span>
                            </p>
                        </div>
                        <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditingCharge({ index: charge.originalIndex, charge })}>
                                <Edit className="h-4 w-4" />
                            </Button>
                             <AlertDialog>
                                <AlertDialogTrigger asChild>
                                     <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        This will permanently delete the hamali charge: "{charge.description}" for {formatCurrency(charge.amount)}.
                                    </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => onDelete(charge.originalIndex)} disabled={isPending} className="bg-destructive hover:bg-destructive/90">
                                        {isPending ? 'Deleting...' : 'Delete'}
                                    </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </div>
                    </div>
                ))}
                {sortedCharges.length === 0 && !isAdding && (
                     <p className="text-center text-muted-foreground p-4">No hamali charges recorded yet.</p>
                )}
            </div>

            {isAdding && (
                <div className="mt-4 pt-4 border-t">
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSave)} className="space-y-4">
                            <h4 className="font-medium">{editingCharge ? 'Edit Charge' : 'Add New Charge'}</h4>
                            <FormField
                                control={form.control}
                                name="description"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Description</FormLabel>
                                        <FormControl>
                                            <Input placeholder="e.g., Drying Day 2" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <div className="grid grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name="amount"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Amount</FormLabel>
                                            <FormControl>
                                                <Input type="number" step="0.01" placeholder="0.00" {...field} value={field.value ?? ''} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                 <FormField
                                    control={form.control}
                                    name="chargeDate"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Date</FormLabel>
                                            <FormControl>
                                                <Input type="date" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                             <div className="flex justify-end gap-2">
                                <Button variant="ghost" type="button" onClick={() => { setIsAdding(false); setEditingCharge(null); }}>Cancel</Button>
                                <Button type="submit" disabled={isPending}>
                                    {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                    {editingCharge ? 'Save Changes' : 'Add Charge'}
                                </Button>
                            </div>
                        </form>
                    </Form>
                </div>
            )}
        </div>
        
        <Separator />

        <DialogFooter className="flex-col sm:flex-row sm:justify-between items-center pt-2">
            {!isAdding && (
                 <Button variant="outline" onClick={() => { setIsAdding(true); setEditingCharge(null); }}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add New Charge
                </Button>
            )}
             <div className="text-lg font-bold ml-auto">
                Total: {formatCurrency(record.totalDryingHamali || 0)}
            </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
