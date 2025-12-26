
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
import { useFirestore } from '@/firebase';
import { doc, Timestamp, updateDoc } from 'firebase/firestore';
import type { DryingRecord } from '@/lib/definitions';
import { toDate } from '@/lib/utils';
import { format } from 'date-fns';

export function BillProcessDialog({
  record,
  children,
}: {
  record: DryingRecord;
  children: React.ReactNode;
}) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const firestore = useFirestore();

  const handleBilling = async () => {
    if (!firestore) {
      toast({ title: 'Error', description: 'Firestore not available.', variant: 'destructive' });
      return;
    }
    if (!record.packingDate) {
        toast({ title: 'Error', description: 'Cannot bill a record that has not been packed.', variant: 'destructive' });
        return;
    }
    startTransition(async () => {
      try {
        const recordRef = doc(firestore, 'dryingRecords', record.id);
        await updateDoc(recordRef, {
            status: 'Billed',
            billingDate: Timestamp.now(),
        });
        toast({ title: 'Success', description: 'Drying process has been billed successfully.' });
        setIsOpen(false);
      } catch (error) {
         toast({
          title: 'Error',
          description: 'Failed to bill the drying process.',
          variant: 'destructive',
        });
      }
    });
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you sure you want to bill this process?</AlertDialogTitle>
          <AlertDialogDescription>
            This will mark the drying process for customer <span className="font-bold">{record.customerId}</span> as 'Billed' as of today. This action prepares the items for storage inflow but cannot be easily undone.
            <div className="mt-4 text-sm space-y-1">
              <p><span className="font-medium text-foreground">Packing Date:</span> {record.packingDate ? format(toDate(record.packingDate), 'dd MMM yyyy') : 'N/A'}</p>
              <p><span className="font-medium text-foreground">Bags Packed:</span> {record.bagsPacked ?? 'N/A'}</p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <Button
            onClick={handleBilling}
            disabled={isPending}
            className="bg-green-600 hover:bg-green-700"
          >
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirm and Bill
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
