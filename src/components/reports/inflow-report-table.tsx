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
    const generatedDate = useMemo(() => format(new Date(), 'dd MMM yyyy, hh:mm a'), []);

    const getCustomerName = (customerId: string) => {
        return customers.find(c => c.id === customerId)?.name ?? 'Unknown';
    }

    const totalBagsIn = records.reduce((acc, record) => acc + (record.bagsIn || 0), 0);

    return (
        <div className="bg-white p-4 rounded-lg">
             <div className="mb-4 text-center">
                <h2 className="text-xl font-bold uppercase tracking-wide">SRI LAKSHMI WAREHOUSE</h2>
                <p className="text-lg font-semibold uppercase">{title}</p>
                <p className="text-xs text-muted-foreground">Generated on: {generatedDate}</p>
            </div>
            <Table className="border-collapse border border-slate-200">
                <TableHeader>
                    <TableRow className="bg-[#3498db] hover:bg-[#3498db]">
                        <TableHead className="h-auto p-2 text-white border border-slate-300 text-center uppercase">Date</TableHead>
                        <TableHead className="h-auto p-2 text-white border border-slate-300 text-center uppercase">Inflow Bill No</TableHead>
                        <TableHead className="h-auto p-2 text-white border border-slate-300 text-center uppercase">Customer</TableHead>
                        <TableHead className="h-auto p-2 text-white border border-slate-300 text-center uppercase">Commodity</TableHead>
                        <TableHead className="h-auto p-2 text-white border border-slate-300 text-center uppercase">Lot No</TableHead>
                        <TableHead className="h-auto p-2 text-white border border-slate-300 text-center uppercase">Bags In</TableHead>
                        <TableHead className="h-auto p-2 text-white border border-slate-300 text-center uppercase print-hide">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {records.length > 0 ? (
                        records.map((record) => (
                            <TableRow key={record.id} className="hover:bg-slate-50 h-8">
                                <TableCell className="p-2 border border-slate-300 text-center">{format(toDate(record.storageStartDate), 'dd/MM/yyyy')}</TableCell>
                                <TableCell className="p-2 border border-slate-300 text-center font-mono">{record.id}</TableCell>
                                <TableCell className="p-2 border border-slate-300 text-center font-medium">{getCustomerName(record.customerId)}</TableCell>
                                <TableCell className="p-2 border border-slate-300 text-center">{record.commodityDescription}</TableCell>
                                <TableCell className="p-2 border border-slate-300 text-center">{record.location}</TableCell>
                                <TableCell className="p-2 border border-slate-300 text-center font-mono font-bold">{record.bagsIn}</TableCell>
                                <TableCell className="p-2 border border-slate-300 text-center print-hide">
                                    <ActionsMenu record={record} customers={customers} allRecords={allRecords} />
                                </TableCell>
                            </TableRow>
                        ))
                    ) : (
                        <TableRow>
                            <TableCell colSpan={7} className="p-4 border border-slate-300 text-center text-muted-foreground italic">
                                No inflow records found for the selected period.
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
                <TableFooter>
                    <TableRow className="border-t-2 border-primary bg-secondary/20">
                        <TableCell 
                            colSpan={5}
                            className="p-2 border border-slate-300 text-right font-bold"
                        >
                            Total Bags Received
                        </TableCell>
                        <TableCell className="p-2 border border-slate-300 text-center font-mono font-bold">{totalBagsIn}</TableCell>
                        <TableCell className="p-2 border border-slate-300 print-hide"></TableCell>
                    </TableRow>
                </TableFooter>
            </Table>

            <div className="mt-16 pt-8 flex flex-col items-end text-center space-y-1">
                <div className="w-72 border-t border-slate-400 pt-4">
                    <p className="text-[#1e293b] font-bold text-sm uppercase tracking-wider">AUTHORIZED MANAGER SIGNATURE</p>
                    <p className="text-primary font-bold text-xs uppercase mt-1">SRI LAKSHMI WAREHOUSE</p>
                </div>
                <div className="text-[10px] text-slate-500 italic mt-4">
                    <p>Report validity verified on {generatedDate}</p>
                    <p>This is a computer generated statement.</p>
                </div>
            </div>
        </div>
    );
}
