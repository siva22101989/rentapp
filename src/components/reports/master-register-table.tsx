'use client';

import React, { useMemo } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { format } from "date-fns";
import type { Customer, StorageRecord } from "@/lib/definitions";
import { toDate, formatCurrency } from '@/lib/utils';
import { ActionsMenu } from "@/components/dashboard/actions-menu";

type MasterRegisterTableProps = {
    records: StorageRecord[];
    customers: Customer[];
    title: string;
}

export function MasterRegisterTable({ records, customers, title }: MasterRegisterTableProps) {
    const generatedDate = useMemo(() => format(new Date(), 'dd/MM/yy, h:mm a'), []);

    const getCustomerName = (customerId: string) => {
        return customers.find(c => c.id === customerId)?.name ?? 'Unknown';
    }

    const processedRecords = useMemo(() => {
        return records.map(record => {
            const totalPaid = (record.payments || []).reduce((acc, p) => acc + p.amount, 0);
            const totalBilled = (record.hamaliPayable || 0) + (record.totalRentBilled || 0);
            return {
                ...record,
                totalBilled,
                totalPaid,
                balanceDue: totalBilled - totalPaid
            };
        }).sort((a, b) => toDate(b.storageStartDate).getTime() - toDate(a.storageStartDate).getTime());
    }, [records]);

    const totals = useMemo(() => {
        return processedRecords.reduce((acc, r) => {
            acc.bagsIn += (r.bagsIn || 0);
            acc.bagsOut += (r.bagsOut || 0);
            acc.bagsStored += (r.bagsStored || 0);
            acc.billed += r.totalBilled;
            acc.paid += r.totalPaid;
            acc.due += r.balanceDue;
            return acc;
        }, { bagsIn: 0, bagsOut: 0, bagsStored: 0, billed: 0, paid: 0, due: 0 });
    }, [processedRecords]);

    return (
        <div className="bg-white p-4 text-black font-sans text-sm printable-area">
             <div className="mb-4 text-center border-b-2 border-black pb-2">
                <h2 className="text-xl font-bold uppercase">{title}</h2>
                <p className="text-[10px] text-slate-500 uppercase">Generated: {generatedDate}</p>
            </div>
            <div className="table-scroll-container border-y-2 border-black">
                <Table className="text-[12px]">
                    <TableHeader>
                        <TableRow className="border-b border-black">
                            <TableHead className="font-bold text-black p-1 text-center uppercase text-[9px]">Date</TableHead>
                            <TableHead className="font-bold text-black p-1 text-center uppercase text-[9px]">Serial</TableHead>
                            <TableHead className="font-bold text-black p-1 text-left uppercase text-[9px]">Customer Name</TableHead>
                            <TableHead className="font-bold text-black p-1 text-right uppercase text-[9px]">In</TableHead>
                            <TableHead className="font-bold text-black p-1 text-right uppercase text-[9px]">Out</TableHead>
                            <TableHead className="font-bold text-black p-1 text-right uppercase text-[9px]">Billed</TableHead>
                            <TableHead className="font-bold text-black p-1 text-right uppercase text-[9px]">Paid</TableHead>
                            <TableHead className="font-bold text-black p-1 text-right uppercase text-[9px]">Due</TableHead>
                            <TableHead className="font-bold text-black p-1 text-right uppercase text-[9px] print-hide">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {processedRecords.map((record) => (
                            <TableRow key={record.id} className="h-7 border-b border-slate-100">
                                <TableCell className="p-1 text-center whitespace-nowrap">{format(toDate(record.storageStartDate), 'dd/MM/yy')}</TableCell>
                                <TableCell className="p-1 text-center font-mono text-slate-400">{record.id}</TableCell>
                                <TableCell className="p-1 font-bold whitespace-nowrap uppercase tracking-tighter">{getCustomerName(record.customerId)}</TableCell>
                                <TableCell className="p-1 text-right font-mono">{record.bagsIn}</TableCell>
                                <TableCell className="p-1 text-right font-mono">{record.bagsOut}</TableCell>
                                <TableCell className="p-1 text-right font-mono">{formatCurrency(record.totalBilled)}</TableCell>
                                <TableCell className="p-1 text-right font-mono text-green-700">{formatCurrency(record.totalPaid)}</TableCell>
                                <TableCell className={`p-1 text-right font-mono font-bold ${record.balanceDue > 0.5 ? 'text-destructive' : ''}`}>
                                    {formatCurrency(record.balanceDue)}
                                </TableCell>
                                <TableCell className="p-1 text-right print-hide">
                                    <ActionsMenu record={record} customers={customers} allRecords={records} />
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                    <TableFooter>
                        <TableRow className="bg-slate-50 font-bold border-t-2 border-black">
                            <TableCell colSpan={3} className="p-1 text-right uppercase text-[9px]">Total Master Audit</TableCell>
                            <TableCell className="p-1 text-right font-mono">{totals.bagsIn}</TableCell>
                            <TableCell className="p-1 text-right font-mono">{totals.bagsOut}</TableCell>
                            <TableCell className="p-1 text-right font-mono">{formatCurrency(totals.billed)}</TableCell>
                            <TableCell className="p-1 text-right font-mono text-green-700">{formatCurrency(totals.paid)}</TableCell>
                            <TableCell className="p-1 text-right font-mono text-destructive">{formatCurrency(totals.due)}</TableCell>
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