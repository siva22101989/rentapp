'use client';

import React, { useState, useEffect, useMemo } from 'react';
import type { Customer, StorageRecord, WarehouseInfo, UnloadingRecord } from '@/lib/definitions';
import { format, differenceInDays } from 'date-fns';
import { toDate, formatCurrency } from '@/lib/utils';

export const InflowReceipt = React.forwardRef<HTMLDivElement, { record: StorageRecord, customer: Customer, warehouseInfo: WarehouseInfo | null, unloadingRecord?: UnloadingRecord }>(({ record, customer, warehouseInfo, unloadingRecord }, ref) => {
    const [formattedDate, setFormattedDate] = useState('');
    const [dryingDays, setDryingDays] = useState<number | null>(null);
    const generatedDate = useMemo(() => format(new Date(), 'dd/MM/yyyy, hh:mm a'), []);
    
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
        <div ref={ref} className="bg-white p-6 font-sans text-black w-[190mm] mx-auto print:p-0 print:border-none dialog-print-area" style={{ minHeight: '297mm' }}>
            {/* Header */}
            <div className="text-center mb-8 border-b-2 border-black pb-4">
                <h1 className="text-2xl font-black uppercase tracking-tight leading-none mb-1">{warehouseInfo?.name || 'SRI LAKSHMI WAREHOUSE'}</h1>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                    {warehouseInfo?.addressLine1} {warehouseInfo?.addressLine2}
                </p>
                <p className="text-sm font-black mt-1">Cell: {warehouseInfo?.phone || ''}</p>
                <div className="mt-4 py-1.5 px-8 border-2 border-black inline-block font-black text-xl tracking-[0.2em] uppercase">
                    Inflow Bill
                </div>
            </div>
    
            {/* Information Grid */}
            <table className="w-full mb-6 text-[13px] border-collapse">
                <tbody>
                    <tr>
                        <td className="py-1 align-top w-[60%]">
                            <div className="flex"><span className="font-bold w-24 uppercase text-[10px] text-slate-500">Bill No</span>: <span className="font-mono font-black text-base ml-2">{record.id}</span></div>
                            <div className="flex mt-1"><span className="font-bold w-24 uppercase text-[10px] text-slate-500">Depositor</span>: <span className="font-black uppercase ml-2">{customer.name}</span></div>
                            <div className="flex mt-1"><span className="font-bold w-24 uppercase text-[10px] text-slate-500">Father</span>: <span className="ml-2">{customer.fatherName || 'N/A'}</span></div>
                            <div className="flex mt-1"><span className="font-bold w-24 uppercase text-[10px] text-slate-500">Village</span>: <span className="uppercase ml-2">{customer.village || 'N/A'}</span></div>
                        </td>
                        <td className="py-1 align-top text-right">
                            <div className="flex justify-end"><span className="font-bold uppercase text-[10px] text-slate-500 w-24">Date</span>: <span className="font-bold ml-2">{formattedDate}</span></div>
                            <div className="flex justify-end mt-1"><span className="font-bold uppercase text-[10px] text-slate-500 w-24">Commodity</span>: <span className="font-black uppercase ml-2">{record.commodityDescription}</span></div>
                            <div className="flex justify-end mt-1"><span className="font-bold uppercase text-[10px] text-slate-500 w-24">Lot No</span>: <span className="font-mono font-black text-base ml-2">{record.location || 'N/A'}</span></div>
                        </td>
                    </tr>
                </tbody>
            </table>
    
            {/* Charges Table */}
            <div className="border-t-2 border-black pt-4 mb-4">
                <h3 className="font-bold uppercase text-center mb-4 underline underline-offset-4 text-xs tracking-widest">Particulars of Handling</h3>
                <table className="w-full border-2 border-black border-collapse text-[13px]">
                    <thead>
                        <tr className="border-b-2 border-black bg-slate-50 h-10">
                            <th className="border-r border-black font-black uppercase text-[10px] px-4 text-left">Description</th>
                            <th className="border-r border-black font-black uppercase text-[10px] px-2 text-center w-24">Bags</th>
                            <th className="border-r border-black font-black uppercase text-[10px] px-2 text-right w-24">Rate (₹)</th>
                            <th className="font-black uppercase text-[10px] px-2 text-right w-32">Amount (₹)</th>
                        </tr>
                    </thead>
                    <tbody>
                         <tr className="h-12 border-b border-black">
                            <td className="px-4 font-bold border-r border-black">Handling / Hamali Charges</td>
                            <td className="text-center font-mono font-bold border-r border-black">{record.bagsIn}</td>
                            <td className="text-right font-mono border-r border-black px-2">{hamaliRate.toFixed(2)}</td>
                            <td className="text-right font-mono font-bold px-2">{formatCurrency(record.hamaliPayable)}</td>
                        </tr>
                        {record.khataAmount && record.khataAmount > 0 && (
                            <tr className="h-10 border-b border-black">
                                <td className="px-4 font-bold border-r border-black" colSpan={3}>Khata (Weighbridge / Entry Fees)</td>
                                <td className="text-right font-mono font-bold px-2">{formatCurrency(record.khataAmount)}</td>
                            </tr>
                        )}
                    </tbody>
                    <tfoot>
                        <tr className="h-12 bg-slate-50 font-black text-2xl border-t-2 border-black">
                            <td colSpan={3} className="text-right px-4 uppercase tracking-tighter border-r border-black">Total Payable</td>
                            <td className="text-right px-2 font-mono">{formatCurrency((record.hamaliPayable || 0) + (record.khataAmount || 0))}</td>
                        </tr>
                    </tfoot>
                </table>
                {dryingDays && (
                    <p className="mt-2 italic text-[11px] text-slate-500">
                        * Note: This stock was processed through plot drying for {dryingDays} days prior to storage.
                    </p>
                )}
            </div>
            
            {/* Signatures */}
            <div className="mt-24">
                <table className="w-full">
                    <tbody>
                        <tr>
                            <td className="w-1/2 text-center align-bottom">
                                <div className="border-t border-black pt-2 mx-auto w-[200px] font-bold text-[10px] uppercase tracking-widest">Depositor Signature</div>
                            </td>
                            <td className="w-1/2 text-center align-bottom">
                                <div className="border-t-2 border-black pt-2 mx-auto w-[200px] font-black text-xs uppercase tracking-widest">Authorized Manager</div>
                                <p className="text-[9px] text-slate-400 font-bold uppercase mt-1 tracking-widest">{warehouseInfo?.name}</p>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <div className="mt-auto pt-16 text-[9px] text-slate-400 italic text-center border-t border-slate-100">
                <p>Generated on {generatedDate} • This is a computer-generated document.</p>
            </div>
        </div>
    );
});
InflowReceipt.displayName = 'InflowReceipt';