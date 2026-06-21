'use client';

import React, { useMemo } from 'react';
import type { Customer, StorageRecord, WarehouseInfo, Outflow } from '@/lib/definitions';
import { format, differenceInMonths } from 'date-fns';
import { toDate, formatCurrency } from '@/lib/utils';

type OutflowReceiptProps = {
  records: StorageRecord[];
  customer: Customer;
  warehouseInfo: WarehouseInfo | null;
  pattiNo: string;
  paidNow?: number;
};

export const OutflowReceipt = React.forwardRef<HTMLDivElement, OutflowReceiptProps>(
  ({ records, customer, warehouseInfo, pattiNo, paidNow = 0 }, ref) => {
    
    const generatedDate = useMemo(() => format(new Date(), 'dd/MM/yyyy, hh:mm a'), []);
    
    const breakdownItems = useMemo(() => {
        const items: any[] = [];
        let totalBags = 0;
        let totalRent = 0;
        let totalDiscount = 0;
        let totalKhata = 0;
        let pattiDate = new Date();

        const sortedRecords = [...records].sort((a,b) => (a.location || '').localeCompare(b.location || '', undefined, {numeric: true}));

        sortedRecords.forEach(r => {
            const batchOutflows = (r.outflows || []).filter(o => String(o.pattiNo).replace(/\D/g, '') === String(pattiNo).replace(/\D/g, ''));
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
      <div ref={ref} className="bg-white p-4 sm:p-8 font-sans text-black w-full mx-auto print:p-0 print:border-none dialog-print-area">
          <style jsx>{`
              table.no-border, table.no-border td { border: none !important; }
              @media screen {
                  .bill-table-container { overflow-x: auto; -webkit-overflow-scrolling: touch; }
                  .bill-table { min-width: 700px; width: 100%; }
              }
          `}</style>

          {/* Header */}
          <div className="text-center mb-6 border-b-2 border-black pb-4">
              <h1 className="text-xl sm:text-2xl font-black uppercase tracking-tight leading-none mb-1">{warehouseInfo?.name || 'SRI LAKSHMI WAREHOUSE'}</h1>
              <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-600">
                {warehouseInfo?.addressLine1} • {warehouseInfo?.addressLine2}
              </p>
              <p className="text-xs sm:text-sm font-black mt-1">Phone: {warehouseInfo?.phone || ''}</p>
              <div className="mt-4 py-1.5 px-6 sm:px-8 border-2 border-black inline-block font-black text-lg sm:text-xl tracking-[0.2em] uppercase">
                Outflow Bill
              </div>
          </div>
          
          {/* Info Section */}
          <div className="mb-6">
            <table className="w-full text-[12px] sm:text-[13px] border-collapse no-border">
              <tbody>
                <tr>
                  <td className="py-1 align-top w-[55%] border-none">
                    <table className="w-full no-border">
                      <tbody>
                          <tr><td className="font-bold w-24 sm:w-28 uppercase text-[10px] text-slate-500 py-0.5">Bill No</td><td className="py-0.5">: <span className="font-mono font-black text-base">{pattiNo}</span></td></tr>
                          <tr><td className="font-bold w-24 sm:w-28 uppercase text-[10px] text-slate-500 py-0.5">Customer</td><td className="py-0.5">: <span className="font-black uppercase">{customer.name}</span></td></tr>
                          <tr><td className="font-bold w-24 sm:w-28 uppercase text-[10px] text-slate-500 py-0.5">Village</td><td className="py-0.5">: <span className="uppercase">{customer.village || 'N/A'}</span></td></tr>
                      </tbody>
                    </table>
                  </td>
                  <td className="py-1 align-top text-right border-none">
                    <table className="w-full no-border">
                      <tbody>
                          <tr><td className="font-bold uppercase text-[10px] text-slate-500 py-0.5">Date</td><td className="py-0.5">: <span className="font-bold">{format(pattiDate, 'dd/MM/yyyy')}</span></td></tr>
                          <tr><td className="font-bold uppercase text-[10px] text-slate-500 py-0.5">Product</td><td className="py-0.5">: <span className="font-bold uppercase">{records[0]?.commodityDescription || 'Misc'}</span></td></tr>
                      </tbody>
                    </table>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Breakdown Table */}
          <div className="mb-6 bill-table-container">
              <table className="bill-table border-2 border-black border-collapse text-[11px] sm:text-[12px]">
                  <thead>
                      <tr className="bg-slate-50 border-b-2 border-black h-10">
                          <th className="font-black uppercase text-[10px] text-center w-[15%] border-r border-black">Lot No.</th>
                          <th className="font-black uppercase text-[10px] text-center w-[18%] border-r border-black">Inflow Date</th>
                          <th className="font-black uppercase text-[10px] text-center w-[12%] border-r border-black">Months</th>
                          <th className="font-black uppercase text-[10px] text-right px-2 w-[12%] border-r border-black">Bags</th>
                          <th className="font-black uppercase text-[10px] text-right px-2 w-[25%] border-r border-black">Rate Math</th>
                          <th className="font-black uppercase text-[10px] text-right px-2 w-[18%]">Rent Amount</th>
                      </tr>
                  </thead>
                  <tbody>
                      {items.map((item, idx) => (
                          <tr key={idx} className="border-b border-black h-10">
                              <td className="text-center font-bold border-r border-black">{item.location}</td>
                              <td className="text-center border-r border-black">{format(item.inflowDate, 'dd/MM/yy')}</td>
                              <td className="text-center font-bold border-r border-black">{item.duration} M</td>
                              <td className="text-right px-2 font-mono font-black border-r border-black">{item.bags}</td>
                              <td className="text-right px-2 font-mono text-[10px] border-r border-black">
                                  {item.bags} × {item.rentPerBag.toFixed(2)}
                              </td>
                              <td className="text-right px-2 font-mono font-bold">{formatCurrency(item.rent)}</td>
                          </tr>
                      ))}
                      <tr className="bg-slate-50 font-black border-t-2 border-black h-10">
                          <td colSpan={3} className="text-right uppercase text-[10px] px-2 border-r border-black">Total Withdrawal</td>
                          <td className="text-right font-mono text-base px-2 border-r border-black">{totalBags}</td>
                          <td className="border-r border-black"></td>
                          <td className="text-right font-mono text-base px-2">{formatCurrency(totalRent)}</td>
                      </tr>
                  </tbody>
              </table>
          </div>

          {/* Financial Summary */}
          <div className="flex justify-end pt-2">
              <table className="w-full sm:w-[320px] border-2 border-black border-collapse bg-slate-50">
                  <tbody>
                      <tr className="border-b border-black text-[12px]">
                          <td className="p-2 font-bold uppercase border-r border-black">Subtotal Rent</td>
                          <td className="p-2 text-right font-mono font-bold">{formatCurrency(totalRent)}</td>
                      </tr>
                      {totalKhata > 0 && (
                        <tr className="border-b border-black text-[12px]">
                            <td className="p-2 font-bold uppercase border-r border-black">Khata Charges</td>
                            <td className="p-2 text-right font-mono font-bold">{formatCurrency(totalKhata)}</td>
                        </tr>
                      )}
                      {totalDiscount > 0 && (
                        <tr className="border-b border-black text-[12px] text-green-700 font-bold">
                            <td className="p-2 font-bold uppercase border-r border-black">Discount (-)</td>
                            <td className="p-2 text-right font-mono">{formatCurrency(totalDiscount)}</td>
                        </tr>
                      )}
                      <tr className="bg-white border-b-2 border-black">
                          <td className="p-2 font-black text-xs uppercase border-r border-black">Grand Total</td>
                          <td className="p-2 text-right font-mono font-black text-lg">{formatCurrency(grandTotal)}</td>
                      </tr>
                      <tr className="text-[12px]">
                          <td className="p-2 font-bold uppercase text-slate-500 border-r border-black">Paid Now</td>
                          <td className="p-2 text-right font-mono font-bold text-green-700">-{formatCurrency(paidNow)}</td>
                      </tr>
                      <tr className="bg-slate-900 text-white h-12">
                          <td className="p-2 font-black text-sm uppercase border-r border-white">Net Balance</td>
                          <td className="p-2 text-right font-mono font-black text-lg underline underline-offset-4">{formatCurrency(balanceDue)}</td>
                      </tr>
                  </tbody>
              </table>
          </div>
          
          {/* Signatures */}
          <div className="mt-16 sm:mt-24">
              <table className="w-full no-border">
                <tbody>
                  <tr>
                    <td className="w-1/2 text-center align-bottom border-none">
                      <div className="border-t border-black pt-2 mx-auto w-[160px] font-bold text-[10px] uppercase tracking-widest">Depositor Sign</div>
                    </td>
                    <td className="w-1/2 text-center align-bottom border-none">
                      <div className="border-t-2 border-black pt-2 mx-auto w-[160px] font-black text-[10px] uppercase tracking-widest">Authorized Auditor</div>
                      <p className="text-[9px] font-bold text-slate-500 uppercase mt-1">{warehouseInfo?.name}</p>
                    </td>
                  </tr>
                </tbody>
              </table>
          </div>

          {/* Footer */}
          <div className="mt-10 sm:mt-12 pt-6 text-[9px] text-slate-400 italic text-center border-t border-slate-100">
              <p>Audit Ref: {pattiNo} • Generated on {generatedDate}</p>
              <p>This is a computer-generated document and does not require a physical signature.</p>
          </div>
      </div>
    );
  }
)

OutflowReceipt.displayName = 'OutflowReceipt';