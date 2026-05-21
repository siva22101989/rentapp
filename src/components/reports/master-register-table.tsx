
'use client';

import React, { useMemo } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { format } from "date-fns";
import type { Customer, StorageRecord } from "@/lib/definitions";
import { toDate, formatCurrency } from '@/lib/utils';
import { Badge } from "../ui/badge";
import { ActionsMenu } from "../dashboard/actions-menu";

type MasterRegisterTableProps = {
    records: StorageRecord[];
    customers: Customer[];
    title: string;
}

export function MasterRegisterTable({ records, customers, title }: MasterRegisterTableProps) {
    const generatedDate = useMemo(() => format(new Date(), 'dd MMM yyyy, hh:mm a'), []);

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
        }).sort((a, b) => {
            const dateA = toDate(a.storageStartDate);
            const dateB = toDate(b.storageStartDate);
            return dateB.getTime() - dateA.getTime();
        });
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
        <div className="bg-white p-4 rounded-lg overflow-x-auto shadow-sm border">
             <div className="mb-6 text-center border-b pb-4">
                <h2 className="text-xl font-black uppercase tracking-tight">SRI LAKSHMI WAREHOUSE</h2>
                <p className="text-muted-foreground font-semibold uppercase tracking-wider text-[14px]">{title}</p>
                <p className="text-[10px] text-slate-400 mt-1">Generated: {generatedDate}</p>
            </div>
            <Table className="text-[13px] border-collapse">
                <TableHeader>
                    <TableRow className="bg-slate-900 hover:bg-slate-900">
                        <TableHead className="text-white uppercase text-[9px] font-bold p-2 text-center border-r border-slate-700">Date</TableHead>
                        <TableHead className="text-white uppercase text-[9px] font-bold p-2 text-center border-r border-slate-700">Serial</TableHead>
                        <TableHead className="text-white uppercase text-[9px] font-bold p-2 text-left border-r border-slate-700 min-w-[140px]">Customer</TableHead>
                        <TableHead className="text-white uppercase text-[9px] font-bold p-2 text-center border-r border-slate-700">Product</TableHead>
                        <TableHead className="text-white uppercase text-[9px] font-bold p-2 text-center border-r border-slate-700">Lot</TableHead>
                        <TableHead className="text-white uppercase text-[9px] font-bold p-2 text-right border-r border-slate-700">In</TableHead>
                        <TableHead className="text-white uppercase text-[9px] font-bold p-2 text-right border-r border-slate-700">Out</TableHead>
                        <TableHead className="text-white uppercase text-[9px] font-bold p-2 text-right border-r border-slate-700">Bal</TableHead>
                        <TableHead className="text-white uppercase text-[9px] font-bold p-2 text-right border-r border-slate-700">Billed</TableHead>
                        <TableHead className="text-white uppercase text-[9px] font-bold p-2 text-right border-r border-slate-700">Paid</TableHead>
                        <TableHead className="text-white uppercase text-[9px] font-bold p-2 text-right border-r border-slate-700">Due</TableHead>
                        <TableHead className="text-white uppercase text-[9px] font-bold p-2 text-center">Status</TableHead>
                        <TableHead className="w-[40px] print-hide"></TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {processedRecords.length > 0 ? (
                        processedRecords.map((record) => {
                            const date = toDate(record.storageStartDate);
                            return (
                            <TableRow key={record.id} className="h-8 border-b border-slate-100 hover:bg-slate-50">
                                <TableCell className="text-center whitespace-nowrap p-1 text-slate-500 font-bold">{format(date, 'dd/MM/yy')}</TableCell>
                                <TableCell className="text-center font-mono font-black text-slate-400 p-1">{record.id}</TableCell>
                                <TableCell className="font-black whitespace-nowrap p-1 uppercase tracking-tighter">{getCustomerName(record.customerId)}</TableCell>
                                <TableCell className="text-center p-1 font-bold text-slate-600">{record.commodityDescription}</TableCell>
                                <TableCell className="text-center font-mono font-bold text-slate-500 p-1">{record.location}</TableCell>
                                <TableCell className="text-right font-mono font-bold text-sky-600 p-1">{record.bagsIn}</TableCell>
                                <TableCell className="text-right font-mono font-bold text-orange-600 p-1">{record.bagsOut}</TableCell>
                                <TableCell className="text-right font-mono font-black text-primary p-1 bg-slate-50/50">{record.bagsStored}</TableCell>
                                <TableCell className="text-right font-mono p-1">{formatCurrency(record.totalBilled)}</TableCell>
                                <TableCell className="text-right font-mono text-green-600 font-bold p-1">{formatCurrency(record.totalPaid)}</TableCell>
                                <TableCell className={`text-right font-mono font-black p-1 ${record.balanceDue > 0.5 ? 'text-destructive' : 'text-slate-400'}`}>
                                    {formatCurrency(record.balanceDue)}
                                </TableCell>
                                <TableCell className="text-center p-1">
                                    <Badge variant="outline" className={`text-[9px] h-4 py-0 uppercase font-black ${record.storageEndDate ? 'bg-zinc-100 text-zinc-500' : 'bg-green-50 text-green-700 border-green-200'}`}>
                                        {record.storageEndDate ? 'Closed' : 'Live'}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-right print-hide p-1">
                                    <ActionsMenu record={record} customers={customers} allRecords={records} />
                                </TableCell>
                            </TableRow>
                        )})
                    ) : (
                        <TableRow>
                            <TableCell colSpan={13} className="h-20 text-center text-slate-300 font-black uppercase tracking-widest text-[11px] italic">No Audit History Found</TableCell>
                        </TableRow>
                    )}
                </TableBody>
                <TableFooter>
                    <TableRow className="border-t-2 border-slate-900 bg-slate-50 font-black">
                        <TableCell colSpan={5} className="p-3 text-right uppercase text-[10px] tracking-tight">Grand Total Portfolio</TableCell>
                        <TableCell className="text-right font-mono p-1 text-sky-700">{totals.bagsIn}</TableCell>
                        <TableCell className="text-right font-mono p-1 text-orange-700">{totals.bagsOut}</TableCell>
                        <TableCell className="text-right font-mono p-1 text-primary text-lg">{totals.bagsStored}</TableCell>
                        <TableCell className="text-right font-mono p-1">{formatCurrency(totals.billed)}</TableCell>
                        <TableCell className="text-right font-mono text-green-700 p-1">{formatCurrency(totals.paid)}</TableCell>
                        <TableCell className="text-right font-mono text-destructive p-1 text-lg">{formatCurrency(totals.due)}</TableCell>
                        <TableCell colSpan={2}></TableCell>
                    </TableRow>
                </TableFooter>
            </Table>
        </div>
    );
}
