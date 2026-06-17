'use client';

import React, { useMemo } from 'react';
import type { Customer, StorageRecord, WarehouseInfo, Outflow } from '@/lib/definitions';
import { format, differenceInMonths } from 'date-fns';
import { toDate, formatCurrency } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '../ui/table';

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
                
                const currentOutflowDate = toDate(o.date);
                pattiDate = currentOutflowDate;

                const inflowDate = toDate(r.storageStartDate);
                const monthsStored = Math.max(1, differenceInMonths(currentOutflowDate, inflowDate) + 1);

                items.push({
                    recordId: r.id,
                    location: r.location || 'N/A',
                    inflowDate: inflowDate,
                    duration: monthsStored,
                    bags: bagsVal,
                    rent: rentVal,
                    rentPerBag: bagsVal > 0 ? rentVal / bagsVal : 0,
                });
            });
            totalKhata = Number(r.khataAmount) || totalKhata; 
        });

        return { items, totalBags, totalRent, totalDiscount, totalKhata, pattiDate };
    }, [records, pattiNo]);

    const { items, totalBags, totalRent, totalDiscount, totalKhata, pattiDate } = breakdownItems;
    
    const subTotal = totalRent + totalKhata;
    const grandTotal = subTotal - totalDiscount;
    const balanceDue = grandTotal - paidNow;

    return (
      <div ref={ref} className="bg-white p-8 border-2 border-black font-sans text-black max-w-[850px] w-full shadow-none print:p-0 print:border-none mx-auto dialog-print-area">
          <div className="text-center mb-8 border-b-2 border-black pb-4">
              <h1 className="text-2xl font-black tracking-tight uppercase leading-none">{warehouseInfo?.name || 'SRI LAKSHMI WAREHOUSE'}</h1>
              <p className="text-[10px] font-bold mt-1 uppercase tracking-widest text-slate-600">
                {warehouseInfo?.addressLine1} • {warehouseInfo?.addressLine2}
              </p>
              <p className="text-sm font-black mt-1">Phone: {warehouseInfo?.phone || ''}</p>
              <div className="mt-4 py-1 px-6 border-2 border-black inline-block font-black text-xl tracking-widest uppercase">
                Outflow Bill
              </div>
          </div>
          
          <div className="grid grid-cols-2 gap-8 mb-6 text-[13px]">
              <div className="space-y-1">
                  <div className="flex"><span className="font-bold w-28 uppercase text-[9px] text-slate-500">Bill No</span>: <span className="font-mono font-black text-base">{pattiNo}</span></div>
                  <div className="flex"><span className="font-bold w-28 uppercase text-[9px] text-slate-500">Customer</span>: <span className="font-black uppercase">{customer.name}</span></div>
                  <div className="flex"><span className="font-bold w-28 uppercase text-[9px] text-slate-500">Village</span>: <span className="uppercase">{customer.village || 'N/A'}</span></div>
              </div>
              <div className="text-right space-y-1">
                  <div className="flex justify-end"><span className="font-bold uppercase text-[9px] text-slate-500 w-24">Date</span>: <span className="font-bold">{format(pattiDate, 'dd/MM/yyyy')}</span></div>
                   <div className="flex justify-end"><span className="font-bold uppercase text-[9px] text-slate-500 w-24">Product</span>: <span className="font-bold uppercase">{records[0]?.commodityDescription || 'Misc'}</span></div>
              </div>
          </div>

          <div className="mb-6">
              <Table className="border-2 border-black w-full table-fixed">
                  <TableHeader>
                      <TableRow className="border-b-2 border-black bg-slate-50 h-10">
                          <TableHead className="font-black text-black uppercase text-[9px] text-center w-[12%] border-r border-black">Lot</TableHead>
                          <TableHead className="font-black text-black uppercase text-[9px] text-center w-[18%] border-r border-black">Inflow</TableHead>
                          <TableHead className="font-black text-black uppercase text-[9px] text-center w-[15%] border-r border-black">Duration</TableHead>
                          <TableHead className="font-black text-black uppercase text-[9px] text-right w-[12%] border-r border-black">Bags</TableHead>
                          <TableHead className="font-black text-black uppercase text-[9px] text-right w-[25%] border-r border-black">Rent Math</TableHead>
                          <TableHead className="font-black text-black uppercase text-[9px] text-right w-[18%]">Amount (₹)</TableHead>
                      </TableRow>
                  </TableHeader>
                  <TableBody>
                      {items.map((item, idx) => (
                          <TableRow key={idx} className="h-10 border-b border-black">
                              <TableCell className="text-center font-bold border-r border-black">{item.location}</TableCell>
                              <TableCell className="text-center font-medium border-r border-black">{format(item.inflowDate, 'dd/MM/yy')}</TableCell>
                              <TableCell className="text-center font-bold border-r border-black">
                                  {item.duration} {item.duration === 1 ? 'Month' : 'Months'}
                              </TableCell>
                              <TableCell className="text-right font-mono font-black border-r border-black">{item.bags}</TableCell>
                              <TableCell className="text-right font-mono text-[10px] border-r border-black">
                                  {item.bags} × {item.rentPerBag.toFixed(2)}
                              </TableCell>
                              <TableCell className="text-right font-mono font-bold">{formatCurrency(item.rent)}</TableCell>
                          </TableRow>
                      ))}
                  </TableBody>
                  <TableFooter>
                      <TableRow className="h-10 bg-slate-50 font-black border-t-2 border-black">
                          <TableCell colSpan={3} className="text-right uppercase text-[10px] px-2">Totals</TableCell>
                          <TableCell className="text-right font-mono text-base border-r border-black">{totalBags}</TableCell>
                          <TableCell className="border-r border-black"></TableCell>
                          <TableCell className="text-right font-mono text-base">{formatCurrency(totalRent)}</TableCell>
                      </TableRow>
                  </TableFooter>
              </Table>
          </div>

          <div className="flex justify-end pt-2">
              <div className="w-full max-w-[280px] space-y-2 border-2 border-black p-3 bg-slate-50">
                  <div className="flex justify-between items-center text-[11px]">
                      <span className="font-bold uppercase">Subtotal Rent</span>
                      <span className="font-mono font-bold">{formatCurrency(totalRent)}</span>
                  </div>
                  {totalKhata > 0 && (
                       <div className="flex justify-between items-center text-[11px]">
                        <span className="font-bold uppercase">Khata/Weighbridge</span>
                        <span className="font-mono font-bold">{formatCurrency(totalKhata)}</span>
                    </div>
                  )}
                  {totalDiscount > 0 && (
                       <div className="flex justify-between items-center text-[11px] text-green-700">
                        <span className="font-bold uppercase">Discount (-)</span>
                        <span className="font-mono font-bold">{formatCurrency(totalDiscount)}</span>
                    </div>
                  )}
                  <div className="h-px bg-black" />
                  <div className="flex justify-between items-center py-0.5">
                      <span className="font-black text-xs uppercase">Grand Total</span>
                      <span className="font-mono font-black text-xl">{formatCurrency(grandTotal)}</span>
                  </div>
                  <div className="flex justify-between items-center text-[10px]">
                      <span className="font-bold uppercase text-slate-500">Collected</span>
                      <span className="font-mono font-bold text-green-700">-{formatCurrency(paidNow)}</span>
                  </div>
                   <div className="flex justify-between items-center pt-1 border-t border-black mt-1">
                      <span className="font-black text-sm uppercase">Balance Due</span>
                      <span className="font-mono font-black text-lg underline">{formatCurrency(balanceDue)}</span>
                  </div>
              </div>
          </div>
          
          <div className="mt-20 grid grid-cols-2 gap-20 text-center">
              <div className="space-y-1">
                <div className="h-px bg-black w-full" />
                <p className="font-bold text-[9px] uppercase tracking-widest">Customer Sign</p>
              </div>
              <div className="space-y-1">
                <div className="h-px bg-black w-full" />
                <p className="font-black text-[10px] uppercase tracking-widest">Authorized Auditor</p>
              </div>
          </div>

          <div className="mt-12 text-[8px] text-slate-400 italic text-center border-t border-slate-100 pt-4">
              <p>Generated on {generatedDate} • This is a computer-generated financial document.</p>
          </div>
      </div>
    );
  }
)

OutflowReceipt.displayName = 'OutflowReceipt';