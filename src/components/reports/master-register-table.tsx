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
        <div className="bg-white p-4 rounded border shadow-sm overflow-x-auto">
             <div className="mb-6 text-center border-b pb-4">
                <h2 className="text-xl font-bold uppercase">{title}</h2>
                <p className="text-[10px] text-slate-500 uppercase mt-1">Generated: {generatedDate}</p>
            </div>
            <Table className="text-[13px] border-collapse border border-slate-200">
                <TableHeader>
                    <TableRow className="bg-slate-50">
                        <TableHead className="text-black font-bold border-r p-1 text-center uppercase text-[9px]">Date</TableHead>
                        <TableHead className="text-black font-bold border-r p-1 text-center uppercase text-[9px]">Serial</TableHead>
                        <TableHead className="text-black font-bold border-r p-1 text-left uppercase text-[9px] min-w-[120px]">Customer</TableHead>
                        <TableHead className="text-black font-bold border-r p-1 text-center uppercase text-[9px]">Lot</TableHead>
                        <TableHead className="text-black font-bold border-r p-1 text-right uppercase text-[9px]">In</TableHead>
                        <TableHead className="text-black font-bold border-r p-1 text-right uppercase text-[9px]">Out</TableHead>
                        <TableHead className="text-black font-bold border-r p-1 text-right uppercase text-[9px]">Bal</TableHead>
                        <TableHead className="text-black font-bold border-r p-1 text-right uppercase text-[9px]">Billed</TableHead>
                        <TableHead className="text-black font-bold border-r p-1 text-right uppercase text-[9px]">Paid</TableHead>
                        <TableHead className="text-black font-bold border-r p-1 text-right uppercase text-[9px]">Due</TableHead>
                        <TableHead className="text-black font-bold p-1 text-center uppercase text-[9px]">Stat</TableHead>
                        <TableHead className="w-[30px] print-hide"></TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {processedRecords.length > 0 ? (
                        processedRecords.map((record) => (
                            <TableRow key={record.id} className="h-7 border-b border-slate-100 hover:bg-slate-50">
                                <TableCell className="text-center whitespace-nowrap p-1">{format(toDate(record.storageStartDate), 'dd/MM/yy')}</TableCell>
                                <TableCell className="text-center font-mono text-slate-400 p-1">{record.id}</TableCell>
                                <TableCell className="font-bold whitespace-nowrap p-1 uppercase tracking-tighter">{getCustomerName(record.customerId)}</TableCell>
                                <TableCell className="text-center font-mono p-1">{record.location}</TableCell>
                                <TableCell className="text-right font-mono p-1">{record.bagsIn}</TableCell>
                                <TableCell className="text-right font-mono p-1">{record.bagsOut}</TableCell>
                                <TableCell className="text-right font-mono font-bold text-primary p-1">{record.bagsStored}</TableCell>
                                <TableCell className="text-right font-mono p-1">{formatCurrency(record.totalBilled)}</TableCell>
                                <TableCell className="text-right font-mono text-green-600 p-1">{formatCurrency(record.totalPaid)}</TableCell>
                                <TableCell className={`text-right font-mono p-1 ${record.balanceDue > 0.5 ? 'text-destructive font-bold' : ''}`}>
                                    {formatCurrency(record.balanceDue)}
                                </TableCell>
                                <TableCell className="text-center p-1">
                                    <Badge variant="outline" className={`text-[8px] h-3 px-1 py-0 uppercase ${record.storageEndDate ? 'bg-zinc-100' : 'bg-green-50 text-green-700'}`}>
                                        {record.storageEndDate ? 'X' : 'L'}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-right print-hide p-1">
                                    <ActionsMenu record={record} customers={customers} allRecords={records} />
                                </TableCell>
                            </TableRow>
                        ))
                    ) : (
                        <TableRow>
                            <TableCell colSpan={12} className="h-16 text-center text-muted-foreground italic">No History Found</TableCell>
                        </TableRow>
                    )}
                </TableBody>
                <TableFooter>
                    <TableRow className="border-t border-slate-900 bg-slate-50 font-bold">
                        <TableCell colSpan={4} className="p-2 text-right uppercase text-[9px]">Grand Totals</TableCell>
                        <TableCell className="text-right font-mono p-1">{totals.bagsIn}</TableCell>
                        <TableCell className="text-right font-mono p-1">{totals.bagsOut}</TableCell>
                        <TableCell className="text-right font-mono p-1 text-primary">{totals.bagsStored}</TableCell>
                        <TableCell className="text-right font-mono p-1">{formatCurrency(totals.billed)}</TableCell>
                        <TableCell className="text-right font-mono text-green-700 p-1">{formatCurrency(totals.paid)}</TableCell>
                        <TableCell className="text-right font-mono text-destructive p-1">{formatCurrency(totals.due)}</TableCell>
                        <TableCell colSpan={2}></TableCell>
                    </TableRow>
                </TableFooter>
            </Table>
        </div>
    );
}