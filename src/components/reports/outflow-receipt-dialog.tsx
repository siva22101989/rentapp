
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
import type { Customer, StorageRecord, WarehouseInfo, Outflow } from '@/lib/definitions';

type OutflowReceiptDialogProps = {
  record: StorageRecord;
  customer: Customer;
  warehouseInfo: WarehouseInfo | null;
  outflow: Outflow;
  children: React.ReactNode;
  deliveryOrderNo: string;
  deliveryOrderDate: Date;
}

export function OutflowReceiptDialog({ record, customer, warehouseInfo, outflow, children, deliveryOrderNo, deliveryOrderDate }: OutflowReceiptDialogProps) {
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
          <DialogTitle>Outflow Bill</DialogTitle>
        </DialogHeader>
        <div className="max-h-[70vh] overflow-y-auto p-2 printable-area">
            <OutflowReceipt
                record={record}
                customer={customer}
                warehouseInfo={warehouseInfo}
                withdrawnBags={outflow.bagsWithdrawn}
                finalRent={outflow.rentBilled}
                paidNow={0} 
                discount={outflow.discount || 0}
                deliveryOrderNo={deliveryOrderNo}
                deliveryOrderDate={deliveryOrderDate}
            />
        </div>
      </DialogContent>
    </Dialog>
  );
}
