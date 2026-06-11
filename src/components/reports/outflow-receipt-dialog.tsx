
'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { OutflowReceipt } from '../outflow/outflow-receipt';
import type { Customer, StorageRecord, WarehouseInfo } from '@/lib/definitions';

type OutflowReceiptDialogProps = {
  records: StorageRecord[];
  customer: Customer;
  warehouseInfo: WarehouseInfo | null;
  pattiNo: string;
  children: React.ReactNode;
}

export function OutflowReceiptDialog({ records, customer, warehouseInfo, pattiNo, children }: OutflowReceiptDialogProps) {
  const [isOpen, setIsOpen] = useState(false);

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
          <DialogTitle>Outflow Bill (Consolidated)</DialogTitle>
        </DialogHeader>
        <div className="max-h-[70vh] overflow-y-auto p-2 printable-area">
            <OutflowReceipt
                records={records}
                customer={customer}
                warehouseInfo={warehouseInfo}
                pattiNo={pattiNo}
            />
        </div>
      </DialogContent>
    </Dialog>
  );
}
