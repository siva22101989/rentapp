
'use client';

import { useState, useTransition, useEffect } from 'react';
import { Loader2, Save } from 'lucide-react';
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
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import type { PaymentEvent } from './payment-report-table';
import { useFirestore } from '@/firebase/provider';
import { z } from 'zod';
import { editPaymentInRecord } from '@/lib/data';
import { format } from 'date-fns';
import { toDate } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import type { PaymentType } from '@/lib/definitions';

const paymentTypes: PaymentType[] = ['rent', 'hamali', 'other', 'unloading', 'discount'];

const PaymentEditSchema = z.object({
  date: z.string().min(1, 'Date is required.'),
  amount: z.coerce.number().positive('Amount must be positive.'),
  type: z.enum(['rent', 'hamali', 'other', 'unloading', 'discount']),
});

export function EditPaymentDialog({ event, children }: { event: PaymentEvent, children: React.ReactNode }) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const firestore = useFirestore();

  const [date, setDate] = useState('');
  const [amount, setAmount] = useState<number | ''>('');
  const [type, setType] = useState<PaymentType>('other');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen) {
      setDate(format(toDate(event.date), 'yyyy-MM-dd'));
      setAmount(event.amount);
      setType(event.type);
      setErrors({});
    }
  }, [isOpen, event]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestore) return;

    const res = PaymentEditSchema.safeParse({ date, amount, type });
    if (!res.success) {
      setErrors(res.error.flatten().fieldErrors as any);
      return;
    }

    startTransition(async () => {
      try {
        await editPaymentInRecord(firestore, event.recordId, event.recordType, event.paymentIndex, {
            amount: res.data.amount,
            date: new Date(res.data.date),
            type: res.data.type as PaymentType
        });
        toast({ title: 'Success', description: 'Payment updated.' });
        setIsOpen(false);
      } catch (error) {
        toast({ title: 'Error', description: 'Update failed.', variant: 'destructive' });
      }
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit Payment Entry</DialogTitle>
            <DialogDescription>Modify cash receipt details for Bill #{event.recordId.replace(/\D/g, '')}.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="pay-date">Date</Label>
              <Input id="pay-date" type="date" value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pay-type">Category</Label>
              <Select onValueChange={(v: any) => setType(v)} value={type}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {paymentTypes.map(t => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pay-amount">Amount</Label>
              <Input id="pay-amount" type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value === '' ? '' : Number(e.target.value))} />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline" type="button">Cancel</Button></DialogClose>
            <Button type="submit" disabled={isPending}>{isPending ? <Loader2 className="animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Save Changes</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
