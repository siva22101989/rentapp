'use client';

import React, { useState, useEffect, useMemo } from 'react';
import type { Customer, UnloadingRecord, WarehouseInfo } from '@/lib/definitions';
import { format } from 'date-fns';
import { toDate, formatCurrency } from '@/lib/utils';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '../ui/table';

export const UnloadingReceipt = React.forwardRef<HTMLDivElement, { record: UnloadingRecord, customer: Customer, warehouseInfo: WarehouseInfo | null }>(({ record, customer, warehouseInfo }, ref) => {
    const [formattedDate, setFormattedDate] = useState('');
    const generatedDate = useMemo(() => format(new Date(), 'dd MMM yyyy, hh:mm a'), []);

    useEffect(() => {
        if (record && record.unloadingDate) {
            const unloadingDate = toDate(record.unloadingDate);
            setFormattedDate(format(unloadingDate, 'dd/MM/yyyy'));
        }
    }, [record]);

    if (!record || !customer) return <div>Loading...</div>;
    
    return (
        <div ref={ref} className="bg-white p-4 border-2 border-black font-sans text-lg text-black">
            <div className="text-center mb-4">
                <h1 className="text-2xl font-bold tracking-wider">{warehouseInfo?.name || 'Sri Lakshmi Warehouse'}</h1>
                <p className="text-sm">{warehouseInfo?.addressLine1 || 'Owk - Koilakuntla Road, OWK - 518 122,'}</p>
                <p className="text-sm">{warehouseInfo?.addressLine2 || 'Kurnool (Dt.), A.P.'} Cell: {warehouseInfo?.phone || ''}</p>
                <h2 className="font-bold underline text-center text-lg mt-4 uppercase">Unloading Bill</h2>
            </div>
            
            <div className="flex justify-between items-baseline my-2 text-base">
                <div><span className="font-bold">Storage ID (Bill No):</span> {record.billNo}</div>
                <div><span className="font-bold">Date:</span> {formattedDate}</div>
            </div>

            <div className="space-y-1 mb-2 text-base">
                <div className="flex"><span className="w-1/3 font-bold">DEPOSITOR</span><span>: {customer.name}</span></div>
                <div className="flex"><span className="w-1/3 font-bold">VILLAGE</span><span>: {customer.village || 'N/A'}</span></div>
                <div className="flex"><span className="w-1/3 font-bold">LOT NO.</span><span>: {record.location || 'N/A'}</span></div>
                <div className="flex"><span className="w-1/3 font-bold">PRODUCT</span><span>: {record.commodityDescription}</span></div>
            </div>

            <Table className="text-lg">
                <TableHeader>
                    <TableRow>
                        <TableHead className="text-black font-bold">Description</TableHead>
                        <TableHead className="text-center text-black font-bold">Bags</TableHead>
                        <TableHead className="text-center text-black font-bold">Rate</TableHead>
                        <TableHead className="text-right text-black font-bold">Amount</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    <TableRow>
                        <TableCell>Unloading Hamali Charges</TableCell>
                        <TableCell className="text-center">{record.bagsUnloaded}</TableCell>
                        <TableCell className="text-center font-mono">{formatCurrency(record.hamaliPerBag)}</TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(record.totalHamali)}</TableCell>
                    </TableRow>
                </TableBody>
                <TableFooter>
                    <TableRow>
                        <TableCell colSpan={3} className="text-right font-bold">TOTAL PAYABLE</TableCell>
                        <TableCell className="text-right font-bold font-mono">{formatCurrency(record.totalHamali)}</TableCell>
                    </TableRow>
                </TableFooter>
            </Table>
            
            <div className="mt-16 pt-8 flex flex-col items-end text-center space-y-2">
                <div className="w-72 border-t border-slate-400 pt-4">
                    <p className="text-[#1e293b] font-bold text-sm uppercase tracking-wider">AUTHORIZED MANAGER SIGNATURE</p>
                    <p className="text-primary font-bold text-xs uppercase mt-1">SRI LAKSHMI WAREHOUSE</p>
                </div>
                <p className="text-[10px] text-slate-400">Report validity verified on {generatedDate}</p>
                <p className="text-[10px] text-slate-400 italic">This is a computer generated statement.</p>
            </div>
        </div>
    );
});
UnloadingReceipt.displayName = 'UnloadingReceipt';
