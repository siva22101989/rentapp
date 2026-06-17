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
import { OutflowReceipt } from '../outflow/outflow-receipt';
import type { Customer, StorageRecord, WarehouseInfo } from '@/lib/definitions';
import { Button } from '../ui/button';
import { Printer } from 'lucide-react';

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

  const handlePrint = () => {
    window.print();
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[95vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-4 border-b">
          <DialogTitle>Outflow Bill Breakdown</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-50/50">
            <div className="dialog-print-area">
                <OutflowReceipt
                    records={records}
                    customer={customer}
                    warehouseInfo={warehouseInfo}
                    pattiNo={pattiNo}
                />
            </div>
        </div>
        <DialogFooter className="p-4 border-t bg-white print-hide">
            <Button variant="default" onClick={handlePrint} className="w-full sm:w-auto font-bold h-11 px-8">
                <Printer className="mr-2 h-4 w-4" />
                Print Clean Bill
            </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}