
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
    const safeEvents = events || [];

    const getCustomerName = (customerId?: string) => {
        if (!customerId) return '';
        return customers.find(c => c.id === customerId)?.name ?? 'Unknown';
    }

    const totalCharges = safeEvents.filter(e => e.type === 'charge').reduce((acc, event) => acc + event.amount, 0);
    const totalPayments = safeEvents.filter(e => e.type === 'payment').reduce((acc, event) => acc + event.amount, 0);
    const totalDifference = safeEvents.filter(e => e.type === 'charge').reduce((acc, event) => acc + (event.difference || 0), 0);
    
    return (
        <div className="bg-white p-4 rounded-lg">
             <div className="mb-4 text-center">
                <h2 className="text-xl font-bold">{warehouseInfo?.name || "Sri Lakshmi Warehouse"}</h2>
                <p className="text-muted-foreground font-semibold">{title}</p>
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
                        <TableHead className="text-right">Cust. Charge</TableHead>
                        <TableHead className="text-right">Profit/Loss</TableHead>
                        <TableHead className="text-right">Payment</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {safeEvents.map((event, index) => (
                        <TableRow key={index}>
                            <TableCell>{format(event.date, 'dd MMM yyyy')}</TableCell>
                            <TableCell className="font-medium">{getCustomerName(event.customerId)}</TableCell>
                            <TableCell>{event.description}</TableCell>
                            <TableCell>{event.recordId}</TableCell>
                            <TableCell className="text-center font-mono">{event.bags || ''}</TableCell>
                            <TableCell className="text-right font-mono">
                                {event.type === 'charge' ? formatCurrency(event.amount) : ''}
                            </TableCell>
                            <TableCell className={`text-right font-mono font-semibold ${event.difference && event.difference > 0 ? 'text-green-600' : event.difference && event.difference < 0 ? 'text-destructive' : ''}`}>
                                {event.type === 'charge' && event.difference !== undefined ? formatCurrency(event.difference) : ''}
                            </TableCell>
                            <TableCell className="text-right font-mono text-green-600">
                                {event.type === 'payment' ? formatCurrency(event.amount) : ''}
                            </TableCell>
                        </TableRow>
                    ))}
                    {safeEvents.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                                No hamali transactions found for the selected criteria.
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
                <TableFooter>
                    <TableRow className="bg-secondary/50">
                        <TableCell colSpan={5} className="text-right font-bold">Totals</TableCell>
                        <TableCell className="text-right font-mono font-bold">{formatCurrency(totalCharges)}</TableCell>
                        <TableCell className="text-right font-mono font-bold text-primary">{formatCurrency(totalDifference)}</TableCell>
                        <TableCell className="text-right font-mono font-bold text-green-600">{formatCurrency(totalPayments)}</TableCell>
                    </TableRow>
                     <TableRow>
                        <TableCell colSpan={7} className="text-right font-bold text-lg">Balance Pending from Customers</TableCell>
                        <TableCell className="text-right font-mono font-bold text-lg text-destructive">{formatCurrency(totalCharges - totalPayments)}</TableCell>
                    </TableRow>
                </TableFooter>
            </Table>
        </div>
    );
}
