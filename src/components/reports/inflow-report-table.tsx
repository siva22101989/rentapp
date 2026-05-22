'use client';

import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { format } from "date-fns";
import type { Customer, StorageRecord } from "@/lib/definitions";
import { toDate } from '@/lib/utils';
import { useMemo } from "react";
import { ActionsMenu } from "@/components/dashboard/actions-menu";

type ReportTableProps = {
    records: StorageRecord[];
    allRecords: StorageRecord[];
    customers: Customer[];
    title: string;
}

export function InflowReportTable({ records, allRecords, customers, title }: ReportTableProps) {
    const generatedDate = useMemo(() => format(new Date(), 'dd/MM/yy, h:mm a'), []);

    const getCustomerName = (customerId: string) => {
        return customers.find(c => c.id === customerId)?.name ?? 'Unknown';
    }

    const totalBagsIn = records.reduce((acc, record) => acc + (record.bagsIn || 0), 0);

    return (
        <div className="bg-white p-4 text-black font-sans text-sm printable-area">
             <div className="mb-4 text-center border-b-2 border-black pb-2">
                <h2 className="text-xl font-bold uppercase">{title}</h2>
                <p className="text-[10px] text-slate-500 uppercase">Generated: {generatedDate}</p>
            </div>
            <div className="table-scroll-container border-y-2 border-black">
                <Table className="text-[13px]">
                    <TableHeader>
                        <TableRow className="border-b border-black">
                            <TableHead className="font-bold text-black p-1 text-center uppercase text-[10px]">Date</TableHead>
                            <TableHead className="font-bold text-black p-1 text-center uppercase text-[10px]">Bill No</TableHead>
                            <TableHead className="font-bold text-black p-1 text-left uppercase text-[10px]">Customer Name</TableHead>
                            <TableHead className="font-bold text-black p-1 text-center uppercase text-[10px]">Lot</TableHead>
                            <TableHead className="font-bold text-black p-1 text-center uppercase text-[10px]">Bags In</TableHead>
                            <TableHead className="font-bold text-black p-1 text-right uppercase text-[10px] print-hide">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {records.map((record) => (
                            <TableRow key={record.id} className="h-7 border-b border-slate-100">
                                <TableCell className="p-1 text-center">{format(toDate(record.storageStartDate), 'dd/MM/yy')}</TableCell>
                                <TableCell className="p-1 text-center font-mono">{record.id.replace(/\D/g, '')}</TableCell>
                                <TableCell className="p-1 font-bold whitespace-nowrap uppercase">{getCustomerName(record.customerId)}</TableCell>
                                <TableCell className="p-1 text-center font-mono">{record.location}</TableCell>
                                <TableCell className="p-1 text-center font-mono font-bold">{record.bagsIn}</TableCell>
                                <TableCell className="p-1 text-right print-hide">
                                    <ActionsMenu record={record} customers={customers} allRecords={allRecords} />
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                    <TableFooter>
                        <TableRow className="font-bold bg-slate-50 border-t-2 border-black">
                            <TableCell colSpan={4} className="p-1 text-right uppercase text-[10px]">Total Received Bags</TableCell>
                            <TableCell className="p-1 text-center font-mono text-[14px]">{totalBagsIn}</TableCell>
                            <TableCell className="print-hide" />
                        </TableRow>
                    </TableFooter>
                </Table>
            </div>
            <div className="mt-16 flex justify-end">
                <div className="w-56 border-t border-black text-center pt-1">
                    <p className="font-bold text-[12px] uppercase">Authorized Signature</p>
                </div>
            </div>
        </div>
    );
}
