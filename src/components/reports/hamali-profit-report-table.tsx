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
                <h2 className="text-xl font-bold">Sri Lakshmi Warehouse</h2>
                <p className="text-muted-foreground font-semibold uppercase">{title}</p>
                <p className="text-xs text-muted-foreground">Generated on: {generatedDate}</p>
            </div>
            <Table className="text-xs">
                <TableHeader>
                    <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Storage ID</TableHead>
                        <TableHead className="text-center">Bags</TableHead>
                        <TableHead className="text-right">Cust. Charge</TableHead>
                        <TableHead className="text-right">Worker Pay</TableHead>
                        <TableHead className="text-right">Difference</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {payableEvents.map((event, index) => {
                        const customerCharge = event.charge || event.payable;
                        const diff = customerCharge - event.payable;
                        return (
                        <TableRow key={index}>
                            <TableCell>{format(event.date, 'dd/MM/yy')}</TableCell>
                            <TableCell className="font-medium whitespace-nowrap">{getCustomerName(event.customerId)}</TableCell>
                            <TableCell>{event.description}</TableCell>
                            <TableCell className="font-mono">{event.recordId}</TableCell>
                            <TableCell className="text-center font-mono">{event.bags || ''}</TableCell>
                            <TableCell className="text-right font-mono">{formatCurrency(customerCharge)}</TableCell>
                            <TableCell className="text-right font-mono">{formatCurrency(event.payable)}</TableCell>
                            <TableCell className={`text-right font-mono font-bold ${diff >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                                {formatCurrency(diff)}
                            </TableCell>
                        </TableRow>
                    )})}
                </TableBody>
                <TableFooter>
                    <TableRow className="bg-secondary/30">
                        <TableCell colSpan={5} className="text-right font-bold">Totals</TableCell>
                        <TableCell className="text-right font-mono font-bold">{formatCurrency(totalCustomerCharge)}</TableCell>
                        <TableCell className="text-right font-mono font-bold">{formatCurrency(totalWorkerPayable)}</TableCell>
                        <TableCell className={`text-right font-mono font-bold ${totalDifference >= 0 ? 'text-green-600' : 'text-destructive'}`}>{formatCurrency(totalDifference)}</TableCell>
                    </TableRow>
                </TableFooter>
            </Table>
            
            <div className="mt-16 pt-8 flex flex-col items-center text-center space-y-2">
                <div className="w-64 border-t border-slate-300 pt-4">
                    <p className="text-[#1e293b] font-bold text-sm uppercase tracking-wider">Authorized Manager Signature</p>
                    <p className="text-primary font-bold text-xs uppercase mt-1">Sri Lakshmi Warehouse</p>
                </div>
                <p className="text-[10px] text-slate-400 mt-2">Report validity verified on {generatedDate}</p>
            </div>
        </div>
    );
}