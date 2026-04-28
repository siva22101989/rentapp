'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { format } from "date-fns";
import type { Customer } from "@/lib/definitions";
import { formatCurrency } from '@/lib/utils';
import { useMemo } from "react";
import type { WorkerHamaliEvent } from "./hamali-report";

type ReportTableProps = {
    events: WorkerHamaliEvent[];
    customers: Customer[];
    title: string;
}

export function HamaliProfitReportTable({ events, customers, title }: ReportTableProps) {
    const generatedDate = useMemo(() => format(new Date(), 'dd MMM yyyy, hh:mm a'), []);
    
    const getCustomerName = (customerId?: string) => {
        if (!customerId) return '';
        return customers.find(c => c.id === customerId)?.name ?? 'Unknown';
    }

    const payableEvents = useMemo(() => events.filter(e => e.payable > 0 || (e.customerCharge && e.customerCharge > 0)), [events]);

    const totalCustomerCharge = payableEvents.reduce((acc, event) => acc + (event.customerCharge || event.payable), 0);
    const totalWorkerPayable = payableEvents.reduce((acc, event) => acc + event.payable, 0);
    const totalDifference = totalCustomerCharge - totalWorkerPayable;

    return (
        <div className="bg-white p-4 rounded-lg">
             <div className="mb-4">
                <h2 className="text-xl font-bold">GrainDost</h2>
                <p className="text-muted-foreground">{title}</p>
                <p className="text-xs text-muted-foreground">Generated on: {generatedDate}</p>
            </div>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Ref ID</TableHead>
                        <TableHead className="text-center">Bags</TableHead>
                        <TableHead className="text-right">Customer Charge</TableHead>
                        <TableHead className="text-right">Worker Payable</TableHead>
                        <TableHead className="text-right">Difference</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {payableEvents.map((event, index) => {
                        const customerCharge = event.customerCharge || event.payable;
                        const difference = customerCharge - event.payable;
                        return (
                        <TableRow key={index}>
                            <TableCell>{format(event.date, 'dd MMM yyyy')}</TableCell>
                            <TableCell className="font-medium">{getCustomerName(event.customerId)}</TableCell>
                            <TableCell>{event.description}</TableCell>
                            <TableCell>{event.recordId}</TableCell>
                            <TableCell className="text-center font-mono">{event.bags || ''}</TableCell>
                            <TableCell className="text-right font-mono">
                                {formatCurrency(customerCharge)}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                                {formatCurrency(event.payable)}
                            </TableCell>
                            <TableCell className={`text-right font-mono ${difference >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                                {formatCurrency(difference)}
                            </TableCell>
                        </TableRow>
                    )})}
                    {payableEvents.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={8} className="text-center text-muted-foreground">
                                No hamali transactions with payable amounts found.
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
                <TableFooter>
                    <TableRow>
                        <TableCell colSpan={5} className="text-right font-bold">Totals</TableCell>
                        <TableCell className="text-right font-mono font-bold">{formatCurrency(totalCustomerCharge)}</TableCell>
                        <TableCell className="text-right font-mono font-bold">{formatCurrency(totalWorkerPayable)}</TableCell>
                        <TableCell className={`text-right font-mono font-bold ${totalDifference >= 0 ? 'text-green-600' : 'text-destructive'}`}>{formatCurrency(totalDifference)}</TableCell>
                    </TableRow>
                </TableFooter>
            </Table>
        </div>
    );
}
