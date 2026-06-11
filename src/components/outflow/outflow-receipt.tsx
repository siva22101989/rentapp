'use client';

import React, { useMemo } from 'react';
import type { Customer, StorageRecord, WarehouseInfo, Outflow } from '@/lib/definitions';
import { format } from 'date-fns';
import { toDate, formatCurrency } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '../ui/table';
import { Badge } from '../ui/badge';

type OutflowReceiptProps = {
  records: StorageRecord[];
  customer: Customer;
  warehouseInfo: WarehouseInfo | null;
  pattiNo: string;
  paidNow?: number;
};

export const OutflowReceipt = React.forwardRef<HTMLDivElement, OutflowReceiptProps>(
  ({ records, customer, warehouseInfo, pattiNo, paidNow = 0 }, ref) => {
    
    const generatedDate = useMemo(() => format(new Date(), 'dd MMM yyyy, hh:mm a'), []);
    
    const breakdownItems = useMemo(() => {
        const items: any[] = [];
        let totalBags = 0;
        let totalRent = 0;
        let totalDiscount = 0;
        let totalKhata = 0;
        let pattiDate = new Date();

        records.forEach(r => {
            const batchOutflows = (r.outflows || []).filter(o => String(o.pattiNo) === String(pattiNo));
            batchOutflows.forEach(o => {
                const rentVal = Number(o.rentBilled) || 0;
                const bagsVal = Number(o.bagsWithdrawn) || 0;
                totalBags += bagsVal;
                totalRent += rentVal;
                totalDiscount += (o.discount || 0);
                pattiDate = toDate(o.date);

                items.push({
                    recordId: r.id,
                    location: r.location || 'N/A',
                    inflowDate: toDate(r.storageStartDate),
                    bags: bagsVal,
                    rent: rentVal,
                    isClosed: (Number(r.bagsStored) <= 0.05)
                });
            });
            totalKhata = Number(r.khataAmount) || totalKhata; // Assume khata is on one of the records
        });

        return { items, totalBags, totalRent, totalDiscount, totalKhata, pattiDate };
    }, [records, pattiNo]);

    const { items, totalBags, totalRent, totalDiscount, totalKhata, pattiDate } = breakdownItems;
    
    const subTotal = totalRent + totalKhata;
    const grandTotal = subTotal - totalDiscount;
    const balanceDue = grandTotal - paidNow;

    return (
      <div ref={ref} className="bg-white p-6 sm:p-10 border-2 border-black font-sans text-slate-900 max-w-[800px] w-full shadow-2xl">
          <div className="text-center mb-8">
              <h1 className="text-3xl font-black tracking-tighter text-slate-900 uppercase">{warehouseInfo?.name || 'SRI LAKSHMI WAREHOUSE'}</h1>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">{warehouseInfo?.addressLine1} {warehouseInfo?.addressLine2}</p>
              <p className="text-xs font-bold text-slate-500">Phone: {warehouseInfo?.phone || ''}</p>
              <div className="h-px bg-slate-200 w-1/2 mx-auto my-4" />
              <h2 className="text-lg font-black uppercase tracking-[0.3em] text-primary">Outflow Bill (Consolidated)</h2>
          </div>
          
          <div className="flex justify-between items-start mb-8 gap-8">
              <div className="space-y-3">
                  <div className="space-y-0.5">
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Bill #</p>
                    <p className="font-mono font-black text-lg text-primary">{pattiNo}</p>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Customer</p>
                    <p className="font-bold text-base">{customer.name}</p>
                    <p className="text-xs text-slate-500">{customer.village || 'N/A'}, {customer.phone}</p>
                    <p className="text-[10px] font-bold text-slate-400">Customer ID: {customer.id.substring(0, 5)}</p>
                  </div>
              </div>
              <div className="text-right space-y-3">
                  <div className="space-y-0.5">
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Date</p>
                    <p className="font-bold text-base">{format(pattiDate, 'dd MMM yyyy')}</p>
                  </div>
                   <div className="space-y-0.5">
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Commodity</p>
                    <p className="font-bold text-base">{records[0]?.commodityDescription || 'Misc'}</p>
                  </div>
              </div>
          </div>

          <div className="mb-6">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Outflow Breakdown</h3>
              <div className="border rounded-xl overflow-hidden shadow-sm">
                  <Table className="text-[13px]">
                      <TableHeader className="bg-slate-50">
                          <TableRow className="h-10 hover:bg-slate-50">
                              <TableHead className="font-black text-slate-600 uppercase text-[10px]">Record #</TableHead>
                              <TableHead className="font-black text-slate-600 uppercase text-[10px]">Location</TableHead>
                              <TableHead className="font-black text-slate-600 uppercase text-[10px]">Stored Since</TableHead>
                              <TableHead className="text-right font-black text-slate-600 uppercase text-[10px]">Bags</TableHead>
                              <TableHead className="text-right font-black text-slate-600 uppercase text-[10px]">Rent (₹)</TableHead>
                              <TableHead className="text-center font-black text-slate-600 uppercase text-[10px]">Status</TableHead>
                          </TableRow>
                      </TableHeader>
                      <TableBody>
                          {items.map((item, idx) => (
                              <TableRow key={idx} className="h-11 border-b last:border-0 border-slate-100">
                                  <TableCell className="font-mono font-bold text-slate-400">#{item.recordId}</TableCell>
                                  <TableCell className="font-bold">{item.location}</TableCell>
                                  <TableCell className="font-medium text-slate-500">{format(item.inflowDate, 'dd MMM yyyy')}</TableCell>
                                  <TableCell className="text-right font-mono font-black">{item.bags}</TableCell>
                                  <TableCell className="text-right font-mono font-bold">{formatCurrency(item.rent)}</TableCell>
                                  <TableCell className="text-center">
                                      <Badge variant="secondary" className={item.isClosed ? "bg-red-50 text-red-600 border-red-100 uppercase text-[9px] font-black" : "bg-green-50 text-green-600 border-green-100 uppercase text-[9px] font-black"}>
                                          {item.isClosed ? 'Closed' : 'Active'}
                                      </Badge>
                                  </TableCell>
                              </TableRow>
                          ))}
                      </TableBody>
                      <TableFooter className="bg-slate-50/80">
                          <TableRow className="h-12 hover:bg-slate-50/80">
                              <TableCell colSpan={3} className="font-black text-slate-900 uppercase text-[11px] px-4">Total</TableCell>
                              <TableCell className="text-right font-mono font-black text-lg">{totalBags}</TableCell>
                              <TableCell className="text-right font-mono font-black text-lg">{formatCurrency(totalRent)}</TableCell>
                              <TableCell />
                          </TableRow>
                      </TableFooter>
                  </Table>
              </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-100">
              <div className="w-full max-w-[280px] space-y-3">
                  <div className="flex justify-between items-center text-sm">
                      <span className="font-medium text-slate-500">Total Rent (Subtotal)</span>
                      <span className="font-mono font-bold">{formatCurrency(totalRent)}</span>
                  </div>
                  {totalKhata > 0 && (
                       <div className="flex justify-between items-center text-sm">
                        <span className="font-medium text-slate-500">Khata (Weighbridge)</span>
                        <span className="font-mono font-bold">{formatCurrency(totalKhata)}</span>
                    </div>
                  )}
                  {totalDiscount > 0 && (
                       <div className="flex justify-between items-center text-sm text-green-600">
                        <span className="font-medium">Batch Discount (-)</span>
                        <span className="font-mono font-bold">{formatCurrency(totalDiscount)}</span>
                    </div>
                  )}
                  <div className="h-px bg-slate-900" />
                  <div className="flex justify-between items-center">
                      <span className="font-black text-sm uppercase tracking-widest text-slate-900">Total Bill</span>
                      <span className="font-mono font-black text-xl">{formatCurrency(grandTotal)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                      <span className="font-black text-[10px] uppercase tracking-widest text-slate-400">Cash Received Now</span>
                      <span className="font-mono font-black text-base text-green-600">-{formatCurrency(paidNow)}</span>
                  </div>
                   <div className="flex justify-between items-center pt-2 border-t-2 border-primary/20">
                      <span className="font-black text-sm uppercase tracking-tighter text-primary">Balance Due</span>
                      <span className="font-mono font-black text-xl text-primary underline decoration-primary/30 underline-offset-4">{formatCurrency(balanceDue)}</span>
                  </div>
              </div>
          </div>
          
          <div className="mt-16 pt-12 flex justify-between items-end border-t border-slate-50">
              <div className="text-[10px] text-slate-400 italic">
                  <p>Printed: {generatedDate}</p>
                  <p>Records in batch: {records.length}</p>
                  <p className="mt-2 font-bold text-slate-500">Note: This is a system-generated audit document.</p>
              </div>
              <div className="text-center w-64">
                <div className="h-px bg-slate-900 w-full mb-2" />
                <p className="font-black text-[10px] uppercase tracking-[0.2em] text-slate-900">Authorized Manager Signature</p>
                <p className="text-[9px] font-bold text-primary uppercase mt-1">Sri Lakshmi Warehouse Operations</p>
              </div>
          </div>
      </div>
    );
})

OutflowReceipt.displayName = 'OutflowReceipt';
