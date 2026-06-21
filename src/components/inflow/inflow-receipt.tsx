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
        <div ref={ref} className="bg-white p-4 sm:p-8 font-sans text-black w-full mx-auto print:p-0 print:border-none dialog-print-area">
             <style jsx>{`
                table.no-border, table.no-border td { border: none !important; }
                @media screen {
                    .bill-table-container { overflow-x: auto; -webkit-overflow-scrolling: touch; }
                    .bill-table { min-width: 600px; width: 100%; }
                }
            `}</style>

            {/* Header */}
            <div className="text-center mb-6 sm:mb-8 border-b-2 border-black pb-4">
                <h1 className="text-xl sm:text-2xl font-black uppercase tracking-tight leading-none mb-1">{warehouseInfo?.name || 'SRI LAKSHMI WAREHOUSE'}</h1>
                <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-600">
                    {warehouseInfo?.addressLine1} {warehouseInfo?.addressLine2}
                </p>
                <p className="text-xs sm:text-sm font-black mt-1">Cell: {warehouseInfo?.phone || ''}</p>
                <div className="mt-4 py-1.5 px-6 sm:px-8 border-2 border-black inline-block font-black text-lg sm:text-xl tracking-[0.2em] uppercase">
                    Inflow Bill
                </div>
            </div>
    
            {/* Information Grid */}
            <div className="mb-6">
                <table className="w-full text-[12px] sm:text-[13px] border-collapse no-border">
                    <tbody>
                        <tr>
                            <td className="py-1 align-top w-[55%] border-none">
                                <table className="w-full no-border">
                                    <tbody>
                                        <tr><td className="font-bold w-24 uppercase text-[10px] text-slate-500 py-0.5">Bill No</td><td className="py-0.5">: <span className="font-mono font-black text-base">{record.id}</span></td></tr>
                                        <tr><td className="font-bold w-24 uppercase text-[10px] text-slate-500 py-0.5">Depositor</td><td className="py-0.5">: <span className="font-black uppercase">{customer.name}</span></td></tr>
                                        <tr><td className="font-bold w-24 uppercase text-[10px] text-slate-500 py-0.5">Village</td><td className="py-0.5">: <span className="uppercase">{customer.village || 'N/A'}</span></td></tr>
                                    </tbody>
                                </table>
                            </td>
                            <td className="py-1 align-top text-right border-none">
                                <table className="w-full no-border">
                                    <tbody>
                                        <tr><td className="font-bold uppercase text-[10px] text-slate-500 py-0.5">Date</td><td className="py-0.5">: <span className="font-bold">{formattedDate}</span></td></tr>
                                        <tr><td className="font-bold uppercase text-[10px] text-slate-500 py-0.5">Product</td><td className="py-0.5">: <span className="font-black uppercase">{record.commodityDescription}</span></td></tr>
                                        <tr><td className="font-bold uppercase text-[10px] text-slate-500 py-0.5">Lot No</td><td className="py-0.5">: <span className="font-mono font-black text-base">{record.location || 'N/A'}</span></td></tr>
                                    </tbody>
                                </table>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
    
            {/* Charges Table */}
            <div className="border-t-2 border-black pt-4 mb-4">
                <h3 className="font-bold uppercase text-center mb-4 underline underline-offset-4 text-[11px] tracking-widest">Particulars of Handling</h3>
                <div className="bill-table-container">
                    <table className="bill-table border-2 border-black border-collapse text-[12px] sm:text-[13px]">
                        <thead>
                            <tr className="border-b-2 border-black bg-slate-50 h-10">
                                <th className="font-black uppercase text-[10px] px-4 text-left border-r border-black">Description</th>
                                <th className="font-black uppercase text-[10px] px-2 text-center w-24 border-r border-black">Bags</th>
                                <th className="font-black uppercase text-[10px] px-2 text-right w-24 border-r border-black">Rate</th>
                                <th className="font-black uppercase text-[10px] px-2 text-right w-32">Amount</th>
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
                            <tr className="h-12 bg-slate-50 font-black text-xl border-t-2 border-black">
                                <td colSpan={3} className="text-right px-4 uppercase tracking-tighter border-r border-black">Total Payable</td>
                                <td className="text-right px-2 font-mono">{formatCurrency((record.hamaliPayable || 0) + (record.khataAmount || 0))}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
                {dryingDays && (
                    <p className="mt-2 italic text-[11px] text-slate-500">
                        * Note: This stock was processed through plot drying for {dryingDays} days prior to storage.
                    </p>
                )}
            </div>
            
            {/* Signatures */}
            <div className="mt-16 sm:mt-24">
                <table className="w-full no-border">
                    <tbody>
                        <tr>
                            <td className="w-1/2 text-center align-bottom border-none">
                                <div className="border-t border-black pt-2 mx-auto w-[160px] font-bold text-[10px] uppercase tracking-widest">Depositor Sign</div>
                            </td>
                            <td className="w-1/2 text-center align-bottom border-none">
                                <div className="border-t-2 border-black pt-2 mx-auto w-[160px] font-black text-[10px] uppercase tracking-widest">Authorized Manager</div>
                                <p className="text-[9px] text-slate-400 font-bold uppercase mt-1 tracking-widest">{warehouseInfo?.name}</p>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <div className="mt-8 sm:mt-12 pt-6 text-[9px] text-slate-400 italic text-center border-t border-slate-100">
                <p>Generated on {generatedDate} • This is a computer-generated document.</p>
            </div>
        </div>
    );
});
InflowReceipt.displayName = 'InflowReceipt';