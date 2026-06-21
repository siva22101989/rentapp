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
        <div ref={ref} className="bg-white p-4 sm:p-8 font-sans text-black w-full mx-auto print:p-0 print:border-none dialog-print-area">
            <style jsx>{`
                .info-table td { border: none !important; padding: 2px 4px !important; vertical-align: top; }
                @media screen {
                    .bill-table-container { overflow-x: auto; -webkit-overflow-scrolling: touch; }
                    .bill-table { min-width: 700px; width: 100%; }
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
                    Unloading Bill
                </div>
            </div>
            
            {/* Info Grid - Replaced with stable structure */}
            <div className="mb-6 grid grid-cols-2 gap-4">
                <table className="w-full info-table text-[12px] sm:text-[13px]">
                    <tbody>
                        <tr><td className="font-bold w-24 uppercase text-[10px] text-slate-500">Bill No</td><td>: <span className="font-mono font-black text-base">{record.billNo}</span></td></tr>
                        <tr><td className="font-bold w-24 uppercase text-[10px] text-slate-500">Depositor</td><td>: <span className="font-black uppercase">{customer.name}</span></td></tr>
                        <tr><td className="font-bold w-24 uppercase text-[10px] text-slate-500">Village</td><td>: <span className="uppercase">{customer.village || 'N/A'}</span></td></tr>
                    </tbody>
                </table>
                <table className="w-full info-table text-[12px] sm:text-[13px]">
                    <tbody>
                        <tr><td className="font-bold w-24 uppercase text-[10px] text-slate-500">Date</td><td>: <span className="font-bold">{formattedDate}</span></td></tr>
                        <tr><td className="font-bold w-24 uppercase text-[10px] text-slate-500">Lot No</td><td>: <span className="font-mono font-black text-base">{record.location || 'N/A'}</span></td></tr>
                        <tr><td className="font-bold w-24 uppercase text-[10px] text-slate-500">Product</td><td>: <span className="font-black uppercase">{record.commodityDescription}</span></td></tr>
                    </tbody>
                </table>
            </div>

            {/* Charges Table */}
            <div className="mb-6 bill-table-container">
                <table className="bill-table border-2 border-black border-collapse text-[12px] sm:text-[13px]">
                    <thead>
                        <tr className="bg-slate-50 border-b-2 border-black h-12">
                            <th className="font-black uppercase text-[10px] px-4 text-center">Description of Service</th>
                            <th className="font-black uppercase text-[10px] px-2 text-center w-24">Bags</th>
                            <th className="font-black uppercase text-[10px] px-2 text-center w-32">Rate</th>
                            <th className="font-black uppercase text-[10px] px-2 text-center w-32">Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr className="h-16 border-b border-black">
                            <td className="px-4 font-bold">Unloading Hamali (Labor Charges)</td>
                            <td className="text-center font-mono font-bold">{record.bagsUnloaded}</td>
                            <td className="text-right px-2 font-mono">{record.hamaliPerBag.toFixed(2)}</td>
                            <td className="text-right px-2 font-mono font-black">{formatCurrency(record.totalHamali)}</td>
                        </tr>
                    </tbody>
                    <tfoot>
                        <tr className="h-16 bg-slate-50 font-black text-xl border-t-2 border-black">
                            <td colSpan={3} className="text-right px-4 uppercase tracking-tighter">Total Payable</td>
                            <td className="text-right px-2 font-mono">{formatCurrency(record.totalHamali)}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>
            
            {/* Signatures */}
            <div className="mt-24 sm:mt-32">
                <table className="w-full" style={{ border: 'none' }}>
                    <tbody>
                        <tr>
                            <td className="w-1/2 text-center align-bottom" style={{ border: 'none' }}>
                                <div className="border-t border-black pt-2 mx-auto w-[160px] font-bold text-[10px] uppercase tracking-widest">Depositor Sign</div>
                            </td>
                            <td className="w-1/2 text-center align-bottom" style={{ border: 'none' }}>
                                <div className="border-t-2 border-black pt-2 mx-auto w-[160px] font-black text-[10px] uppercase tracking-widest">Authorized Auditor</div>
                                <p className="text-[9px] font-bold text-slate-500 uppercase mt-1 tracking-widest">SRI LAKSHMI WAREHOUSE</p>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <div className="mt-8 sm:mt-12 pt-8 text-[9px] text-slate-400 italic text-center border-t border-slate-100">
                <p>Digital Validation: {record.id?.toUpperCase()}</p>
                <p>Generated on {generatedDate}</p>
            </div>
        </div>
    );
});
UnloadingReceipt.displayName = 'UnloadingReceipt';