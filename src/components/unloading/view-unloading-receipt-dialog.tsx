
'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { UnloadingReceipt } from './unloading-receipt';
import type { Customer, UnloadingRecord, WarehouseInfo } from '@/lib/definitions';
import { useDoc } from '@/firebase/firestore/use-doc';
import { useFirestore } from '@/firebase/provider';
import { doc } from 'firebase/firestore';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { useAppUser } from '@/firebase/auth/use-user';

export function ViewUnloadingReceiptDialog({
  record,
  customer,
  children,
}: {
  record: UnloadingRecord;
  customer: Customer;
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const firestore = useFirestore();
  const appUser = useAppUser();

  const warehouseInfoRef = useMemoFirebase(
    () => (firestore && appUser ? doc(firestore, 'settings', 'main') : null),
    [firestore, appUser]
  );
  const { data: warehouseInfo, loading: loadingWarehouseInfo } = useDoc<WarehouseInfo>(warehouseInfoRef);

  useEffect(() => {
    if (isOpen) {
      document.body.classList.add('print-dialog-is-open');
    } else {
      document.body.classList.remove('print-dialog-is-open');
    }
    return () => {
      document.body.classList.remove('print-dialog-is-open');
    };
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Unloading Bill</DialogTitle>
        </DialogHeader>
        <div className="max-h-[70vh] overflow-y-auto p-2 printable-area">
            {loadingWarehouseInfo ? <div>Loading...</div> : (
              <UnloadingReceipt record={record} customer={customer} warehouseInfo={warehouseInfo} />
            )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
