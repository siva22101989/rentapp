
'use client';

import React, { useEffect, useState } from 'react';
import type { Customer, StorageRecord, WarehouseInfo } from '@/lib/definitions';
import { format } from 'date-fns';
import { getRecordStatus, type RecordStatusInfo } from '@/lib/billing';
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
    const [statusInfo, setStatusInfo] = useState<RecordStatusInfo | null>(null);
    const [formattedBillDate, setFormattedBillDate] = useState('');
    const [paymentInfo, setPaymentInfo] = useState({ paid: 0, balance: 0 });

    useEffect(() => {
        const safeRecord = {
            ...record,
            storageStartDate: toDate(record.storageStartDate),
            storageEndDate: record.storageEndDate ? toDate(record.storageEndDate) : null,
        }
        setStatusInfo(getRecordStatus(safeRecord));
        setFormattedBillDate(format(new Date(), 'dd MMM yyyy'));
        
        const totalPaid = (record.payments || []).reduce((acc, p) => acc + p.amount, 0);
        const totalBilled = record.hamaliPayable + (record.totalRentBilled || 0);
        setPaymentInfo({
            paid: totalPaid,
            balance: totalBilled - totalPaid,
        });

    }, [record]);

    if (!statusInfo) return null;

    return (
        <div ref={ref} className="printable-area bg-white p-6 border-2 border-blue-800 font-sans text-sm" style={{ fontFamily: "'Courier New', Courier, monospace" }}>
            <div className="text-center mb-4">
                <div className="text-xs">Cell: {warehouseInfo?.phone || '9703503423, 9160606633'}</div>
                <h1 className="text-2xl font-bold text-blue-900">{warehouseInfo?.name || 'SRI LAKSHMI WAREHOUSE'}</h1>
                {warehouseInfo?.ownerName && <p className="text-xs">Prop: {warehouseInfo.ownerName}</p>}
                <p className="text-xs">{warehouseInfo?.addressLine1 || 'Survey No. 165,237/2, Owk - Koilakuntla Road, OWK - 518 122,'}</p>
                <p className="text-xs">{warehouseInfo?.addressLine2 || 'Owk (M), Kurnool (Dt.), A.P.'}</p>
            </div>

            <h2 className="font-bold underline text-center">BILLING STATEMENT</h2>
            
            <div className="flex justify-between items-baseline my-4">
                <div><span className="font-bold">Serial No.</span> {record.id}</div>
                <div><span className="font-bold">Bill Date:</span> {formattedBillDate}</div>
            </div>

            <div className="space-y-2 mb-4">
                <div className="flex"><span className="w-1/3 font-bold">CUSTOMER</span><span>: {customer.name}</span></div>
                {customer.fatherName && <div className="flex"><span className="w-1/3 font-bold">FATHER'S NAME</span><span>: {customer.fatherName}</span></div>}
                <div className="flex"><span className="w-1/3 font-bold">VILLAGE</span><span>: {customer.village || 'N/A'}</span></div>
                <div className="flex"><span className="w-1/3 font-bold">PRODUCT</span><span>: {record.commodityDescription}</span></div>
            </div>

            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-[50px] text-black">No.</TableHead>
                        <TableHead className="text-black">Description</TableHead>
                        <TableHead className="text-right text-black">Quantity</TableHead>
                        <TableHead className="text-right text-black">Amount</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    <TableRow>
                        <TableCell>1</TableCell>
                        <TableCell>{record.commodityDescription}</TableCell>
                        <TableCell className="text-right">{record.bagsIn || 0} bags</TableCell>
                        <TableCell className="text-right">-</TableCell>
                    </TableRow>
                    <TableRow>
                        <TableCell>2</TableCell>
                        <TableCell>Hamali Charges</TableCell>
                        <TableCell className="text-right">-</TableCell>
                        <TableCell className="text-right">{formatCurrency(record.hamaliPayable)}</TableCell>
                    </TableRow>
                     {record.totalRentBilled > 0 && (
                        <TableRow>
                            <TableCell>3</TableCell>
                            <TableCell>Rent Charges</TableCell>
                            <TableCell className="text-right">-</TableCell>
                            <TableCell className="text-right">{formatCurrency(record.totalRentBilled)}</TableCell>
                        </TableRow>
                    )}
                </TableBody>
                <TableFooter>
                    <TableRow>
                        <TableCell colSpan={3} className="text-right font-bold">Total Billed</TableCell>
                        <TableCell className="text-right font-bold">{formatCurrency(record.hamaliPayable + (record.totalRentBilled || 0))}</TableCell>
                    </TableRow>
                </TableFooter>
            </Table>
            
            <div className="flex justify-end mt-4">
                <div className="w-full max-w-xs space-y-1">
                    <div className="flex justify-between">
                        <span>Amount Paid</span>
                        <span className="font-mono">{formatCurrency(paymentInfo.paid)}</span>
                    </div>
                    <Separator className="bg-gray-400" />
                    <div className="flex justify-between font-bold text-base">
                        <span>Balance Due</span>
                        <span className={`font-mono ${paymentInfo.balance > 0 ? 'text-destructive' : ''}`}>{formatCurrency(paymentInfo.balance)}</span>
                    </div>
                </div>
            </div>

            <div className="mt-20 pt-10 flex justify-between text-center">
                <div className="w-1/2">
                    <div className="mt-16 border-t border-gray-400 mx-4 pt-2">Manager Signature</div>
                </div>
                <div className="w-1/2">
                     <div className="mt-16 border-t border-gray-400 mx-4 pt-2">Customer Signature</div>
                </div>
            </div>

            <div className="text-xs text-muted-foreground space-y-2 pt-6 mt-4">
                {warehouseInfo?.bankDetails && (
                    <p className="mb-4">
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
