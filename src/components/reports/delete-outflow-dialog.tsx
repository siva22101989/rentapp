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
import { useFirestore, useAppUser } from '@/firebase';
import { deletePatti } from '@/lib/data';
import type { Outflow } from '@/lib/definitions';
import { format } from 'date-fns';
import { toDate } from '@/lib/utils';

export function DeleteOutflowDialog({
  pattiNo,
  outflow,
  children,
}: {
  pattiNo: string;
  outflow: Outflow;
  children: React.ReactNode;
}) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const firestore = useFirestore();
  const appUser = useAppUser();

  const handleDelete = async () => {
    if (!firestore || !appUser?.warehouseId) {
      toast({ title: 'Error', description: 'Session expired. Please reload.', variant: 'destructive' });
      return;
    }
    
    startTransition(async () => {
      try {
        await deletePatti(firestore, appUser.warehouseId!, pattiNo);
        toast({ title: 'Bill Reverted', description: 'Stock has been restored for all items in this bill.' });
        setIsOpen(false);
      } catch (error) {
         toast({
          title: 'Error',
          description: `Failed to restore stock. ${error instanceof Error ? error.message : ''}`,
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
          <AlertDialogTitle className="text-xl font-bold uppercase tracking-tight">Full Bill Reversal?</AlertDialogTitle>
          <AlertDialogDescription className="text-sm font-medium leading-relaxed">
            This will permanently delete **Bill No. {pattiNo}** and restore the stock of <span className="font-bold text-primary">{outflow.bagsWithdrawn} bags</span> (plus any other lots in this transaction) back to your Godown inventory. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel className="font-bold">Keep Bill</AlertDialogCancel>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isPending}
            className="font-black uppercase tracking-widest"
          >
            {isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Restoring...</> : 'Confirm Reversal'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}