'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { format } from "date-fns";
import type { Customer, WarehouseInfo } from "@/lib/definitions";
import { formatCurrency } from '@/lib/utils';
import { useMemo } from "react";
import type { CustomerHamaliEvent, WorkerHamaliEvent } from "./hamali-report";

type ReportTableProps = {
    customerEvents: CustomerHamaliEvent[];
    workerEvents: WorkerHamaliEvent[];
    customers: Customer[];
    title: string;
    view: 'customer' | 'worker' | 'difference';
    warehouseInfo: WarehouseInfo | null;
}

export function HamaliLedgerTable({ customerEvents, workerEvents, customers, title, view, warehouseInfo }: ReportTableProps) {
    const generatedDate = useMemo(() => format(new Date(), 'dd MMM yyyy, hh:mm a'), []);

    const getCustomerName = (customerId?: string) => {
        if (!customerId) return '';
        return customers.find(c => c.id === customerId)?.name ?? 'Unknown';
    }

    if (view === 'customer') {
        const totalCharges = customerEvents.filter(e => e.type === 'charge').reduce((acc, event) => acc + event.amount, 0);
        const totalPayments = customerEvents.filter(e => e.type === 'payment').reduce((acc, event) => acc + event.amount, 0);
        return (
            <div className="bg-white p-4 rounded-lg">
                 <div className="mb-4">
                    <h2 className="text-xl font-bold">{warehouseInfo?.name || "GrainDost"}</h2>
                    <p className="text-muted-foreground">{title}</p>
                    <p className="text-xs text-muted-foreground">Generated on: {generatedDate}</p>
                </div>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Customer</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead>Reference ID</TableHead>
                            <TableHead className="text-center">Bags</TableHead>
                            <TableHead className="text-right">Charge</TableHead>
                            <TableHead className="text-right">Payment</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {customerEvents.map((event, index) => (
                            <TableRow key={index}>
                                <TableCell>{format(event.date, 'dd MMM yyyy')}</TableCell>
                                <TableCell className="font-medium">{getCustomerName(event.customerId)}</TableCell>
                                <TableCell>{event.description}</TableCell>
                                <TableCell>{event.recordId}</TableCell>
                                <TableCell className="text-center">{event.bags || ''}</TableCell>
                                <TableCell className="text-right font-mono">
                                    {event.type === 'charge' ? formatCurrency(event.amount) : ''}
                                </TableCell>
                                <TableCell className="text-right font-mono text-green-600">
                                    {event.type === 'payment' ? formatCurrency(event.amount) : ''}
                                </TableCell>
                            </TableRow>
                        ))}
                        {customerEvents.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center text-muted-foreground">
                                    No hamali transactions found for the selected criteria.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                    <TableFooter>
                        <TableRow>
                            <TableCell colSpan={5} className="text-right font-bold">Totals</TableCell>
                            <TableCell className="text-right font-mono font-bold">{formatCurrency(totalCharges)}</TableCell>
                            <TableCell className="text-right font-mono font-bold text-green-600">{formatCurrency(totalPayments)}</TableCell>
                        </TableRow>
                         <TableRow>
                            <TableCell colSpan={6} className="text-right font-bold">Pending Hamali</TableCell>
                            <TableCell className="text-right font-mono font-bold text-destructive">{formatCurrency(totalCharges - totalPayments)}</TableCell>
                        </TableRow>
                    </TableFooter>
                </Table>
            </div>
        );
    }

    // For worker and difference views
    const totalPayable = workerEvents.reduce((acc, event) => acc + event.payable, 0);
    const totalPaid = workerEvents.reduce((acc, event) => acc + event.paid, 0);
    const totalCharge = workerEvents.reduce((acc, event) => acc + (event.charge || 0), 0);
    const totalDifference = totalCharge - totalPayable;
    const balance = totalPayable - totalPaid;

    return (
        <div className="bg-white p-4 rounded-lg">
             <div className="mb-4">
                <h2 className="text-xl font-bold">{warehouseInfo?.name || "GrainDost"}</h2>
                <p className="text-muted-foreground">{title}</p>
                <p className="text-xs text-muted-foreground">Generated on: {generatedDate}</p>
            </div>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Date</TableHead>
                        {view === 'worker' && <TableHead>Customer</TableHead>}
                        <TableHead>Description</TableHead>
                        <TableHead>Ref ID</TableHead>
                        <TableHead className="text-center">Bags</TableHead>
                        <TableHead className="text-right">Cust. Charge</TableHead>
                        <TableHead className="text-right">Worker Payable</TableHead>
                        <TableHead className="text-right">Difference</TableHead>
                        {view === 'worker' && <TableHead className="text-right">Paid</TableHead>}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {workerEvents.map((event, index) => (
                        <TableRow key={index}>
                            <TableCell>{format(event.date, 'dd MMM yyyy')}</TableCell>
                            {view === 'worker' && <TableCell className="font-medium">{event.paid > 0 ? 'Payment' : getCustomerName(event.customerId)}</TableCell>}
                            <TableCell>{event.paid > 0 ? 'Payment for Hamali done' : event.description}</TableCell>
                            <TableCell>{event.recordId}</TableCell>
                            <TableCell className="text-center font-mono">{event.bags || ''}</TableCell>
                            <TableCell className="text-right font-mono">
                                {event.charge ? formatCurrency(event.charge) : ''}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                                {event.payable > 0 ? formatCurrency(event.payable) : ''}
                            </TableCell>
                            <TableCell className="text-right font-mono font-bold">
                                {event.charge && event.payable ? formatCurrency(event.charge - event.payable) : ''}
                            </TableCell>
                             {view === 'worker' && <TableCell className="text-right font-mono text-green-600">
                                 {event.paid > 0 ? formatCurrency(event.paid) : ''}
                            </TableCell>}
                        </TableRow>
                    ))}
                    {workerEvents.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={view === 'worker' ? 9 : 8} className="text-center text-muted-foreground">
                                No worker hamali transactions found for the selected criteria.
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
                <TableFooter>
                    <TableRow>
                        <TableCell colSpan={view === 'worker' ? 5 : 4} className="text-right font-bold">Totals</TableCell>
                        <TableCell className="text-right font-mono font-bold">{formatCurrency(totalCharge)}</TableCell>
                        <TableCell className="text-right font-mono font-bold">{formatCurrency(totalPayable)}</TableCell>
                        <TableCell className="text-right font-mono font-bold">{formatCurrency(totalDifference)}</TableCell>
                        {view === 'worker' && <TableCell className="text-right font-mono font-bold text-green-600">{formatCurrency(totalPaid)}</TableCell>}
                    </TableRow>
                    {view === 'worker' && (
                        <TableRow>
                            <TableCell colSpan={8} className="text-right font-bold">Pending Balance to Worker</TableCell>
                            <TableCell className="text-right font-mono font-bold text-destructive">{formatCurrency(balance)}</TableCell>
                        </TableRow>
                    )}
                </TableFooter>
            </Table>
        </div>
    );
}
