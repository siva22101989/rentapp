
'use client';

import React from 'react';
import type { Customer, StorageRecord, WarehouseInfo } from '@/lib/definitions';
import { format } from 'date-fns';
import { formatCurrency, toDate } from '@/lib/utils';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '../ui/table';
import { Separator } from '../ui/separator';

type BillReceiptProps = {
  record: StorageRecord;
  customer: Customer;
  warehouseInfo: WarehouseInfo | null;
};

export const BillReceipt = React.forwardRef<HTMLDivElement, BillReceiptProps>(
  ({ record, customer, warehouseInfo }, ref) => {
    const formattedBillDate = format(new Date(), 'dd/MM/yy');
    
    const totalBilled = (record.hamaliPayable || 0) + (record.totalRentBilled || 0);
    const totalPaid = (record.payments || []).reduce((acc, p) => acc + p.amount, 0);
    const balanceDue = totalBilled - totalPaid;

    return (
        <div ref={ref} className="printable-area bg-white p-4 border-2 border-blue-800 font-sans text-sm" style={{ fontFamily: "'Courier New', Courier, monospace" }}>
            <div className="text-center mb-2">
                <div className="text-xs">Cell: {warehouseInfo?.phone || ''}</div>
                <h1 className="text-xl font-bold text-blue-900">{warehouseInfo?.name || 'GrainDost'}</h1>
                {warehouseInfo?.ownerName && <p className="text-xs">Prop: {warehouseInfo.ownerName}</p>}
                <p className="text-xs">{warehouseInfo?.addressLine1 || ''}</p>
                <p className="text-xs">{warehouseInfo?.addressLine2 || ''}</p>
            </div>

            <h2 className="font-bold underline text-center">ACCOUNT STATEMENT</h2>
            
            <div className="flex justify-between items-baseline my-2">
                <div><span className="font-bold">Serial No.</span> {record.id}</div>
                <div><span className="font-bold">Date:</span> {formattedBillDate}</div>
            </div>

            <div className="space-y-1 mb-2">
                <div className="flex"><span className="w-1/3 font-bold">CUSTOMER</span><span>: {customer.name}</span></div>
                {customer.fatherName && <div className="flex"><span className="w-1/3 font-bold">FATHER'S NAME</span><span>: {customer.fatherName}</span></div>}
                <div className="flex"><span className="w-1/3 font-bold">VILLAGE</span><span>: {customer.village || 'N/A'}</span></div>
                <div className="flex"><span className="w-1/3 font-bold">PRODUCT</span><span>: {record.commodityDescription}</span></div>
                <div className="flex"><span className="w-1/3 font-bold">LOT No.</span><span>: {record.location}</span></div>
            </div>
            
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="text-black">Description</TableHead>
                        <TableHead className="text-center text-black">Calculation</TableHead>
                        <TableHead className="text-right text-black">Amount</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                     {(record.hamaliDetails && record.hamaliDetails.length > 0) ? (
                        record.hamaliDetails.map((item, index) => (
                            <TableRow key={`hamali-${index}`}>
                                <TableCell>{item.description}</TableCell>
                                <TableCell className="text-center font-mono text-xs">{item.bags && item.rate ? `${item.bags} bags x ${formatCurrency(item.rate)}` : '-'}</TableCell>
                                <TableCell className="text-right font-mono">{formatCurrency(item.amount)}</TableCell>
                            </TableRow>
                        ))
                    ) : (
                         record.hamaliPayable > 0 && (
                            <TableRow>
                                <TableCell colSpan={2}>Total Hamali Payable</TableCell>
                                <TableCell className="text-right font-mono">{formatCurrency(record.hamaliPayable)}</TableCell>
                            </TableRow>
                         )
                    )}

                    {record.totalRentBilled > 0 && (
                        <TableRow>
                            <TableCell colSpan={2}>Total Rent Billed</TableCell>
                            <TableCell className="text-right font-mono">{formatCurrency(record.totalRentBilled)}</TableCell>
                        </TableRow>
                    )}
                </TableBody>
                <TableFooter>
                    <TableRow>
                        <TableCell colSpan={2} className="text-right font-bold">Total Billed</TableCell>
                        <TableCell className="text-right font-bold font-mono">{formatCurrency(totalBilled)}</TableCell>
                    </TableRow>
                </TableFooter>
            </Table>

            <div className="flex justify-end mt-2">
                <div className="w-full max-w-xs space-y-1">
                    <div className="flex justify-between">
                        <span>Amount Paid</span>
                        <span className="font-mono">{formatCurrency(totalPaid)}</span>
                    </div>
                    <Separator className="bg-gray-400" />
                    <div className="flex justify-between font-bold text-sm">
                        <span>Balance Due</span>
                        <span className={`font-mono ${balanceDue > 0 ? 'text-destructive' : ''}`}>{formatCurrency(balanceDue)}</span>
                    </div>
                </div>
            </div>

            <div className="mt-16 pt-8 flex justify-between text-center">
                <div className="w-1/2">
                    <div className="mt-12 border-t border-gray-400 mx-4 pt-1">Manager Signature</div>
                </div>
                <div className="w-1/2">
                     <div className="mt-12 border-t border-gray-400 mx-4 pt-1">Customer Signature</div>
                </div>
            </div>

             <div className="text-xs text-muted-foreground space-y-1 pt-4 mt-2">
                {warehouseInfo?.bankDetails && (
                    <p className="mb-2">
                        <strong>Bank Details for Payment:</strong><br />
                        <span className="whitespace-pre-wrap">{warehouseInfo.bankDetails}</span>
                    </p>
                )}
               <p>
                    <strong>Note:</strong>
                    This statement reflects the current status of the active storage record. For withdrawals, final rent will be calculated based on the withdrawal date.
                </p>
                <p>This is a computer-generated document and does not require a signature.</p>
            </div>
        </div>
    );
  }
);

BillReceipt.displayName = 'BillReceipt';
