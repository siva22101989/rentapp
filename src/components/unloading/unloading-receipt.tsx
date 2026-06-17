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
        <div ref={ref} className="bg-white p-10 border-2 border-black font-sans text-black max-w-[800px] w-full mx-auto print:p-0 print:border-none dialog-print-area">
            <div className="text-center mb-10 border-b-2 border-black pb-6">
                <h1 className="text-2xl font-black uppercase tracking-tight leading-none">{warehouseInfo?.name || 'SRI LAKSHMI WAREHOUSE'}</h1>
                <p className="text-[10px] font-bold mt-2 uppercase tracking-widest text-slate-600">
                    {warehouseInfo?.addressLine1} {warehouseInfo?.addressLine2}
                </p>
                <p className="text-sm font-black mt-1">Cell: {warehouseInfo?.phone || ''}</p>
                <div className="mt-6 py-2 px-8 border-2 border-black inline-block font-black text-2xl tracking-[0.2em] uppercase">
                    Unloading Bill
                </div>
            </div>
            
            <div className="grid grid-cols-2 gap-12 mb-8 text-sm">
                <div className="space-y-2">
                    <div className="flex"><span className="font-bold w-32 uppercase text-[10px] text-slate-500">Bill No</span>: <span className="font-mono font-black text-lg">{record.billNo}</span></div>
                    <div className="flex"><span className="font-bold w-32 uppercase text-[10px] text-slate-500">Depositor</span>: <span className="font-black uppercase">{customer.name}</span></div>
                    <div className="flex"><span className="font-bold w-32 uppercase text-[10px] text-slate-500">Village</span>: <span className="uppercase">{customer.village || 'N/A'}</span></div>
                </div>
                <div className="text-right space-y-2">
                    <div className="flex justify-end"><span className="font-bold uppercase text-[10px] text-slate-500 w-32">Date</span>: <span className="font-bold">{formattedDate}</span></div>
                    <div className="flex justify-end"><span className="font-bold uppercase text-[10px] text-slate-500 w-32">Lot No</span>: <span className="font-mono font-bold text-lg">{record.location || 'N/A'}</span></div>
                    <div className="flex justify-end"><span className="font-bold uppercase text-[10px] text-slate-500 w-32">Product</span>: <span className="font-bold uppercase">{record.commodityDescription}</span></div>
                </div>
            </div>

            <Table className="border-2 border-black w-full">
                <TableHeader>
                    <TableRow className="border-b-2 border-black bg-slate-50 h-12">
                        <TableHead className="text-black font-black uppercase text-[10px] px-4 border-r border-black">Description of Service</TableHead>
                        <TableHead className="text-center text-black font-black uppercase text-[10px] px-4 w-24 border-r border-black">Bags</TableHead>
                        <TableHead className="text-center text-black font-black uppercase text-[10px] px-4 w-32 border-r border-black">Rate (₹)</TableHead>
                        <TableHead className="text-right text-black font-black uppercase text-[10px] px-4 w-32">Amount (₹)</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    <TableRow className="h-16 border-b border-black">
                        <TableCell className="px-4 font-bold border-r border-black">Unloading Hamali (Labor Charges)</TableCell>
                        <TableCell className="text-center font-mono font-bold border-r border-black">{record.bagsUnloaded}</TableCell>
                        <TableCell className="text-center font-mono border-r border-black">{record.hamaliPerBag.toFixed(2)}</TableCell>
                        <TableCell className="text-right font-mono font-black">{formatCurrency(record.totalHamali)}</TableCell>
                    </TableRow>
                </TableBody>
                <TableFooter>
                    <TableRow className="h-16 bg-slate-50 font-black text-2xl">
                        <TableCell colSpan={3} className="text-right px-4 uppercase tracking-tighter border-r border-black">Total Payable</TableCell>
                        <TableCell className="text-right px-4 font-mono">{formatCurrency(record.totalHamali)}</TableCell>
                    </TableRow>
                </TableFooter>
            </Table>
            
            <div className="mt-32 grid grid-cols-2 gap-20 text-center">
                <div className="space-y-2">
                    <div className="h-px bg-black w-full" />
                    <p className="font-bold text-[10px] uppercase tracking-widest">Depositor Signature</p>
                </div>
                <div className="space-y-2">
                    <div className="h-px bg-black w-full" />
                    <p className="font-black text-[12px] uppercase tracking-widest">Authorized Auditor</p>
                    <p className="text-[9px] font-bold text-slate-500 uppercase mt-1">SRI LAKSHMI WAREHOUSE</p>
                </div>
            </div>

            <div className="mt-16 text-[9px] text-slate-400 italic text-center border-t border-slate-100 pt-6">
                <p>Digital Validation ID: {record.id?.toUpperCase()}</p>
                <p>Generated on {generatedDate} • System version 3.1.0</p>
            </div>
        </div>
    );
});
UnloadingReceipt.displayName = 'UnloadingReceipt';