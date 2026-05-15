'use client';

import React, { useMemo } from 'react';
import type { Customer, StorageRecord, WarehouseInfo } from '@/lib/definitions';
import { format, differenceInMonths } from 'date-fns';
import { formatCurrency, toDate } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '../ui/table';

type OutflowReceiptProps = {
  record: StorageRecord;
  customer: Customer;
  warehouseInfo: WarehouseInfo | null;
  withdrawnBags: number;
  finalRent: number;
  paidNow: number;
  discount: number;
  deliveryOrderNo: string;
  deliveryOrderDate: Date;
};

export const OutflowReceipt = React.forwardRef<HTMLDivElement, OutflowReceiptProps>(
  ({ record, customer, warehouseInfo, withdrawnBags, finalRent, paidNow, discount, deliveryOrderNo, deliveryOrderDate }, ref) => {
    
    const generatedDate = useMemo(() => format(new Date(), 'dd MMM yyyy, hh:mm a'), []);
    const formattedStartDate = format(toDate(record.storageStartDate), 'dd/MM/yyyy');
    const formattedEndDate = format(deliveryOrderDate, 'dd/MM/yyyy');
    
    const startDate = toDate(record.storageStartDate);
    const totalMonths = differenceInMonths(deliveryOrderDate, startDate) + 1;
    const rentPerBag = withdrawnBags > 0 ? finalRent / withdrawnBags : 0;

    const hPaid = (record.payments || []).filter(p => p.type === 'hamali').reduce((acc, p) => acc + p.amount, 0);
    const hamaliPending = Math.max(0, (record.hamaliPayable || 0) - hPaid);
    
    const totalAmount = finalRent + hamaliPending + (record.khataAmount || 0);
    const grandTotal = totalAmount - discount;
    const balanceDue = grandTotal - paidNow;

    return (
      <div ref={ref} className="bg-white p-4 sm:p-6 border-2 border-black font-sans text-lg text-black">
          <div className="text-center mb-4">
              <h1 className="text-2xl font-bold tracking-wider">{warehouseInfo?.name || 'Sri Lakshmi Warehouse'}</h1>
              <p className="text-sm">{warehouseInfo?.addressLine1 || 'Survey No. 165,237/2, Owk - Koilakuntla Road, OWK - 518 122,'}</p>
              <p className="text-sm">{warehouseInfo?.addressLine2 || 'Owk (M), Kurnool (Dt.), A.P.'} Cell: {warehouseInfo?.phone || '9703503423, 9160606633'}</p>
              <h2 className="font-bold underline text-center mt-4 text-lg">OUTFLOW BILL</h2>
          </div>
          
          <div className="grid grid-cols-2 gap-x-4 mb-4 text-base">
              <div>
                  <p><span className="font-bold">Bill No.:</span> {deliveryOrderNo}</p>
                  <p><span className="font-bold">Depositor:</span> {customer.name}</p>
                  <p><span className="font-bold">Village:</span> {customer.village || 'N/A'}</p>
              </div>
              <div className="text-right">
                  <p>{totalMonths} month(s) stored</p>
                  <p><span className="font-bold">Date:</span> {formattedEndDate}</p>
              </div>
          </div>

          <div className="border-y-2 border-black py-2 mb-4">
              <h2 className="font-bold text-center mb-2 text-base uppercase">Particulars of Withdrawal</h2>
              <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-base">
                  <p><span className="font-bold">Storage ID:</span> {record.id}</p>
                  <p><span className="font-bold">Start Date:</span> {formattedStartDate}</p>
                  <p><span className="font-bold">End Date:</span> {formattedEndDate}</p>
                  <p><span className="font-bold">Commodity:</span> {record.commodityDescription}</p>
                  <p><span className="font-bold">Bags Withdrawn:</span> {withdrawnBags}</p>
                  <p><span className="font-bold">Lot No.:</span> {record.location || 'N/A'}</p>
              </div>
          </div>

          <Table className="text-lg">
              <TableHeader>
                  <TableRow>
                      <TableHead className="text-black font-bold">PARTICULARS</TableHead>
                      <TableHead className="text-center text-black font-bold">Bags</TableHead>
                      <TableHead className="text-center text-black font-bold">Rate</TableHead>
                      <TableHead className="text-right text-black font-bold">Amount</TableHead>
                  </TableRow>
              </TableHeader>
              <TableBody>
                  <TableRow>
                      <TableCell>1. Warehouse Rent</TableCell>
                      <TableCell className="text-center">{withdrawnBags}</TableCell>
                      <TableCell className="text-center font-mono">{rentPerBag.toFixed(2)}</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(finalRent)}</TableCell>
                  </TableRow>
                  <TableRow>
                      <TableCell>2. Handling/Hamali Charges</TableCell>
                      <TableCell></TableCell><TableCell></TableCell>
                      <TableCell className="text-right font-mono">{hamaliPending > 0 ? formatCurrency(hamaliPending) : '-'}</TableCell>
                  </TableRow>
                  {record.khataAmount && (
                      <TableRow>
                          <TableCell>3. Khata (Weighbridge)</TableCell>
                          <TableCell></TableCell><TableCell></TableCell>
                          <TableCell className="text-right font-mono">{formatCurrency(record.khataAmount)}</TableCell>
                      </TableRow>
                  )}
              </TableBody>
              <TableFooter>
                  <TableRow className="font-bold border-t-2 border-black">
                      <TableCell colSpan={3} className="text-right">GRAND TOTAL</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(grandTotal)}</TableCell>
                  </TableRow>
                  {paidNow > 0 && (
                      <TableRow>
                          <TableCell colSpan={3} className="text-right font-bold">Amount Paid Now</TableCell>
                          <TableCell className="text-right font-mono text-green-600">-{formatCurrency(paidNow)}</TableCell>
                      </TableRow>
                  )}
                  <TableRow>
                      <TableCell colSpan={3} className="text-right font-bold text-destructive">Balance Due</TableCell>
                      <TableCell className="text-right font-mono text-destructive">{formatCurrency(balanceDue)}</TableCell>
                  </TableRow>
              </TableFooter>
          </Table>
          
            <div className="mt-16 pt-8 flex flex-col items-center text-center space-y-2">
                <div className="flex justify-between w-full mb-8">
                    <div className="w-48 border-t border-gray-400 pt-1 text-xs">Depositor Signature</div>
                    <div className="flex flex-col items-center text-center">
                        <div className="w-64 border-t border-slate-300 pt-4">
                            <p className="text-[#1e293b] font-bold text-sm uppercase tracking-wider">Authorized Manager Signature</p>
                            <p className="text-primary font-bold text-xs uppercase mt-1">{warehouseInfo?.name || 'Sri Lakshmi Warehouse'}</p>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-2">Report validity verified on {generatedDate}</p>
                        <p className="text-[10px] text-slate-400 italic">This is a computer generated statement.</p>
                    </div>
                </div>
            </div>
      </div>
    );
})

OutflowReceipt.displayName = 'OutflowReceipt';
