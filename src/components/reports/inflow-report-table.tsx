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
        <div className="bg-white p-4 sm:p-6 rounded border shadow-sm">
             <div className="mb-6 text-center border-b pb-4">
                <h2 className="text-xl font-bold text-slate-900 uppercase">{title}</h2>
                <p className="text-[10px] text-slate-500 uppercase mt-1">Generated: {generatedDate}</p>
            </div>
            <Table className="text-[13px] border-collapse border border-slate-200">
                <TableHeader>
                    <TableRow className="bg-slate-50">
                        <TableHead className="text-black font-bold border-r p-2 text-center uppercase text-[10px]">Date</TableHead>
                        <TableHead className="text-black font-bold border-r p-2 text-center uppercase text-[10px]">Bill No</TableHead>
                        <TableHead className="text-black font-bold border-r p-2 text-left uppercase text-[10px]">Customer</TableHead>
                        <TableHead className="text-black font-bold border-r p-2 text-center uppercase text-[10px]">Product</TableHead>
                        <TableHead className="text-black font-bold border-r p-2 text-center uppercase text-[10px]">Lot</TableHead>
                        <TableHead className="text-black font-bold border-r p-2 text-center uppercase text-[10px]">Bags In</TableHead>
                        <TableHead className="text-black font-bold p-2 text-center uppercase text-[10px] print-hide">Action</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {records.length > 0 ? (
                        records.map((record) => (
                            <TableRow key={record.id} className="h-7 border-b border-slate-100">
                                <TableCell className="p-1 text-center">{format(toDate(record.storageStartDate), 'dd/MM/yy')}</TableCell>
                                <TableCell className="p-1 text-center font-mono text-slate-400">{record.id}</TableCell>
                                <TableCell className="p-1 font-bold whitespace-nowrap">{getCustomerName(record.customerId)}</TableCell>
                                <TableCell className="p-1 text-center">{record.commodityDescription}</TableCell>
                                <TableCell className="p-1 text-center font-mono">{record.location}</TableCell>
                                <TableCell className="p-1 text-center font-mono font-bold text-primary">{record.bagsIn}</TableCell>
                                <TableCell className="p-1 text-center print-hide">
                                    <ActionsMenu record={record} customers={customers} allRecords={allRecords} />
                                </TableCell>
                            </TableRow>
                        ))
                    ) : (
                        <TableRow>
                            <TableCell colSpan={7} className="py-10 text-center text-muted-foreground italic">
                                No record found.
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
                <TableFooter>
                    <TableRow className="border-t border-slate-900 bg-slate-50 font-bold">
                        <TableCell colSpan={5} className="p-2 text-right uppercase text-[10px]">Total Inflow Bags</TableCell>
                        <TableCell className="p-2 text-center font-mono text-[14px]">{totalBagsIn}</TableCell>
                        <TableCell className="p-2 print-hide"></TableCell>
                    </TableRow>
                </TableFooter>
            </Table>

            <div className="mt-16 flex justify-end">
                <div className="w-64 border-t border-slate-400 text-center pt-2">
                    <p className="font-bold text-xs uppercase">Authorized Signature</p>
                </div>
            </div>
        </div>
    );
}