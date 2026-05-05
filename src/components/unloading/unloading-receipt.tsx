'use client';

import React, { useState, useEffect } from 'react';
import type { Customer, UnloadingRecord, WarehouseInfo } from '@/lib/definitions';
import { format } from 'date-fns';
import { toDate, formatCurrency } from '@/lib/utils';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '../ui/table';

export const UnloadingReceipt = React.forwardRef<HTMLDivElement, { record: UnloadingRecord, customer: Customer, warehouseInfo: WarehouseInfo | null }>(({ record, customer, warehouseInfo }, ref) => {
    const [formattedDate, setFormattedDate] = useState('');

    useEffect(() => {
        if (record && record.unloadingDate) {
            const unloadingDate = toDate(record.unloadingDate);
            setFormattedDate(format(unloadingDate, 'dd/MM/yy, hh:mm a'));
        }
    }, [record]);


    if (!record || !customer) {
        return (
            <div className="w-full max-w-2xl mx-auto bg-background p-4 sm:p-6">
                <p>Loading receipt...</p>
            </div>
        );
    }
    
    return (
        <div ref={ref} className="bg-white p-4 border-2 border-black font-sans text-lg text-black">
            <div className="text-center mb-4">
                <h1 className="text-2xl font-bold tracking-wider">{warehouseInfo?.name || 'GrainDost'}</h1>
                {warehouseInfo?.ownerName && <p className="text-sm">Prop: {warehouseInfo.ownerName}</p>}
                <p className="text-sm">{warehouseInfo?.addressLine1 || 'Survey No. 165,237/2, Owk - Koilakuntla Road, OWK - 518 122,'}</p>
                <p className="text-sm">{warehouseInfo?.addressLine2 || 'Owk (M), Kurnool (Dt.), A.P.'} Cell: {warehouseInfo?.phone || '9703503423, 9160606633'}</p>
                <h2 className="font-bold underline text-center text-lg mt-4">UNLOADING BILL</h2>
            </div>
            
            <div className="flex justify-between items-baseline my-2 text-base">
                <div><span className="font-bold">Bill No.</span> {record.billNo}</div>
                <div><span className="font-bold">Date:</span> {formattedDate}</div>
            </div>

            <div className="space-y-1 mb-2 text-base">
                <div className="flex"><span className="w-1/3 font-bold">CUSTOMER</span><span>: {customer.name}</span></div>
                {customer.fatherName && <div className="flex"><span className="w-1/3 font-bold">FATHER'S NAME</span><span>: {customer.fatherName}</span></div>}
                <div className="flex"><span className="w-1/3 font-bold">VILLAGE</span><span>: {customer.village || 'N/A'}</span></div>
                <div className="flex"><span className="w-1/3 font-bold">LOT No.</span><span>: {record.location || 'N/A'}</span></div>
                <div className="flex"><span className="w-1/3 font-bold">LORRY/TRACTOR No.</span><span>: {record.lorryTractorNo || 'N/A'}</span></div>
                <div className="flex"><span className="w-1/3 font-bold">PRODUCT</span><span>: {record.commodityDescription}</span></div>
            </div>

            <Table className="text-lg">
                <TableHeader>
                    <TableRow>
                        <TableHead className="text-black">Description</TableHead>
                        <TableHead className="text-center text-black">Bags</TableHead>
                        <TableHead className="text-center text-black">Rate</TableHead>
                        <TableHead className="text-right text-black">Amount</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    <TableRow>
                        <TableCell>Hamali Charges</TableCell>
                        <TableCell className="text-center">{record.bagsUnloaded}</TableCell>
                        <TableCell className="text-center font-mono">{formatCurrency(record.hamaliPerBag)}</TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(record.totalHamali)}</TableCell>
                    </TableRow>
                </TableBody>
                <TableFooter>
                    <TableRow>
                        <TableCell colSpan={3} className="text-right font-bold">Total Hamali</TableCell>
                        <TableCell className="text-right font-bold font-mono">{formatCurrency(record.totalHamali)}</TableCell>
                    </TableRow>
                </TableFooter>
            </Table>
            
            <div className="mt-16 pt-8 flex justify-between text-center">
                <div className="w-1/2">
                    <div className="mt-12 border-t border-gray-400 mx-4 pt-1">Customer Signature</div>
                </div>
                <div className="w-1/2">
                    <div className="mt-12 border-t border-gray-400 mx-4 pt-1">Manager Signature</div>
                    <p className="text-xs mt-1">For {warehouseInfo?.name || 'GrainDost'}</p>
                </div>
            </div>
        </div>
    );
});
UnloadingReceipt.displayName = 'UnloadingReceipt';