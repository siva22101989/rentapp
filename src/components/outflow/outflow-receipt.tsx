
'use client';

import React, { useMemo } from 'react';
import type { Customer, StorageRecord, WarehouseInfo } from '@/lib/definitions';
import { format, differenceInMonths } from 'date-fns';
import { calculateFinalRent } from '@/lib/billing';
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
    
    const formattedStartDate = format(toDate(record.storageStartDate), 'dd/MM/yyyy');
    const formattedEndDate = format(deliveryOrderDate, 'dd/MM/yyyy');
    
    const startDate = toDate(record.storageStartDate);
    const totalMonths = differenceInMonths(deliveryOrderDate, startDate);
    const years = Math.floor(totalMonths / 12);
    const months = totalMonths % 12;
    let durationStr = '';
    if (years > 0) durationStr += `${years} Year${years > 1 ? 's' : ''} `;
    if (months > 0 || years === 0) durationStr += `${months} month${months > 1 ? 's' : ''}`;
    if (durationStr === '') durationStr = 'Less than a month';

    const { rentPerBag } = calculateFinalRent({
        ...record,
        storageStartDate: startDate,
    }, deliveryOrderDate, withdrawnBags);

    const originalHamaliPayable = record.hamaliPayable || 0;
    const hamaliPaid = (record.payments || [])
        .filter(p => p.type === 'hamali')
        .reduce((acc, p) => acc + p.amount, 0);
    const hamaliPending = Math.max(0, originalHamaliPayable - hamaliPaid);
    
    const totalAmount = finalRent + hamaliPending + (record.khataAmount || 0);
    const grandTotal = totalAmount - discount;
    const balanceDue = grandTotal - paidNow;

    if (!record) {
        return <div className="max-w-3xl mx-auto">Loading receipt...</div>;
    }

    return (
      <div ref={ref} className="printable-area bg-white p-4 sm:p-6 border-2 border-black font-sans text-sm text-black">
          <div className="text-center mb-4">
              <h1 className="text-2xl font-bold tracking-wider">{warehouseInfo?.name || 'SRI LAKSHMI WAREHOUSE'}</h1>
              <p className="text-xs">{warehouseInfo?.addressLine1 || 'Survey No. 165,237/2, Owk - Koilakuntla Road, OWK - 518 122,'}</p>
              <p className="text-xs">{warehouseInfo?.addressLine2 || 'Owk (M), Kurnool (Dt.), A.P.'} Cell: {warehouseInfo?.phone || '9703503423, 9160606633'}</p>
          </div>
          
          <div className="grid grid-cols-2 gap-x-4 mb-4">
              <div>
                  <p><span className="font-bold">Bill No.:</span> {deliveryOrderNo}</p>
                  <p><span className="font-bold">Depositor Name:</span> {customer.name}</p>
                  <p><span className="font-bold">Address:</span> {customer.village || 'N/A'}</p>
              </div>
              <div className="text-right">
                  <p>{durationStr}</p>
                  <p><span className="font-bold">Date:</span> {formattedEndDate}</p>
              </div>
          </div>

          <div className="border-y-2 border-black py-2 mb-4">
              <h2 className="font-bold text-center mb-2">PARTICULARS OF WITHDRAWAL</h2>
              <div className="grid grid-cols-2 gap-x-8 gap-y-1">
                  <p><span className="font-bold">1. Warehouse Receipt No.:</span> {record.id}</p>
                  <p><span className="font-bold">Date:</span> {formattedStartDate}</p>
                  <p><span className="font-bold">Delivery Order No.:</span> {deliveryOrderNo}</p>
                  <p><span className="font-bold">Date:</span> {formattedEndDate}</p>
                  <p><span className="font-bold">2. Name of the Commodity:</span> {record.commodityDescription}</p>
                  <p><span className="font-bold">Quantity:</span> {record.weight ? `${record.weight} Kgs` : 'N/A'}</p>
                  <p><span className="font-bold">No. of Bags:</span> {withdrawnBags}</p>
                  <p><span className="font-bold">Net Weight:</span> {record.weight ? `${record.weight} Kgs` : 'N/A'}</p>
                  <p><span className="font-bold">3. Godown No.:</span> {record.location || 'N/A'}</p>
                  <p><span className="font-bold">Lot No.:</span> {record.location || 'N/A'}</p>
              </div>
          </div>

          <Table className="text-sm">
              <TableHeader>
                  <TableRow>
                      <TableHead className="text-black font-bold w-[50%]">PARTICULARS</TableHead>
                      <TableHead className="text-center text-black font-bold">No.of Bags</TableHead>
                      <TableHead className="text-center text-black font-bold">Rate</TableHead>
                      <TableHead className="text-right text-black font-bold">Amount</TableHead>
                  </TableRow>
              </TableHeader>
              <TableBody>
                  <TableRow>
                      <TableCell>1. Ware house Rent</TableCell>
                      <TableCell className="text-center">{withdrawnBags}</TableCell>
                      <TableCell className="text-center">{rentPerBag > 0 ? rentPerBag.toFixed(2) : ''}</TableCell>
                      <TableCell className="text-right font-mono">{finalRent > 0 ? formatCurrency(finalRent) : ''}</TableCell>
                  </TableRow>
                  <TableRow>
                      <TableCell>2. Unloading Charges</TableCell>
                      <TableCell></TableCell>
                      <TableCell></TableCell>
                      <TableCell className="text-right font-mono">{hamaliPending > 0 ? formatCurrency(hamaliPending) : ''}</TableCell>
                  </TableRow>
                  {record.khataAmount && record.khataAmount > 0 && (
                      <TableRow>
                          <TableCell>3. Khata (Weighbridge) Charges</TableCell>
                          <TableCell></TableCell>
                          <TableCell></TableCell>
                          <TableCell className="text-right font-mono">{formatCurrency(record.khataAmount)}</TableCell>
                      </TableRow>
                  )}
              </TableBody>
              <TableFooter>
                  <TableRow>
                      <TableCell colSpan={3} className="text-right font-bold">TOTAL</TableCell>
                      <TableCell className="text-right font-mono font-bold">{formatCurrency(totalAmount)}</TableCell>
                  </TableRow>
                  {discount > 0 && (
                      <TableRow>
                          <TableCell colSpan={3} className="text-right font-bold">Discount</TableCell>
                          <TableCell className="text-right font-mono font-bold text-green-600">- {formatCurrency(discount)}</TableCell>
                      </TableRow>
                  )}
                  <TableRow className="font-bold border-t-2 border-black">
                      <TableCell colSpan={3} className="text-right">GRAND TOTAL</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(grandTotal)}</TableCell>
                  </TableRow>
                  {paidNow > 0 && (
                      <TableRow>
                          <TableCell colSpan={3} className="text-right font-bold">Amount Paid Now</TableCell>
                          <TableCell className="text-right font-mono font-bold text-green-600">- {formatCurrency(paidNow)}</TableCell>
                      </TableRow>
                  )}
                  <TableRow>
                      <TableCell colSpan={3} className="text-right font-bold text-destructive">Balance Due</TableCell>
                      <TableCell className="text-right font-mono font-bold text-destructive">{formatCurrency(balanceDue)}</TableCell>
                  </TableRow>
              </TableFooter>
          </Table>
          
            <div className="mt-16 pt-8 flex justify-between text-center">
              <div className="w-1/2">
                  <div className="mt-12 border-t border-gray-400 mx-4 pt-1">Depositor Signature</div>
              </div>
              <div className="w-1/2">
                  <div className="mt-12 border-t border-gray-400 mx-4 pt-1">Warehouse Manager</div>
              </div>
          </div>
      </div>
    );
})

OutflowReceipt.displayName = 'OutflowReceipt';
