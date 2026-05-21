
'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { format } from "date-fns";
import type { Customer } from "@/lib/definitions";
import { formatCurrency } from '@/lib/utils';
import { useMemo } from "react";
import type { CustomerHamaliEvent } from "./hamali-report";

type ReportTableProps = {
    events: CustomerHamaliEvent[];
    customers: Customer[];
    title: string;
}

export function CustomerHamaliReportTable({ events, customers, title }: ReportTableProps) {
    const generatedDate = useMemo(() => format(new Date(), 'dd MMM yyyy, hh:mm a'), []);
    const safeEvents = events || [];

    const getCustomerName = (customerId: string) => {
        return customers.find(c => c.id === customerId)?.name ?? 'Unknown';
    }

    const totalCharges = safeEvents.filter(e => e.type === 'charge').reduce((acc, event) => acc + event.amount, 0);
    const totalPayments = safeEvents.filter(e => e.type === 'payment').reduce((acc, event) => acc + event.amount, 0);

    return (
        <div className="bg-white p-4 rounded-lg">
             <div className="mb-4 text-center">
                <h2 className="text-xl font-bold uppercase tracking-wide">SRI LAKSHMI WAREHOUSE</h2>
                <p className="text-muted-foreground font-semibold uppercase text-[14px]">{title}</p>
                <p className="text-[11px] text-slate-400 mt-1">Generated: {generatedDate}</p>
            </div>
            <Table className="text-[13px]">
                <TableHeader>
                    <TableRow className="bg-muted/50">
                        <TableHead className="uppercase text-[10px] font-bold">Date</TableHead>
                        <TableHead className="uppercase text-[10px] font-bold">Customer</TableHead>
                        <TableHead className="uppercase text-[10px] font-bold">Description</TableHead>
                        <TableHead className="uppercase text-[10px] font-bold">Ref ID</TableHead>
                        <TableHead className="text-center uppercase text-[10px] font-bold">Bags</TableHead>
                        <TableHead className="text-right uppercase text-[10px] font-bold">Charge</TableHead>
                        <TableHead className="text-right uppercase text-[10px] font-bold">Payment</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {safeEvents.map((event, index) => (
                        <TableRow key={index} className="h-8">
                            <TableCell className="p-1">{format(event.date, 'dd/MM/yy')}</TableCell>
                            <TableCell className="p-1 font-medium whitespace-nowrap">{getCustomerName(event.customerId)}</TableCell>
                            <TableCell className="p-1 tracking-tight">{event.description}</TableCell>
                            <TableCell className="p-1 font-mono text-slate-400">{event.recordId}</TableCell>
                            <TableCell className="p-1 text-center font-mono">{event.bags || ''}</TableCell>
                            <TableCell className="p-1 text-right font-mono">
                                {event.type === 'charge' ? formatCurrency(event.amount) : ''}
                            </TableCell>
                            <TableCell className="p-1 text-right font-mono text-green-600">
                                {event.type === 'payment' ? formatCurrency(event.amount) : ''}
                            </TableCell>
                        </TableRow>
                    ))}
                    {safeEvents.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={7} className="text-center text-muted-foreground py-10 italic">
                                No hamali transactions found.
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
                <TableFooter>
                    <TableRow className="bg-secondary/30 font-bold">
                        <TableCell colSpan={5} className="p-2 text-right uppercase text-[10px]">Totals</TableCell>
                        <TableCell className="p-2 text-right font-mono">{formatCurrency(totalCharges)}</TableCell>
                        <TableCell className="p-2 text-right font-mono text-green-600">{formatCurrency(totalPayments)}</TableCell>
                    </TableRow>
                     <TableRow className="font-black border-t-2 border-primary">
                        <TableCell colSpan={6} className="p-2 text-right uppercase text-[11px] text-slate-500">Balance Pending from Customers</TableCell>
                        <TableCell className="p-2 text-right font-mono text-[14px] text-destructive">{formatCurrency(totalCharges - totalPayments)}</TableCell>
                    </TableRow>
                </TableFooter>
            </Table>
            
            <div className="mt-16 pt-8 flex flex-col items-end text-center space-y-1">
                <div className="w-72 border-t border-slate-400 pt-4">
                    <p className="text-[#1e293b] font-bold text-[12px] uppercase tracking-wider">Authorized Manager Signature</p>
                </div>
            </div>
        </div>
    );
}
