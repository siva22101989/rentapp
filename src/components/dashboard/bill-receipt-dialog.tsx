'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { InflowReceipt } from '../inflow/inflow-receipt';
import type { Customer, StorageRecord, WarehouseInfo } from '@/lib/definitions';
import { useDoc } from '@/firebase/firestore/use-doc';
import { useFirestore } from '@/firebase/provider';
import { doc } from 'firebase/firestore';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { useAppUser } from '@/firebase/auth/use-user';
import { Button } from '../ui/button';
import { Printer } from 'lucide-react';

export function BillReceiptDialog({
  record,
  customer,
  children,
}: {
  record: StorageRecord;
  customer: Customer;
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const firestore = useFirestore();
  const appUser = useAppUser();

  const warehouseInfoRef = useMemoFirebase(
    () => (firestore && appUser?.warehouseId ? doc(firestore, 'warehouses', appUser.warehouseId) : null),
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

  const handlePrint = () => {
    window.print();
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[95vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-4 border-b">
          <DialogTitle>Inflow Receipt</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-50/50">
            <div className="dialog-print-area">
                {loadingWarehouseInfo ? <div>Loading...</div> : (
                  <InflowReceipt record={record} customer={customer} warehouseInfo={warehouseInfo} />
                )}
            </div>
        </div>
        <DialogFooter className="p-4 border-t bg-white print-hide">
            <Button variant="default" onClick={handlePrint} className="w-full sm:w-auto font-bold h-11 px-8">
                <Printer className="mr-2 h-4 w-4" />
                Print Bill
            </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}