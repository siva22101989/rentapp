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
      <div ref={ref} className="bg-white p-10 border-2 border-black font-sans text-black max-w-[850px] w-full shadow-none print:p-0 print:border-none mx-auto">
          <div className="text-center mb-10 border-b-2 border-black pb-6">
              <h1 className="text-4xl font-black tracking-tight uppercase leading-none">{warehouseInfo?.name || 'SRI LAKSHMI WAREHOUSE'}</h1>
              <p className="text-xs font-bold mt-2 uppercase tracking-widest text-slate-600">
                {warehouseInfo?.addressLine1} • {warehouseInfo?.addressLine2}
              </p>
              <p className="text-sm font-black mt-1">Phone: {warehouseInfo?.phone || ''}</p>
              <div className="mt-6 py-2 px-8 border-2 border-black inline-block font-black text-2xl tracking-[0.2em] uppercase">
                Outflow Bill
              </div>
          </div>
          
          <div className="grid grid-cols-2 gap-12 mb-8 text-sm">
              <div className="space-y-2">
                  <div className="flex"><span className="font-bold w-32 uppercase text-[10px] text-slate-500">Bill Number</span>: <span className="font-mono font-black text-lg">{pattiNo}</span></div>
                  <div className="flex"><span className="font-bold w-32 uppercase text-[10px] text-slate-500">Customer</span>: <span className="font-black uppercase">{customer.name}</span></div>
                  <div className="flex"><span className="font-bold w-32 uppercase text-[10px] text-slate-500">Village</span>: <span className="uppercase">{customer.village || 'N/A'}</span></div>
                  <div className="flex"><span className="font-bold w-32 uppercase text-[10px] text-slate-500">Contact No</span>: {customer.phone}</div>
              </div>
              <div className="text-right space-y-2">
                  <div className="flex justify-end"><span className="font-bold uppercase text-[10px] text-slate-500 w-32">Date</span>: <span className="font-bold">{format(pattiDate, 'dd MMMM yyyy')}</span></div>
                   <div className="flex justify-end"><span className="font-bold uppercase text-[10px] text-slate-500 w-32">Commodity</span>: <span className="font-bold uppercase">{records[0]?.commodityDescription || 'Misc'}</span></div>
              </div>
          </div>

          <div className="mb-8">
              <Table className="border-2 border-black w-full table-fixed">
                  <TableHeader>
                      <TableRow className="border-b-2 border-black bg-slate-50 h-12">
                          <TableHead className="font-black text-black uppercase text-[10px] text-center w-20 border-r border-black">Lot No</TableHead>
                          <TableHead className="font-black text-black uppercase text-[10px] text-center w-28 border-r border-black">Inflow Date</TableHead>
                          <TableHead className="font-black text-black uppercase text-[10px] text-center w-24 border-r border-black">Duration</TableHead>
                          <TableHead className="font-black text-black uppercase text-[10px] text-right w-24 border-r border-black">Bags</TableHead>
                          <TableHead className="font-black text-black uppercase text-[10px] text-right w-32">Rent Calculation</TableHead>
                          <TableHead className="font-black text-black uppercase text-[10px] text-right w-28">Amount (₹)</TableHead>
                      </TableRow>
                  </TableHeader>
                  <TableBody>
                      {items.map((item, idx) => (
                          <TableRow key={idx} className="h-14 border-b border-black">
                              <TableCell className="text-center font-bold border-r border-black">{item.location}</TableCell>
                              <TableCell className="text-center font-medium border-r border-black whitespace-nowrap">{format(item.inflowDate, 'dd/MM/yy')}</TableCell>
                              <TableCell className="text-center font-bold border-r border-black">
                                  {item.duration} {item.duration === 1 ? 'Month' : 'Months'}
                              </TableCell>
                              <TableCell className="text-right font-mono font-black border-r border-black">{item.bags}</TableCell>
                              <TableCell className="text-right font-mono text-[11px] border-r border-black text-slate-500">
                                  {item.bags} bags × {item.rentPerBag.toFixed(2)}
                              </TableCell>
                              <TableCell className="text-right font-mono font-bold">{formatCurrency(item.rent)}</TableCell>
                          </TableRow>
                      ))}
                  </TableBody>
                  <TableFooter>
                      <TableRow className="h-14 bg-slate-50 font-black border-t-2 border-black">
                          <TableCell colSpan={3} className="text-right uppercase text-xs px-4">Consolidated Totals</TableCell>
                          <TableCell className="text-right font-mono text-lg border-r border-black">{totalBags}</TableCell>
                          <TableCell className="border-r border-black"></TableCell>
                          <TableCell className="text-right font-mono text-lg">{formatCurrency(totalRent)}</TableCell>
                      </TableRow>
                  </TableFooter>
              </Table>
          </div>

          <div className="flex justify-end pt-2">
              <div className="w-full max-w-[320px] space-y-3 border-2 border-black p-4 bg-slate-50">
                  <div className="flex justify-between items-center text-xs">
                      <span className="font-bold uppercase tracking-wider">Total Rent Subtotal</span>
                      <span className="font-mono font-bold">{formatCurrency(totalRent)}</span>
                  </div>
                  {totalKhata > 0 && (
                       <div className="flex justify-between items-center text-xs">
                        <span className="font-bold uppercase tracking-wider">Khata (Weighbridge)</span>
                        <span className="font-mono font-bold">{formatCurrency(totalKhata)}</span>
                    </div>
                  )}
                  {totalDiscount > 0 && (
                       <div className="flex justify-between items-center text-xs text-green-700">
                        <span className="font-bold uppercase tracking-wider">Total Discount (-)</span>
                        <span className="font-mono font-bold">{formatCurrency(totalDiscount)}</span>
                    </div>
                  )}
                  <div className="h-0.5 bg-black" />
                  <div className="flex justify-between items-center py-1">
                      <span className="font-black text-sm uppercase tracking-widest">Grand Total</span>
                      <span className="font-mono font-black text-2xl">{formatCurrency(grandTotal)}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                      <span className="font-bold uppercase tracking-wider text-slate-500">Amount Paid Now</span>
                      <span className="font-mono font-bold text-green-700">-{formatCurrency(paidNow)}</span>
                  </div>
                   <div className="flex justify-between items-center pt-2 border-t-2 border-black mt-2">
                      <span className="font-black text-lg uppercase tracking-tighter">Balance Due</span>
                      <span className="font-mono font-black text-2xl underline decoration-double">{formatCurrency(balanceDue)}</span>
                  </div>
              </div>
          </div>
          
          <div className="mt-24 grid grid-cols-2 gap-20 text-center">
              <div className="space-y-2">
                <div className="h-px bg-black w-full" />
                <p className="font-bold text-[10px] uppercase tracking-widest">Customer Signature</p>
              </div>
              <div className="space-y-2">
                <div className="h-px bg-black w-full" />
                <p className="font-black text-[12px] uppercase tracking-widest">Authorized Manager Signature</p>
                <p className="text-[9px] font-bold text-slate-500 uppercase mt-1 tracking-tighter">Sri Lakshmi Warehouse Operations</p>
              </div>
          </div>

          <div className="mt-16 text-[9px] text-slate-400 italic text-center border-t border-slate-100 pt-6">
              <p>Document Identification Hash: {Math.random().toString(36).substring(7).toUpperCase()}</p>
              <p>Generated on {generatedDate} • Transaction includes {records.length} database entries.</p>
              <p className="mt-2 font-bold text-slate-500">Disclaimer: This is a system-generated financial audit document.</p>
          </div>
      </div>
    );
  }
)

OutflowReceipt.displayName = 'OutflowReceipt';