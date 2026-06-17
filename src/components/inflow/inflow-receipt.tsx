'use client';

import React, { useState, useEffect, useMemo } from 'react';
import type { Customer, StorageRecord, WarehouseInfo, UnloadingRecord } from '@/lib/definitions';
import { format, differenceInDays } from 'date-fns';
import { toDate, formatCurrency } from '@/lib/utils';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '../ui/table';

export const InflowReceipt = React.forwardRef<HTMLDivElement, { record: StorageRecord, customer: Customer, warehouseInfo: WarehouseInfo | null, unloadingRecord?: UnloadingRecord }>(({ record, customer, warehouseInfo, unloadingRecord }, ref) => {
    const [formattedDate, setFormattedDate] = useState('');
    const [dryingDays, setDryingDays] = useState<number | null>(null);
    const generatedDate = useMemo(() => format(new Date(), 'dd MMM yyyy, hh:mm a'), []);
    
    useEffect(() => {
        if (record && record.storageStartDate) {
            const startDate = toDate(record.storageStartDate);
            setFormattedDate(format(startDate, 'dd/MM/yyyy'));
        }
        if (record?.inflowType === 'Plot' && record.dryingStartDate && record.dryingEndDate) {
            const start = toDate(record.dryingStartDate);
            const end = toDate(record.dryingEndDate);
            if (end >= start) {
                setDryingDays(differenceInDays(end, start) + 1);
            }
        }
    }, [record]);

    if (!record || !customer) return <div>Loading...</div>;
    
    const hamaliRate = record.hamaliRate ?? (record.bagsIn > 0 ? record.hamaliPayable / record.bagsIn : 0);

    return (
        <div ref={ref} className="bg-white p-8 border-2 border-black font-sans text-black max-w-[800px] mx-auto print:p-0 print:border-none">
            <div className="text-center mb-8 border-b-2 border-black pb-4">
                <h1 className="text-3xl font-bold uppercase tracking-wider">{warehouseInfo?.name || 'SRI LAKSHMI WAREHOUSE'}</h1>
                <p className="text-sm font-semibold mt-1">
                    {warehouseInfo?.addressLine1} {warehouseInfo?.addressLine2}
                </p>
                <p className="text-sm font-bold">Cell: {warehouseInfo?.phone || ''}</p>
                <div className="mt-4 py-1 px-4 border-2 border-black inline-block font-black text-xl">
                    INFLOW BILL
                </div>
            </div>
    
            <div className="grid grid-cols-2 gap-x-12 mb-6 text-sm">
                <div className="space-y-1">
                    <p><span className="font-bold w-32 inline-block">BILL NO</span>: <span className="font-mono font-bold text-lg">{record.id}</span></p>
                    <p><span className="font-bold w-32 inline-block">DEPOSITOR</span>: <span className="uppercase">{customer.name}</span></p>
                    <p><span className="font-bold w-32 inline-block">FATHER'S NAME</span>: {customer.fatherName || 'N/A'}</p>
                    <p><span className="font-bold w-32 inline-block">VILLAGE</span>: <span className="uppercase">{customer.village || 'N/A'}</span></p>
                </div>
                <div className="text-right space-y-1">
                    <p><span className="font-bold">DATE</span>: {formattedDate}</p>
                    <p><span className="font-bold">COMMODITY</span>: <span className="uppercase">{record.commodityDescription}</span></p>
                    <p><span className="font-bold">LOT NO</span>: <span className="font-mono font-bold">{record.location || 'N/A'}</span></p>
                </div>
            </div>
    
            <div className="border-t-2 border-black pt-4 mb-4">
                <h3 className="font-bold uppercase text-center mb-4 underline decoration-slate-300 underline-offset-4">Particulars of Handling</h3>
                <Table className="border-2 border-black">
                    <TableHeader>
                        <TableRow className="border-b-2 border-black bg-slate-50">
                            <TableHead className="text-black font-bold h-10 px-4 uppercase text-xs">Description</TableHead>
                            <TableHead className="text-center text-black font-bold h-10 px-4 uppercase text-xs">Quantity (Bags)</TableHead>
                            <TableHead className="text-right text-black font-bold h-10 px-4 uppercase text-xs">Rate (₹)</TableHead>
                            <TableHead className="text-right text-black font-bold h-10 px-4 uppercase text-xs">Amount (₹)</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                         <TableRow className="h-12 border-b border-black">
                            <TableCell className="px-4 font-medium">Handling / Hamali Charges</TableCell>
                            <TableCell className="text-center font-mono font-bold">{record.bagsIn}</TableCell>
                            <TableCell className="text-right font-mono">{hamaliRate.toFixed(2)}</TableCell>
                            <TableCell className="text-right font-mono font-bold">{formatCurrency(record.hamaliPayable)}</TableCell>
                        </TableRow>
                        {record.khataAmount && record.khataAmount > 0 && (
                            <TableRow className="h-10 border-b border-black">
                                <TableCell className="px-4 font-medium" colSpan={3}>Khata (Weighbridge / Entry Fees)</TableCell>
                                <TableCell className="text-right font-mono font-bold">{formatCurrency(record.khataAmount)}</TableCell>
                            </TableRow>
                        )}
                        {dryingDays && (
                            <TableRow className="h-8">
                                <TableCell colSpan={4} className="px-4 italic text-[11px] text-slate-500">
                                    Note: Items processed through plot drying for {dryingDays} days.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                    <TableFooter>
                        <TableRow className="h-12 bg-slate-50 font-black text-lg">
                            <TableCell colSpan={3} className="text-right px-4 uppercase tracking-tighter">Grand Total</TableCell>
                            <TableCell className="text-right px-4 font-mono">{formatCurrency((record.hamaliPayable || 0) + (record.khataAmount || 0))}</TableCell>
                        </TableRow>
                    </TableFooter>
                </Table>
            </div>
            
            <div className="mt-20 grid grid-cols-2 gap-12 text-center">
                <div className="space-y-1">
                    <div className="border-t border-black pt-2 mx-auto w-48 font-bold text-xs uppercase">Customer Signature</div>
                </div>
                <div className="space-y-1">
                    <div className="border-t-2 border-black pt-2 mx-auto w-64 font-black text-sm uppercase">Authorized Manager</div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{warehouseInfo?.name || 'Warehouse Operations'}</p>
                </div>
            </div>

            <div className="mt-12 text-[10px] text-slate-400 italic text-center border-t border-slate-100 pt-4">
                <p>Digital Audit Timestamp: {generatedDate}</p>
                <p>This is a computer-generated billing document. Valid without physical signature.</p>
            </div>
        </div>
    );
});
InflowReceipt.displayName = 'InflowReceipt';