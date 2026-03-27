
'use client';

import { useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '../ui/button';
import { Download, Printer } from 'lucide-react';
import { UnloadingReceipt } from './unloading-receipt';
import type { Customer, UnloadingRecord, WarehouseInfo } from '@/lib/definitions';
import { useDoc } from '@/firebase/firestore/use-doc';
import { useFirestore } from '@/firebase/provider';
import { doc } from 'firebase/firestore';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { printElement } from '@/lib/print-util';

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
  const receiptRef = useRef<HTMLDivElement>(null);
  const firestore = useFirestore();

  const warehouseInfoRef = useMemoFirebase(
    () => (firestore ? doc(firestore, 'settings', 'main') : null),
    [firestore]
  );
  const { data: warehouseInfo, loading: loadingWarehouseInfo } = useDoc<WarehouseInfo>(warehouseInfoRef);


  const handleGenerate = () => {
    const element = receiptRef.current;
    if (!element) return;
    printElement(element, `Unloading Bill ${record.billNo}`);
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Unloading Bill</DialogTitle>
        </DialogHeader>
        <div className="max-h-[70vh] overflow-y-auto p-2">
            {loadingWarehouseInfo ? <div>Loading...</div> : (
              <UnloadingReceipt ref={receiptRef} record={record} customer={customer} warehouseInfo={warehouseInfo} />
            )}
        </div>
        <DialogFooter className="sm:justify-end gap-2">
          <Button variant="outline" onClick={handleGenerate}>
              <Printer className="mr-2 h-4 w-4" />
              Print
          </Button>
          <Button onClick={handleGenerate}>
              <Download className="mr-2 h-4 w-4" />
              Download PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
