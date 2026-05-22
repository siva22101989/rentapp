
'use client';

import { useState, useTransition } from 'react';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { Button } from '../ui/button';
import { Loader2 } from 'lucide-react';
import { useFirestore } from '@/firebase/provider';
import { deletePaymentFromRecord } from '@/lib/data';
import type { PaymentEvent } from './payment-report-table';
import { formatCurrency } from '@/lib/utils';

export function DeletePaymentDialog({ event, children }: { event: PaymentEvent, children: React.ReactNode }) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const firestore = useFirestore();

  const handleDelete = () => {
    if (!firestore) return;
    startTransition(async () => {
      try {
        await deletePaymentFromRecord(firestore, event.recordId, event.recordType, event.paymentIndex);
        toast({ title: 'Payment Deleted', description: 'The ledger has been updated.' });
        setIsOpen(false);
      } catch (error) {
        toast({ title: 'Error', description: 'Failed to delete payment.', variant: 'destructive' });
      }
    });
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Cash Receipt?</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete the payment of <span className="font-bold text-destructive">{formatCurrency(event.amount)}</span> for Bill #{event.recordId.replace(/\D/g, '')}? 
            This will increase the customer's outstanding balance immediately.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <Button variant="destructive" onClick={handleDelete} disabled={isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirm Delete
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
