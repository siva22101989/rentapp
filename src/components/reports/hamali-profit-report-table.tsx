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

    // Filter for events that represent a labor transaction (charges/payables)
    const payableEvents = useMemo(() => events.filter(e => e.payable > 0 || (e.charge && e.charge > 0)), [events]);

    const totalCustomerCharge = payableEvents.reduce((acc, event) => acc + (event.charge || event.payable), 0);
    const totalWorkerPayable = payableEvents.reduce((acc, event) => acc + event.payable, 0);
    const totalDifference = totalCustomerCharge - totalWorkerPayable;

    return (
        <div className="bg-white p-4 rounded-lg">
             <div className="mb-4 text-center">
                <h2 className="text-xl font-bold">GrainDost</h2>
                <p className="text-muted-foreground font-semibold">{title}</p>
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
                        <TableHead className="text-right">Difference (P/L)</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {payableEvents.map((event, index) => {
                        const customerCharge = event.charge || event.payable;
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
                            <TableCell className={`text-right font-mono font-bold ${difference > 0 ? 'text-green-600' : difference < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                                {formatCurrency(difference)}
                            </TableCell>
                        </TableRow>
                    )})}
                    {payableEvents.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                                No hamali transactions found for the selected period.
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
                <TableFooter>
                    <TableRow className="bg-secondary/50">
                        <TableCell colSpan={5} className="text-right font-bold">Totals</TableCell>
                        <TableCell className="text-right font-mono font-bold">{formatCurrency(totalCustomerCharge)}</TableCell>
                        <TableCell className="text-right font-mono font-bold">{formatCurrency(totalWorkerPayable)}</TableCell>
                        <TableCell className={`text-right font-mono font-bold ${totalDifference >= 0 ? 'text-green-600' : 'text-destructive'}`}>{formatCurrency(totalDifference)}</TableCell>
                    </TableRow>
                </TableFooter>
            </Table>
            <div className="mt-4 p-3 bg-secondary/20 rounded-md text-xs text-muted-foreground">
                <p><strong>Note:</strong> Difference = (Amount charged to Customer) - (Amount payable to Workers).</p>
            </div>
        </div>
    );
}