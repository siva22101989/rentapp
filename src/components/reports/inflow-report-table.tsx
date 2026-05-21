
'use client';

import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { format } from "date-fns";
import type { Customer, StorageRecord } from "@/lib/definitions";
import { toDate } from '@/lib/utils';
import { useMemo } from "react";
import { ActionsMenu } from "../dashboard/actions-menu";

type ReportTableProps = {
    records: StorageRecord[];
    customers: Customer[];
    title: string;
    description: string;
    allRecords: StorageRecord[];
}

export function InflowReportTable({ records, customers, title, description, allRecords }: ReportTableProps) {
    const generatedDate = useMemo(() => format(new Date(), 'dd/MM/yyyy, hh:mm a'), []);

    const getCustomerName = (customerId: string) => {
        return customers.find(c => c.id === customerId)?.name ?? 'Unknown';
    }

    const totalBagsIn = records.reduce((acc, record) => acc + (record.bagsIn || 0), 0);

    return (
        <div className="bg-white p-6 rounded-xl border shadow-sm">
             <div className="mb-8 text-center border-b pb-6">
                <h2 className="text-xl font-black text-slate-900 tracking-tight uppercase leading-none">SRI LAKSHMI WAREHOUSE</h2>
                <p className="text-[14px] font-bold text-slate-500 uppercase tracking-[0.3em] mt-2">{title}</p>
                <p className="text-[11px] font-bold text-primary uppercase mt-1">Generated: {generatedDate}</p>
            </div>
            <Table className="text-[13px] border-collapse">
                <TableHeader>
                    <TableRow className="bg-[#3498db] hover:bg-[#3498db] border-none">
                        <TableHead className="h-auto p-3 text-white font-black border-r border-sky-400/50 text-center uppercase text-[10px]">Date</TableHead>
                        <TableHead className="h-auto p-3 text-white font-black border-r border-sky-400/50 text-center uppercase text-[10px]">Inflow Bill No</TableHead>
                        <TableHead className="h-auto p-3 text-white font-black border-r border-sky-400/50 text-left uppercase text-[10px]">Customer Name</TableHead>
                        <TableHead className="h-auto p-3 text-white font-black border-r border-sky-400/50 text-center uppercase text-[10px]">Commodity</TableHead>
                        <TableHead className="h-auto p-3 text-white font-black border-r border-sky-400/50 text-center uppercase text-[10px]">Lot No</TableHead>
                        <TableHead className="h-auto p-3 text-white font-black border-r border-sky-400/50 text-center uppercase text-[10px]">Bags In</TableHead>
                        <TableHead className="h-auto p-3 text-white font-black text-center uppercase text-[10px] print-hide">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {records.length > 0 ? (
                        records.map((record) => (
                            <TableRow key={record.id} className="hover:bg-slate-50 h-8 border-b border-slate-100">
                                <TableCell className="p-2 text-center font-bold text-slate-500">{format(toDate(record.storageStartDate), 'dd/MM/yyyy')}</TableCell>
                                <TableCell className="p-2 text-center font-mono font-black text-slate-400">{record.id}</TableCell>
                                <TableCell className="p-2 text-left font-black text-slate-800 uppercase tracking-tighter">{getCustomerName(record.customerId)}</TableCell>
                                <TableCell className="p-2 text-center font-bold text-slate-600">{record.commodityDescription}</TableCell>
                                <TableCell className="p-2 text-center font-mono font-black text-slate-500">{record.location}</TableCell>
                                <TableCell className="p-2 text-center font-mono font-black text-primary text-[14px]">{record.bagsIn}</TableCell>
                                <TableCell className="p-2 text-center print-hide">
                                    <ActionsMenu record={record} customers={customers} allRecords={allRecords} />
                                </TableCell>
                            </TableRow>
                        ))
                    ) : (
                        <TableRow>
                            <TableCell colSpan={7} className="py-10 text-center text-slate-300 font-black uppercase tracking-widest text-[11px] italic">
                                No record history found
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
                <TableFooter>
                    <TableRow className="border-t-2 border-primary bg-slate-50 font-black">
                        <TableCell colSpan={5} className="p-4 text-right text-slate-700 uppercase tracking-tighter text-[11px]">Total Stock Received (Bags)</TableCell>
                        <TableCell className="p-4 text-center font-mono text-lg text-primary">{totalBagsIn}</TableCell>
                        <TableCell className="p-4 print-hide"></TableCell>
                    </TableRow>
                </TableFooter>
            </Table>

            <div className="mt-16 pt-8 flex flex-col items-end text-center space-y-1">
                <div className="w-80 border-t border-slate-400 pt-4">
                    <p className="text-[#1e293b] font-black text-[12px] uppercase tracking-wider">Authorized Manager Signature</p>
                    <p className="text-primary font-bold text-[11px] uppercase mt-1">SRI LAKSHMI WAREHOUSE</p>
                </div>
            </div>
        </div>
    );
}
