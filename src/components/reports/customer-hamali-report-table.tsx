
'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { format } from "date-fns";
import type { Customer, WarehouseInfo } from "@/lib/definitions";
import { formatCurrency } from '@/lib/utils';
import { useMemo } from "react";
import type { CustomerHamaliEvent } from "./hamali-report";

type ReportTableProps = {
    events: CustomerHamaliEvent[];
    customers: Customer[];
    title: string;
    warehouseInfo: WarehouseInfo | null;
}

export function CustomerHamaliReportTable({ events, customers, title, warehouseInfo }: ReportTableProps) {
    const generatedDate = useMemo(() => format(new Date(), 'dd MMM yyyy, hh:mm a'), []);

    const getCustomerName = (customerId?: string) => {
        if (!customerId) return '';
        return customers.find(c => c.id === customerId)?.name ?? 'Unknown';
    }

    const totalCharges = events.filter(e => e.type === 'charge').reduce((acc, event) => acc + event.amount, 0);
    const totalPayments = events.filter(e => e.type === 'payment').reduce((acc, event) => acc + event.amount, 0);
    
    return (
        <div className="bg-white p-4 rounded-lg">
             <div className="mb-4 text-center border-b pb-3">
                <h2 className="text-xl font-bold uppercase tracking-wide leading-none">SRI LAKSHMI WAREHOUSE</h2>
                <p className="text-muted-foreground font-semibold uppercase text-sm mt-1">{title}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Generated: {generatedDate}</p>
            </div>
            <Table className="text-[13px]">
                <TableHeader>
                    <TableRow className="bg-muted/50">
                        <TableHead className="uppercase text-[9px] font-bold">Date</TableHead>
                        <TableHead className="uppercase text-[9px] font-bold">Customer</TableHead>
                        <TableHead className="uppercase text-[9px] font-bold">Description</TableHead>
                        <TableHead className="uppercase text-[9px] font-bold">Storage ID</TableHead>
                        <TableHead className="text-center uppercase text-[9px] font-bold">Bags</TableHead>
                        <TableHead className="text-right uppercase text-[9px] font-bold">Charge</TableHead>
                        <TableHead className="text-right uppercase text-[9px] font-bold">Payment</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {events.map((event, index) => (
                        <TableRow key={index} className="h-8 border-b border-slate-50">
                            <TableCell>{format(event.date, 'dd/MM/yy')}</TableCell>
                            <TableCell className="font-black whitespace-nowrap uppercase tracking-tighter">{getCustomerName(event.customerId)}</TableCell>
                            <TableCell className="text-slate-600 italic tracking-tight">{event.description}</TableCell>
                            <TableCell className="font-mono text-slate-400">{event.recordId}</TableCell>
                            <TableCell className="text-center font-mono">{event.bags || ''}</TableCell>
                            <TableCell className="text-right font-mono font-bold">
                                {event.type === 'charge' ? formatCurrency(event.amount) : ''}
                            </TableCell>
                            <TableCell className="text-right font-mono font-bold text-green-600">
                                {event.type === 'payment' ? formatCurrency(event.amount) : ''}
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
                <TableFooter>
                    <TableRow className="bg-secondary/30 font-black">
                        <TableCell colSpan={5} className="text-right uppercase text-[10px]">Totals</TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(totalCharges)}</TableCell>
                        <TableCell className="text-right font-mono text-green-700">{formatCurrency(totalPayments)}</TableCell>
                    </TableRow>
                     <TableRow className="bg-slate-900 text-white font-black">
                        <TableCell colSpan={6} className="text-right uppercase text-[11px] tracking-tight">Net Customer Balance Pending</TableCell>
                        <TableCell className="text-right font-mono text-lg">{formatCurrency(totalCharges - totalPayments)}</TableCell>
                    </TableRow>
                </TableFooter>
            </Table>
            
            <div className="mt-16 pt-4 flex flex-col items-end text-center space-y-1">
                <div className="w-72 border-t border-slate-400 pt-2">
                    <p className="text-[#1e293b] font-bold text-[12px] uppercase tracking-wider">Authorized Manager Signature</p>
                </div>
            </div>
        </div>
    );
}
