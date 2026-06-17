'use client';

import React, { useState, useEffect, useMemo } from 'react';
import type { Customer, UnloadingRecord, WarehouseInfo } from '@/lib/definitions';
import { format } from 'date-fns';
import { toDate, formatCurrency } from '@/lib/utils';

export const UnloadingReceipt = React.forwardRef<HTMLDivElement, { record: UnloadingRecord, customer: Customer, warehouseInfo: WarehouseInfo | null }>(({ record, customer, warehouseInfo }, ref) => {
    const [formattedDate, setFormattedDate] = useState('');
    const generatedDate = useMemo(() => format(new Date(), 'dd/MM/yyyy, hh:mm a'), []);

    useEffect(() => {
        if (record && record.unloadingDate) {
            const unloadingDate = toDate(record.unloadingDate);
            setFormattedDate(format(unloadingDate, 'dd/MM/yyyy'));
        }
    }, [record]);

    if (!record || !customer) return <div>Loading...</div>;
    
    return (
        <div ref={ref} className="bg-white p-6 font-sans text-black w-[190mm] mx-auto print:p-0 print:border-none dialog-print-area" style={{ minHeight: '297mm' }}>
            {/* Header */}
            <div className="text-center mb-8 border-b-2 border-black pb-4">
                <h1 className="text-2xl font-black uppercase tracking-tight leading-none mb-1">{warehouseInfo?.name || 'SRI LAKSHMI WAREHOUSE'}</h1>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                    {warehouseInfo?.addressLine1} {warehouseInfo?.addressLine2}
                </p>
                <p className="text-sm font-black mt-1">Cell: {warehouseInfo?.phone || ''}</p>
                <div className="mt-4 py-1.5 px-8 border-2 border-black inline-block font-black text-xl tracking-[0.2em] uppercase">
                    Unloading Bill
                </div>
            </div>
            
            {/* Info Grid */}
            <table className="w-full mb-6 text-[13px] border-collapse">
                <tbody>
                    <tr>
                        <td className="py-1 align-top w-[60%]">
                            <div className="flex"><span className="font-bold w-28 uppercase text-[10px] text-slate-500">Bill No</span>: <span className="font-mono font-black text-base ml-2">{record.billNo}</span></div>
                            <div className="flex mt-1"><span className="font-bold w-28 uppercase text-[10px] text-slate-500">Depositor</span>: <span className="font-black uppercase ml-2">{customer.name}</span></div>
                            <div className="flex mt-1"><span className="font-bold w-28 uppercase text-[10px] text-slate-500">Village</span>: <span className="uppercase ml-2">{customer.village || 'N/A'}</span></div>
                        </td>
                        <td className="py-1 align-top text-right">
                            <div className="flex justify-end"><span className="font-bold uppercase text-[10px] text-slate-500 w-24">Date</span>: <span className="font-bold ml-2">{formattedDate}</span></div>
                            <div className="flex justify-end mt-1"><span className="font-bold uppercase text-[10px] text-slate-500 w-24">Lot No</span>: <span className="font-mono font-black text-base ml-2">{record.location || 'N/A'}</span></div>
                            <div className="flex justify-end mt-1"><span className="font-bold uppercase text-[10px] text-slate-500 w-24">Product</span>: <span className="font-black uppercase ml-2">{record.commodityDescription}</span></div>
                        </td>
                    </tr>
                </tbody>
            </table>

            {/* Charges Table */}
            <div className="mb-6">
                <table className="w-full border-2 border-black border-collapse text-[13px]">
                    <thead>
                        <tr className="bg-slate-50 border-b-2 border-black h-12">
                            <th className="border-r border-black font-black uppercase text-[10px] px-4 text-left">Description of Service</th>
                            <th className="border-r border-black font-black uppercase text-[10px] px-2 text-center w-24">Bags</th>
                            <th className="border-r border-black font-black uppercase text-[10px] px-2 text-right w-32">Rate (₹)</th>
                            <th className="font-black uppercase text-[10px] px-2 text-right w-32">Amount (₹)</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr className="h-16 border-b border-black">
                            <td className="px-4 font-bold border-r border-black">Unloading Hamali (Labor Charges)</td>
                            <td className="text-center font-mono font-bold border-r border-black">{record.bagsUnloaded}</td>
                            <td className="text-right px-2 font-mono border-r border-black">{record.hamaliPerBag.toFixed(2)}</td>
                            <td className="text-right px-2 font-mono font-black">{formatCurrency(record.totalHamali)}</td>
                        </tr>
                    </tbody>
                    <tfoot>
                        <tr className="h-16 bg-slate-50 font-black text-2xl border-t-2 border-black">
                            <td colSpan={3} className="text-right px-4 uppercase tracking-tighter border-r border-black">Total Payable</td>
                            <td className="text-right px-2 font-mono">{formatCurrency(record.totalHamali)}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>
            
            {/* Signatures */}
            <div className="mt-32">
                <table className="w-full">
                    <tbody>
                        <tr>
                            <td className="w-1/2 text-center align-bottom">
                                <div className="border-t border-black pt-2 mx-auto w-[200px] font-bold text-[10px] uppercase tracking-widest">Depositor Signature</div>
                            </td>
                            <td className="w-1/2 text-center align-bottom">
                                <div className="border-t-2 border-black pt-2 mx-auto w-[200px] font-black text-xs uppercase tracking-widest">Authorized Auditor</div>
                                <p className="text-[9px] font-bold text-slate-500 uppercase mt-1 tracking-widest">SRI LAKSHMI WAREHOUSE</p>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <div className="mt-auto pt-16 text-[9px] text-slate-400 italic text-center border-t border-slate-100">
                <p>Digital Validation: {record.id?.toUpperCase()}</p>
                <p>Generated on {generatedDate} • System version 3.2.0</p>
            </div>
        </div>
    );
});
UnloadingReceipt.displayName = 'UnloadingReceipt';