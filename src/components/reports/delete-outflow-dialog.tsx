
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
import { deleteOutflowEvent } from '@/lib/data';
import type { Outflow } from '@/lib/definitions';
import { format } from 'date-fns';
import { toDate } from '@/lib/utils';


export function DeleteOutflowDialog({
  recordId,
  outflow,
  outflowIndex,
  children,
}: {
  recordId: string;
  outflow: Outflow;
  outflowIndex: number;
  children: React.ReactNode;
}) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const firestore = useFirestore();

  const handleDelete = async () => {
    if (!firestore) {
      toast({ title: 'Error', description: 'Firestore not available.', variant: 'destructive' });
      return;
    }
    startTransition(async () => {
      try {
        await deleteOutflowEvent(firestore, recordId, outflowIndex);
        toast({ title: 'Success', description: 'Outflow event deleted successfully. Record has been updated.' });
        setIsOpen(false);
      } catch (error) {
         toast({
          title: 'Error',
          description: `Failed to delete outflow event. ${error instanceof Error ? error.message : ''}`,
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
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete the outflow of <span className="font-bold">{outflow.bagsWithdrawn} bags</span> from <span className="font-bold">{format(toDate(outflow.date), 'dd MMM yyyy')}</span>.
            The parent storage record will be updated to reflect this change (bags will be returned to stock, etc.). This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isPending}
          >
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Delete Outflow
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
