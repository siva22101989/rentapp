
'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { format } from "date-fns";
import type { Customer } from "@/lib/definitions";
import { formatCurrency } from '@/lib/utils';
import { useMemo } from "react";

type WorkerHamaliEvent = {
    date: Date;
    description: string;
    recordId: string;
    customerId?: string;
    payable: number;
    charge: number;
    paid: number;
    bags?: number;
}

type ReportTableProps = {
    events: WorkerHamaliEvent[];
    customers: Customer[];
    title: string;
}

export function HamaliProfitReportTable({ events, customers, title }: ReportTableProps) {
    const generatedDate = useMemo(() => format(new Date(), 'dd MMM yyyy, hh:mm a'), []);
    
    const getCustomerName = (customerId?: string) => {
        if (!customerId) return 'N/A';
        return customers.find(c => c.id === customerId)?.name ?? 'Unknown';
    }

    const payableEvents = useMemo(() => events.filter(e => e.payable > 0 || (e.charge && e.charge > 0)), [events]);

    const totalCustomerCharge = payableEvents.reduce((acc, event) => acc + (event.charge || event.payable), 0);
    const totalWorkerPayable = payableEvents.reduce((acc, event) => acc + event.payable, 0);
    const totalDifference = totalCustomerCharge - totalWorkerPayable;

    return (
        <div className="bg-white p-4 rounded-lg">
             <div className="mb-4 text-center">
                <h2 className="text-xl font-bold uppercase tracking-wide">SRI LAKSHMI WAREHOUSE</h2>
                <p className="text-muted-foreground font-semibold uppercase text-[14px]">{title}</p>
                <p className="text-xs text-muted-foreground">Generated on: {generatedDate}</p>
            </div>
            <Table className="text-[13px]">
                <TableHeader>
                    <TableRow className="bg-muted/50">
                        <TableHead className="uppercase text-[10px] font-bold">Date</TableHead>
                        <TableHead className="uppercase text-[10px] font-bold">Customer</TableHead>
                        <TableHead className="uppercase text-[10px] font-bold">Description</TableHead>
                        <TableHead className="uppercase text-[10px] font-bold">Storage ID</TableHead>
                        <TableHead className="text-center uppercase text-[10px] font-bold">Bags</TableHead>
                        <TableHead className="text-right uppercase text-[10px] font-bold">Cust. Charge</TableHead>
                        <TableHead className="text-right uppercase text-[10px] font-bold">Worker Pay</TableHead>
                        <TableHead className="text-right uppercase text-[10px] font-bold">Diff.</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {payableEvents.map((event, index) => {
                        const customerCharge = event.charge || event.payable;
                        const diff = customerCharge - event.payable;
                        return (
                        <TableRow key={index} className="h-8">
                            <TableCell className="p-1">{format(event.date, 'dd/MM/yy')}</TableCell>
                            <TableCell className="p-1 font-medium whitespace-nowrap">{getCustomerName(event.customerId)}</TableCell>
                            <TableCell className="p-1 tracking-tight">{event.description}</TableCell>
                            <TableCell className="p-1 font-mono text-slate-400">{event.recordId}</TableCell>
                            <TableCell className="p-1 text-center font-mono">{event.bags || ''}</TableCell>
                            <TableCell className="p-1 text-right font-mono">{formatCurrency(customerCharge)}</TableCell>
                            <TableCell className="p-1 text-right font-mono">{formatCurrency(event.payable)}</TableCell>
                            <TableCell className={`p-1 text-right font-mono font-bold ${diff >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                                {formatCurrency(diff)}
                            </TableCell>
                        </TableRow>
                    )})}
                     {payableEvents.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={8} className="text-center text-muted-foreground py-10 italic">No margin records found.</TableCell>
                        </TableRow>
                    )}
                </TableBody>
                <TableFooter>
                    <TableRow className="bg-secondary/30 font-bold">
                        <TableCell colSpan={5} className="p-2 text-right uppercase text-[10px]">Grand Totals</TableCell>
                        <TableCell className="p-2 text-right font-mono">{formatCurrency(totalCustomerCharge)}</TableCell>
                        <TableCell className="p-2 text-right font-mono">{formatCurrency(totalWorkerPayable)}</TableCell>
                        <TableCell className={`p-2 text-right font-mono font-black ${totalDifference >= 0 ? 'text-green-600' : 'text-destructive'}`}>{formatCurrency(totalDifference)}</TableCell>
                    </TableRow>
                </TableFooter>
            </Table>
            
            <div className="mt-16 pt-8 flex flex-col items-end text-center space-y-1">
                <div className="w-72 border-t border-slate-400 pt-4">
                    <p className="text-[#1e293b] font-bold text-sm uppercase tracking-wider">AUTHORIZED MANAGER SIGNATURE</p>
                    <p className="text-primary font-bold text-xs uppercase mt-1">SRI LAKSHMI WAREHOUSE</p>
                </div>
            </div>
        </div>
    );
}
