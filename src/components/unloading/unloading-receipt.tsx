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
        <div ref={ref} className="bg-white p-4 sm:p-8 font-sans text-black w-full mx-auto print:p-0 print:border-none printable-area">
            <style jsx>{`
                .info-table td { border: none !important; padding: 4px 2px !important; vertical-align: top; }
                .bill-table th { border: 1px solid black !important; text-align: center !important; }
                .bill-table td { border: 1px solid black !important; }
            `}</style>

            {/* Header */}
            <div className="text-center mb-8 border-b-2 border-black pb-4">
                <h1 className="text-2xl font-black uppercase tracking-tight leading-none mb-1">{warehouseInfo?.name || 'SRI LAKSHMI WAREHOUSE'}</h1>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                    {warehouseInfo?.addressLine1} {warehouseInfo?.addressLine2}
                </p>
                <p className="text-sm font-black mt-1">Cell: {warehouseInfo?.phone || ''}</p>
                <div className="mt-4 py-2 px-10 border-2 border-black inline-block font-black text-xl tracking-[0.2em] uppercase">
                    Unloading Bill
                </div>
            </div>
            
            {/* Info Grid */}
            <div className="mb-6 grid grid-cols-2 gap-8">
                <table className="w-full info-table text-[13px]">
                    <tbody>
                        <tr><td className="font-bold w-24 uppercase text-[10px] text-slate-500">Bill No</td><td>: <span className="font-mono font-black text-base">{record.billNo}</span></td></tr>
                        <tr><td className="font-bold w-24 uppercase text-[10px] text-slate-500">Depositor</td><td>: <span className="font-black uppercase">{customer.name}</span></td></tr>
                        <tr><td className="font-bold w-24 uppercase text-[10px] text-slate-500">Village</td><td>: <span className="uppercase">{customer.village || 'N/A'}</span></td></tr>
                    </tbody>
                </table>
                <table className="w-full info-table text-[13px]">
                    <tbody>
                        <tr><td className="font-bold w-24 uppercase text-[10px] text-slate-500">Date</td><td>: <span className="font-bold">{formattedDate}</span></td></tr>
                        <tr><td className="font-bold w-24 uppercase text-[10px] text-slate-500">Lot No</td><td>: <span className="font-mono font-black text-base">{record.location || 'N/A'}</span></td></tr>
                        <tr><td className="font-bold w-24 uppercase text-[10px] text-slate-500">Product</td><td>: <span className="font-black uppercase">{record.commodityDescription}</span></td></tr>
                    </tbody>
                </table>
            </div>

            {/* Charges Table */}
            <div className="mb-6">
                <table className="bill-table w-full border-collapse text-[13px]">
                    <thead>
                        <tr className="bg-slate-50 h-12">
                            <th className="font-black uppercase text-[10px] px-4">Description of Service</th>
                            <th className="font-black uppercase text-[10px] px-2 w-24">Bags</th>
                            <th className="font-black uppercase text-[10px] px-2 w-32">Rate</th>
                            <th className="font-black uppercase text-[10px] px-2 w-32">Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr className="h-16">
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
            <div className="mt-24">
                <table className="w-full border-none">
                    <tbody>
                        <tr>
                            <td className="w-1/2 text-center align-bottom border-none">
                                <div className="border-t border-black pt-2 mx-auto w-[180px] font-bold text-[10px] uppercase tracking-widest">Depositor Sign</div>
                            </td>
                            <td className="w-1/2 text-center align-bottom border-none">
                                <div className="border-t-2 border-black pt-2 mx-auto w-[180px] font-black text-[10px] uppercase tracking-widest">Authorized Auditor</div>
                                <p className="text-[9px] font-bold text-slate-500 uppercase mt-1 tracking-widest">SRI LAKSHMI WAREHOUSE</p>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <div className="mt-12 pt-8 text-[9px] text-slate-400 italic text-center border-t border-slate-100">
                <p>Digital Validation: {record.id?.toUpperCase()}</p>
                <p>Generated on {generatedDate}</p>
            </div>
        </div>
    );
});
UnloadingReceipt.displayName = 'UnloadingReceipt';