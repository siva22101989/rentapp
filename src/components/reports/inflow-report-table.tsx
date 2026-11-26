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

    // NEWEST FIRST SORTING (Mandatory)
    const sortedRecords = useMemo(() => {
        return [...records].sort((a, b) => toDate(b.storageStartDate).getTime() - toDate(a.storageStartDate).getTime());
    }, [records]);

    // COMPULSORY TOTALS
    const totals = useMemo(() => {
        return sortedRecords.reduce((acc, r) => {
            acc.bags += (Number(r.bagsIn) || 0);
            acc.weight += (Number(r.weight) || 0);
            acc.hamali += (Number(r.hamaliPayable) || 0);
            acc.khata += (Number(r.khataAmount) || 0);
            return acc;
        }, { bags: 0, weight: 0, hamali: 0, khata: 0 });
    }, [sortedRecords]);

    return (
        <div className="bg-white p-4 text-black font-sans text-sm printable-area border shadow-sm rounded-lg w-full mx-auto" style={{ width: '277mm' }}>
             <div className="mb-6 text-center border-b pb-4">
                <h2 className="text-2xl font-black uppercase tracking-tight leading-none text-center">SRI LAKSHMI WAREHOUSE</h2>
                <h3 className="font-bold uppercase text-slate-500 tracking-widest text-[14px] mt-1 text-center">{title}</h3>
                <p className="text-[10px] text-slate-400 mt-1 uppercase text-center font-bold">Audit Generation: {generatedDate}</p>
            </div>
            
            <div className="table-scroll-container border-y-2 border-slate-900">
                <Table className="text-[13px]">
                    <TableHeader>
                        <TableRow className="border-b border-slate-900 bg-slate-50">
                            <TableHead className="font-black text-black p-2 text-center uppercase text-[10px] border-r">Date</TableHead>
                            <TableHead className="font-black text-black p-2 text-center uppercase text-[10px] border-r">Bill No</TableHead>
                            <TableHead className="font-black text-black p-2 text-center uppercase text-[10px] border-r">Customer Name</TableHead>
                            <TableHead className="font-black text-black p-2 text-center uppercase text-[10px] border-r">Vehicle No</TableHead>
                            <TableHead className="font-black text-black p-2 text-center uppercase text-[10px] border-r">Lot</TableHead>
                            <TableHead className="font-black text-black p-2 text-center uppercase text-[10px] border-r">Bags</TableHead>
                            <TableHead className="font-black text-black p-2 text-center uppercase text-[10px] border-r">Weight</TableHead>
                            <TableHead className="font-black text-black p-2 text-center uppercase text-[10px] border-r">Rate</TableHead>
                            <TableHead className="font-black text-black p-2 text-center uppercase text-[10px] border-r">Hamali</TableHead>
                            <TableHead className="font-black text-black p-2 text-center uppercase text-[10px] border-r">Khata</TableHead>
                            <TableHead className="font-black text-black p-2 text-center uppercase text-[10px] print-hide">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {sortedRecords.map((record) => {
                            const displayBillNo = String(record.id).replace(/\D/g, '');
                            return (
                                <TableRow key={record.id} className="h-9 border-b border-slate-100 hover:bg-slate-50/50 group">
                                    <TableCell className="p-2 text-center whitespace-nowrap border-r">{format(toDate(record.storageStartDate), 'dd/MM/yy')}</TableCell>
                                    <TableCell className="p-2 text-center font-mono font-bold text-slate-400 border-r">{displayBillNo}</TableCell>
                                    <TableCell className="p-2 font-black whitespace-nowrap uppercase tracking-tighter text-center border-r">{getCustomerName(record.customerId)}</TableCell>
                                    <TableCell className="p-2 font-medium text-slate-600 uppercase text-[12px] text-center border-r">{record.lorryTractorNo || '-'}</TableCell>
                                    <TableCell className="p-2 text-center font-mono font-bold border-r">{record.location || '-'}</TableCell>
                                    <TableCell className="p-2 text-right font-mono font-black text-slate-900 text-center border-r">{record.bagsIn}</TableCell>
                                    <TableCell className="p-2 text-right font-mono text-slate-600 text-center border-r">{record.weight ? `${record.weight}kg` : '-'}</TableCell>
                                    <TableCell className="p-2 text-right font-mono text-slate-400 text-center border-r">{record.hamaliRate ? record.hamaliRate.toFixed(2) : '-'}</TableCell>
                                    <TableCell className="p-2 text-right font-mono font-bold text-center border-r">{formatCurrency(record.hamaliPayable || 0)}</TableCell>
                                    <TableCell className="p-2 text-right font-mono text-center border-r">{record.khataAmount ? formatCurrency(record.khataAmount) : '-'}</TableCell>
                                    <TableCell className="p-2 text-right print-hide">
                                        <ActionsMenu record={record} customers={customers} allRecords={allRecords} />
                                    </TableCell>
                                </TableRow>
                            )
                        })}
                        {sortedRecords.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={11} className="text-center py-20 text-muted-foreground italic font-medium">
                                    No inflow records found for the selected period.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                    <TableFooter>
                        <TableRow className="bg-slate-50 text-black font-black border-t-2 border-slate-900 h-14 hover:bg-slate-50">
                            <TableCell colSpan={5} className="p-2 text-right uppercase text-[10px] tracking-widest pr-6 border-r">Grand Inflow Totals</TableCell>
                            <TableCell className="p-2 text-center font-mono text-base border-r">{totals.bags}</TableCell>
                            <TableCell className="p-2 text-center font-mono text-base border-r">{totals.weight > 0 ? `${totals.weight}kg` : '-'}</TableCell>
                            <TableCell className="p-2 border-r" />
                            <TableCell className="p-2 text-center font-mono text-base border-r">{formatCurrency(totals.hamali)}</TableCell>
                            <TableCell className="p-2 text-center font-mono text-base border-r">{formatCurrency(totals.khata)}</TableCell>
                            <TableCell className="print-hide" />
                        </TableRow>
                    </TableFooter>
                </Table>
            </div>
            
            <div className="mt-20 flex justify-end">
                <div className="w-72 border-t-2 border-slate-900 text-center pt-2">
                    <p className="font-black text-[12px] uppercase tracking-widest text-slate-800 text-center">Authorized Manager Signature</p>
                </div>
            </div>
        </div>
    );
}