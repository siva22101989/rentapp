'use client';

import React, { useMemo } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { format } from "date-fns";
import type { Customer, StorageRecord } from "@/lib/definitions";
import { toDate, formatCurrency } from '@/lib/utils';
import { ActionsMenu } from "@/components/dashboard/actions-menu";

type ReportTableProps = {
    records: StorageRecord[];
    allRecords: StorageRecord[];
    customers: Customer[];
    title: string;
}

export function InflowReportTable({ records, allRecords, customers, title }: ReportTableProps) {
    const generatedDate = useMemo(() => format(new Date(), 'dd MMM yyyy, hh:mm a'), []);

    const getCustomerName = (customerId: string) => {
        return customers.find(c => c.id === customerId)?.name ?? 'Unknown';
    }

    const totals = useMemo(() => {
        return records.reduce((acc, r) => {
            acc.bags += (r.bagsIn || 0);
            acc.weight += (r.weight || 0);
            acc.hamali += (r.hamaliPayable || 0);
            acc.khata += (r.khataAmount || 0);
            return acc;
        }, { bags: 0, weight: 0, hamali: 0, khata: 0 });
    }, [records]);

    return (
        <div className="bg-white p-4 text-black font-sans text-sm printable-area border shadow-sm rounded-lg">
             <div className="mb-6 text-center border-b pb-4">
                <h2 className="text-2xl font-black uppercase tracking-tight leading-none">SRI LAKSHMI WAREHOUSE</h2>
                <h3 className="font-bold uppercase text-slate-500 tracking-widest text-[14px] mt-1">{title}</h3>
                <p className="text-[10px] text-slate-400 mt-1 uppercase">Audit Generation: {generatedDate}</p>
            </div>
            
            <div className="table-scroll-container border-y-2 border-slate-900">
                <Table className="text-[13px]">
                    <TableHeader>
                        <TableRow className="border-b border-slate-900 bg-slate-50">
                            <TableHead className="font-bold text-black p-2 text-center uppercase text-[10px]">Date</TableHead>
                            <TableHead className="font-bold text-black p-2 text-center uppercase text-[10px]">Bill No</TableHead>
                            <TableHead className="font-bold text-black p-2 text-left uppercase text-[10px]">Customer Name</TableHead>
                            <TableHead className="font-bold text-black p-2 text-left uppercase text-[10px]">Vehicle No</TableHead>
                            <TableHead className="font-bold text-black p-2 text-center uppercase text-[10px]">Lot</TableHead>
                            <TableHead className="font-bold text-black p-2 text-right uppercase text-[10px]">Bags</TableHead>
                            <TableHead className="font-bold text-black p-2 text-right uppercase text-[10px]">Weight</TableHead>
                            <TableHead className="font-bold text-black p-2 text-right uppercase text-[10px]">Rate</TableHead>
                            <TableHead className="font-bold text-black p-2 text-right uppercase text-[10px]">Hamali</TableHead>
                            <TableHead className="font-bold text-black p-2 text-right uppercase text-[10px]">Khata</TableHead>
                            <TableHead className="font-bold text-black p-2 text-right uppercase text-[10px] print-hide">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {records.map((record) => {
                            const displayBillNo = String(record.id).replace(/\D/g, '');
                            return (
                                <TableRow key={record.id} className="h-9 border-b border-slate-100 hover:bg-slate-50/50 group">
                                    <TableCell className="p-2 text-center whitespace-nowrap">{format(toDate(record.storageStartDate), 'dd/MM/yy')}</TableCell>
                                    <TableCell className="p-2 text-center font-mono font-bold text-slate-400">{displayBillNo}</TableCell>
                                    <TableCell className="p-2 font-black whitespace-nowrap uppercase tracking-tighter">{getCustomerName(record.customerId)}</TableCell>
                                    <TableCell className="p-2 font-medium text-slate-600 uppercase text-[12px]">{record.lorryTractorNo || '-'}</TableCell>
                                    <TableCell className="p-2 text-center font-mono font-bold">{record.location || '-'}</TableCell>
                                    <TableCell className="p-2 text-right font-mono font-black text-slate-900">{record.bagsIn}</TableCell>
                                    <TableCell className="p-2 text-right font-mono text-slate-600">{record.weight ? `${record.weight}kg` : '-'}</TableCell>
                                    <TableCell className="p-2 text-right font-mono text-slate-400">{record.hamaliRate ? record.hamaliRate.toFixed(2) : '-'}</TableCell>
                                    <TableCell className="p-2 text-right font-mono font-bold">{formatCurrency(record.hamaliPayable || 0)}</TableCell>
                                    <TableCell className="p-2 text-right font-mono">{record.khataAmount ? formatCurrency(record.khataAmount) : '-'}</TableCell>
                                    <TableCell className="p-2 text-right print-hide">
                                        <ActionsMenu record={record} customers={customers} allRecords={allRecords} />
                                    </TableCell>
                                </TableRow>
                            )
                        })}
                        {records.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={11} className="text-center py-20 text-muted-foreground italic">
                                    No inflow records found for the selected period.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                    <TableFooter>
                        <TableRow className="bg-slate-900 text-white font-black border-t-2 border-slate-900 h-12 hover:bg-slate-900">
                            <TableCell colSpan={5} className="p-2 text-right uppercase text-[10px] tracking-widest">Grand Inflow Totals</TableCell>
                            <TableCell className="p-2 text-right font-mono text-[14px]">{totals.bags}</TableCell>
                            <TableCell className="p-2 text-right font-mono text-[14px]">{totals.weight > 0 ? `${totals.weight}kg` : '-'}</TableCell>
                            <TableCell className="p-2" />
                            <TableCell className="p-2 text-right font-mono text-[14px]">{formatCurrency(totals.hamali)}</TableCell>
                            <TableCell className="p-2 text-right font-mono text-[14px]">{formatCurrency(totals.khata)}</TableCell>
                            <TableCell className="print-hide" />
                        </TableRow>
                    </TableFooter>
                </Table>
            </div>
            
            <div className="mt-20 flex justify-end">
                <div className="w-72 border-t-2 border-slate-900 text-center pt-2">
                    <p className="font-black text-[12px] uppercase tracking-widest text-slate-800">Authorized Manager Signature</p>
                    <p className="text-[10px] text-slate-400 mt-1 uppercase">Warehouse Operations Department</p>
                </div>
            </div>
        </div>
    );
}
