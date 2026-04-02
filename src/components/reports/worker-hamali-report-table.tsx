
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

export function WorkerHamaliReportTable({ events, customers, title }: ReportTableProps) {
    const generatedDate = useMemo(() => format(new Date(), 'dd MMM yyyy, hh:mm a'), []);
    
    const getCustomerName = (customerId?: string) => {
        if (!customerId) return '';
        return customers.find(c => c.id === customerId)?.name ?? 'Unknown';
    }

    const totalPayable = events.reduce((acc, event) => acc + event.payable, 0);
    const totalPaid = events.reduce((acc, event) => acc + event.paid, 0);
    const balance = totalPayable - totalPaid;

    return (
        <div className="bg-white p-4 rounded-lg">
             <div className="mb-4">
                <h2 className="text-xl font-bold">Srilakshmi Warehouse</h2>
                <p className="text-muted-foreground">{title}</p>
                <p className="text-xs text-muted-foreground">Generated on: {generatedDate}</p>
            </div>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead className="hidden sm:table-cell">Customer</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="hidden md:table-cell">Reference ID</TableHead>
                        <TableHead className="text-center hidden lg:table-cell">Bags</TableHead>
                        <TableHead className="text-right">Payable</TableHead>
                        <TableHead className="text-right">Paid</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {events.map((event, index) => (
                        <TableRow key={index}>
                            <TableCell>{format(event.date, 'dd MMM yyyy')}</TableCell>
                            <TableCell className="font-medium hidden sm:table-cell">{getCustomerName(event.customerId)}</TableCell>
                            <TableCell>{event.description}</TableCell>
                            <TableCell className="hidden md:table-cell">{event.recordId}</TableCell>
                            <TableCell className="text-center font-mono hidden lg:table-cell">{event.bags || ''}</TableCell>
                            <TableCell className="text-right font-mono">
                                {event.payable > 0 ? formatCurrency(event.payable) : ''}
                            </TableCell>
                            <TableCell className="text-right font-mono text-green-600">
                                 {event.paid > 0 ? formatCurrency(event.paid) : ''}
                            </TableCell>
                        </TableRow>
                    ))}
                    {events.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={7} className="text-center text-muted-foreground">
                                No worker hamali transactions found for the selected criteria.
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
                <TableFooter>
                    <TableRow>
                        <TableCell colSpan={2} className="text-right font-bold sm:hidden">Totals</TableCell>
                        <TableCell colSpan={5} className="text-right font-bold hidden sm:table-cell">Totals</TableCell>
                        <TableCell className="text-right font-mono font-bold">{formatCurrency(totalPayable)}</TableCell>
                        <TableCell className="text-right font-mono font-bold text-green-600">{formatCurrency(totalPaid)}</TableCell>
                    </TableRow>
                     <TableRow>
                        <TableCell colSpan={2} className="text-right font-bold sm:hidden">Balance</TableCell>
                        <TableCell colSpan={6} className="text-right font-bold hidden sm:table-cell">Pending Balance</TableCell>
                        <TableCell className="text-right font-mono font-bold text-destructive">{formatCurrency(balance)}</TableCell>
                    </TableRow>
                </TableFooter>
            </Table>
        </div>
    );
}
