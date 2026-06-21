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
                    Unloading Bill
                </div>
            </div>
            
            {/* Info Grid */}
            <div className="mb-6">
                <table className="w-full text-[12px] sm:text-[13px] border-collapse no-border">
                    <tbody>
                        <tr>
                            <td className="py-1 align-top w-[55%] border-none">
                                <table className="w-full no-border">
                                    <tbody>
                                        <tr><td className="font-bold w-24 sm:w-28 uppercase text-[10px] text-slate-500 py-0.5">Bill No</td><td className="py-0.5">: <span className="font-mono font-black text-base">{record.billNo}</span></td></tr>
                                        <tr><td className="font-bold w-24 sm:w-28 uppercase text-[10px] text-slate-500 py-0.5">Depositor</td><td className="py-0.5">: <span className="font-black uppercase">{customer.name}</span></td></tr>
                                        <tr><td className="font-bold w-24 sm:w-28 uppercase text-[10px] text-slate-500 py-0.5">Village</td><td className="py-0.5">: <span className="uppercase">{customer.village || 'N/A'}</span></td></tr>
                                    </tbody>
                                </table>
                            </td>
                            <td className="py-1 align-top text-right border-none">
                                <table className="w-full no-border">
                                    <tbody>
                                        <tr><td className="font-bold uppercase text-[10px] text-slate-500 py-0.5">Date</td><td className="py-0.5">: <span className="font-bold">{formattedDate}</span></td></tr>
                                        <tr><td className="font-bold uppercase text-[10px] text-slate-500 py-0.5">Lot No</td><td className="py-0.5">: <span className="font-mono font-black text-base">{record.location || 'N/A'}</span></td></tr>
                                        <tr><td className="font-bold uppercase text-[10px] text-slate-500 py-0.5">Product</td><td className="py-0.5">: <span className="font-black uppercase">{record.commodityDescription}</span></td></tr>
                                    </tbody>
                                </table>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            {/* Charges Table */}
            <div className="mb-6 bill-table-container">
                <table className="bill-table border-2 border-black border-collapse text-[12px] sm:text-[13px]">
                    <thead>
                        <tr className="bg-slate-50 border-b-2 border-black h-12">
                            <th className="font-black uppercase text-[10px] px-4 text-left border-r border-black">Description of Service</th>
                            <th className="font-black uppercase text-[10px] px-2 text-center w-24 border-r border-black">Bags</th>
                            <th className="font-black uppercase text-[10px] px-2 text-right w-32 border-r border-black">Rate</th>
                            <th className="font-black uppercase text-[10px] px-2 text-right w-32">Amount</th>
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
                        <tr className="h-16 bg-slate-50 font-black text-xl border-t-2 border-black">
                            <td colSpan={3} className="text-right px-4 uppercase tracking-tighter border-r border-black">Total Payable</td>
                            <td className="text-right px-2 font-mono">{formatCurrency(record.totalHamali)}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>
            
            {/* Signatures */}
            <div className="mt-24 sm:mt-32">
                <table className="w-full no-border">
                    <tbody>
                        <tr>
                            <td className="w-1/2 text-center align-bottom border-none">
                                <div className="border-t border-black pt-2 mx-auto w-[160px] font-bold text-[10px] uppercase tracking-widest">Depositor Sign</div>
                            </td>
                            <td className="w-1/2 text-center align-bottom border-none">
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