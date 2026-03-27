
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
import { OutflowReceipt } from '../outflow/outflow-receipt';
import type { Customer, StorageRecord, WarehouseInfo, Outflow } from '@/lib/definitions';
import { printElement } from '@/lib/print-util';

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
  const receiptRef = useRef<HTMLDivElement>(null);

  const handleGenerate = () => {
    const element = receiptRef.current;
    if (!element) return;
    printElement(element, `Outflow Bill ${deliveryOrderNo}`);
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Outflow Bill</DialogTitle>
        </DialogHeader>
        <div className="max-h-[70vh] overflow-y-auto p-2">
            <OutflowReceipt
                ref={receiptRef}
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
