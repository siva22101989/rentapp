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

    const commonFooter = (
        <div className="mt-16 pt-8 flex flex-col items-center text-center space-y-2">
            <div className="flex justify-between w-full mb-8">
                <div className="w-48 border-t border-gray-400 pt-1 text-xs">Depositor Signature</div>
                <div className="w-64 border-t border-slate-300 pt-4">
                    <p className="text-[#1e293b] font-bold text-sm uppercase tracking-wider">Authorized Manager Signature</p>
                    <p className="text-primary font-bold text-xs uppercase mt-1">{warehouseInfo?.name || 'Sri Lakshmi Warehouse'}</p>
                </div>
            </div>
            <p className="text-[10px] text-slate-400">Report validity verified on {generatedDate}</p>
        </div>
    );

    return (
        <div ref={ref} className="bg-white p-4 sm:p-6 border-2 border-black font-sans text-lg text-black">
            <div className="text-center mb-4">
                <h1 className="text-2xl font-bold tracking-wider">{warehouseInfo?.name || 'Sri Lakshmi Warehouse'}</h1>
                <p className="text-sm">{warehouseInfo?.addressLine1 || 'Survey No. 165,237/2, Owk - Koilakuntla Road, OWK - 518 122,'}</p>
                <p className="text-sm">{warehouseInfo?.addressLine2 || 'Owk (M), Kurnool (Dt.), A.P.'} Cell: {warehouseInfo?.phone || '9703503423, 9160606633'}</p>
                <h2 className="font-bold underline text-center mt-4 text-lg">INFLOW BILL</h2>
            </div>
    
            <div className="grid grid-cols-2 gap-x-4 mb-4 text-base">
                <div>
                    <p><span className="font-bold">Storage ID:</span> {record.id}</p>
                    <p><span className="font-bold">Depositor:</span> {customer.name}</p>
                    <p><span className="font-bold">Village:</span> {customer.village || 'N/A'}</p>
                </div>
                <div className="text-right">
                    <p><span className="font-bold">Date:</span> {formattedDate}</p>
                </div>
            </div>
    
            <div className="border-y-2 border-black py-2 mb-4">
                <h2 className="font-bold text-center mb-2 text-base uppercase">Particulars of Deposit</h2>
                <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-base">
                    <p><span className="font-bold">Storage ID:</span> {record.id}</p>
                    <p><span className="font-bold">Commodity:</span> {record.commodityDescription}</p>
                    <p><span className="font-bold">No. of Bags:</span> {record.bagsIn}</p>
                    <p><span className="font-bold">Lot No.:</span> {record.location || 'N/A'}</p>
                    {dryingDays && <p className="col-span-2 font-bold italic text-sm">Processed from Plot (Drying: {dryingDays} days)</p>}
                </div>
            </div>
            
            <Table className="text-lg">
                 <TableHeader>
                    <TableRow>
                        <TableHead className="text-black font-bold">PARTICULARS</TableHead>
                        <TableHead className="text-center text-black font-bold">Details</TableHead>
                        <TableHead className="text-right text-black font-bold">Amount</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                     <TableRow>
                        <TableCell>Handling/Hamali Charges</TableCell>
                        <TableCell className="text-center font-mono text-base">{record.bagsIn} bags x {formatCurrency(hamaliRate)}</TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(record.hamaliPayable)}</TableCell>
                    </TableRow>
                    {record.khataAmount && record.khataAmount > 0 && (
                        <TableRow>
                            <TableCell>Khata (Weighbridge)</TableCell>
                            <TableCell></TableCell>
                            <TableCell className="text-right font-mono">{formatCurrency(record.khataAmount)}</TableCell>
                        </TableRow>
                    )}
                </TableBody>
                <TableFooter>
                    <TableRow className="font-bold border-t-2 border-black">
                        <TableCell colSpan={2} className="text-right">TOTAL</TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency((record.hamaliPayable || 0) + (record.khataAmount || 0))}</TableCell>
                    </TableRow>
                </TableFooter>
            </Table>
            
            {commonFooter}
        </div>
    );
});
InflowReceipt.displayName = 'InflowReceipt';