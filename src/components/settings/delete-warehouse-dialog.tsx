
'use client';

import { useState, useTransition } from 'react';
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
import { useToast } from '@/hooks/use-toast';
import { Button } from '../ui/button';
import { Loader2 } from 'lucide-react';
import { useFirestore } from '@/firebase/provider';
import { deleteManagedWarehouse } from '@/lib/data';
import type { ManagedWarehouse } from '@/lib/definitions';

export function DeleteWarehouseDialog({
  warehouse,
  children,
}: {
  warehouse: ManagedWarehouse;
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
        await deleteManagedWarehouse(firestore, warehouse.id);
        toast({ title: 'Success', description: `Warehouse "${warehouse.name}" and its owner have been deleted.` });
        setIsOpen(false);
      } catch (error) {
         toast({
          title: 'Error',
          description: error instanceof Error ? error.message : 'Failed to delete warehouse.',
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
            This action cannot be undone. This will permanently delete the subscription for <span className="font-bold">{warehouse.name}</span> and remove its owner's login access.
            <strong className="mt-2 block">This will NOT delete the warehouse's internal data (customers, records, etc.).</strong>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isPending}
            className="bg-destructive hover:bg-destructive/90"
          >
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Yes, delete subscription
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
