'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { format } from "date-fns";
import type { Customer, StorageRecord } from "@/lib/definitions";
import { formatCurrency } from '@/lib/utils';
import { useMemo } from "react";
import type { CustomerHamaliEvent } from "./hamali-report";
import { ActionsMenu } from "@/components/dashboard/actions-menu";

type ReportTableProps = {
    events: CustomerHamaliEvent[];
    customers: Customer[];
    allRecords: StorageRecord[];
    title: string;
}

export function CustomerHamaliReportTable({ events, customers, allRecords, title }: ReportTableProps) {
    const generatedDate = useMemo(() => format(new Date(), 'dd/MM/yy, h:mm a'), []);

    const getCustomerName = (customerId: string) => {
        return customers.find(c => c.id === customerId)?.name ?? 'Unknown';
    }

    const totalCharges = events.filter(e => e.type === 'charge').reduce((acc, event) => acc + event.amount, 0);
    const totalPayments = events.filter(e => e.type === 'payment').reduce((acc, event) => acc + event.amount, 0);

    return (
        <div className="bg-white p-4 text-black font-sans text-sm printable-area">
             <div className="mb-4 text-center border-b-2 border-black pb-2">
                <h2 className="text-xl font-bold uppercase tracking-wide leading-tight">SRI LAKSHMI WAREHOUSE</h2>
                <p className="text-muted-foreground font-semibold uppercase text-[12px]">{title}</p>
                <p className="text-[10px] text-slate-400">Generated: {generatedDate}</p>
            </div>
            <div className="table-scroll-container border-y-2 border-black">
                <Table className="text-[13px]">
                    <TableHeader>
                        <TableRow className="border-b border-black">
                            <TableHead className="font-bold text-black p-1 text-center uppercase text-[9px]">Date</TableHead>
                            <TableHead className="font-bold text-black p-1 text-left uppercase text-[9px]">Customer Name</TableHead>
                            <TableHead className="font-bold text-black p-1 text-center uppercase text-[9px]">Ref ID</TableHead>
                            <TableHead className="font-bold text-black p-1 text-right uppercase text-[9px]">Charge</TableHead>
                            <TableHead className="font-bold text-black p-1 text-right uppercase text-[9px]">Payment</TableHead>
                            <TableHead className="font-bold text-black p-1 text-right uppercase text-[9px] print-hide">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {events.map((event, index) => {
                            const parentRecord = allRecords.find(r => r.id === event.recordId);
                            
                            return (
                                <TableRow key={index} className="h-7 border-b border-slate-100">
                                    <TableCell className="p-1 text-center whitespace-nowrap">{format(event.date, 'dd/MM/yy')}</TableCell>
                                    <TableCell className="p-1 font-medium uppercase whitespace-nowrap">{getCustomerName(event.customerId)}</TableCell>
                                    <TableCell className="p-1 text-center font-mono text-slate-400">{event.recordId}</TableCell>
                                    <TableCell className="p-1 text-right font-mono">
                                        {event.type === 'charge' ? formatCurrency(event.amount) : ''}
                                    </TableCell>
                                    <TableCell className="p-1 text-right font-mono text-green-700">
                                        {event.type === 'payment' ? formatCurrency(event.amount) : ''}
                                    </TableCell>
                                    <TableCell className="p-1 text-right print-hide">
                                        {parentRecord && (
                                            <ActionsMenu record={parentRecord} customers={customers} allRecords={allRecords} />
                                        )}
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                    <TableFooter>
                        <TableRow className="bg-slate-50 font-bold border-t-2 border-black">
                            <TableCell colSpan={3} className="p-1 text-right uppercase text-[10px]">Total Ledger Dues</TableCell>
                            <TableCell className="p-1 text-right font-mono">{formatCurrency(totalCharges)}</TableCell>
                            <TableCell className="p-1 text-right font-mono text-green-700">{formatCurrency(totalPayments)}</TableCell>
                            <TableCell className="print-hide" />
                        </TableRow>
                         <TableRow className="bg-black text-white font-black">
                            <TableCell colSpan={4} className="p-1 text-right uppercase text-[10px]">Net Customer Pending</TableCell>
                            <TableCell className="p-1 text-right font-mono text-[14px]">{formatCurrency(totalCharges - totalPayments)}</TableCell>
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