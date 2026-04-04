
'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { format } from "date-fns";
import type { Customer } from "@/lib/definitions";
import { formatCurrency, toDate } from '@/lib/utils';
import { useMemo } from "react";
import { Badge } from "../ui/badge";

export type PaymentEvent = {
    date: Date;
    customerId: string;
    description: string;
    recordId: string;
    amount: number;
    type: 'rent' | 'hamali' | 'other' | 'unloading';
};

type ReportTableProps = {
    events: PaymentEvent[];
    customers: Customer[];
    title: string;
}

export function PaymentReportTable({ events, customers, title }: ReportTableProps) {
    const generatedDate = useMemo(() => format(new Date(), 'dd MMM yyyy, hh:mm a'), []);

    const getCustomerName = (customerId: string) => {
        return customers.find(c => c.id === customerId)?.name ?? 'Unknown';
    }

    const totalPayments = events.reduce((acc, event) => acc + event.amount, 0);
    
    const getTypeBadge = (type: PaymentEvent['type']) => {
        switch(type) {
            case 'rent': return <Badge variant="default" className="bg-blue-100 text-blue-800">Rent</Badge>;
            case 'hamali': return <Badge variant="default" className="bg-orange-100 text-orange-800">Storage Hamali</Badge>;
            case 'unloading': return <Badge variant="default" className="bg-yellow-100 text-yellow-800">Unloading Hamali</Badge>;
            default: return <Badge variant="secondary">Other</Badge>;
        }
    }

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
                        <TableHead className="hidden sm:table-cell">Type</TableHead>
                        <TableHead className="hidden md:table-cell">Description</TableHead>
                        <TableHead className="hidden lg:table-cell">Reference ID</TableHead>
                        <TableHead className="text-right">Amount Paid</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {events.map((event, index) => (
                        <TableRow key={index}>
                            <TableCell>{format(event.date, 'dd MMM yyyy')}</TableCell>
                            <TableCell className="font-medium">{getCustomerName(event.customerId)}</TableCell>
                            <TableCell className="hidden sm:table-cell">{getTypeBadge(event.type)}</TableCell>
                            <TableCell className="hidden md:table-cell">{event.description}</TableCell>
                            <TableCell className="hidden lg:table-cell">{event.recordId}</TableCell>
                            <TableCell className="text-right font-mono text-green-600">
                                {formatCurrency(event.amount)}
                            </TableCell>
                        </TableRow>
                    ))}
                    {events.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={6} className="text-center text-muted-foreground">
                                No payments found for the selected criteria.
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
                <TableFooter>
                    <TableRow>
                        <TableCell colSpan={2} className="text-right font-bold sm:hidden">Total</TableCell>
                        <TableCell colSpan={3} className="text-right font-bold hidden sm:table-cell md:hidden">Total</TableCell>
                        <TableCell colSpan={4} className="text-right font-bold hidden md:table-cell lg:hidden">Total</TableCell>
                        <TableCell colSpan={5} className="text-right font-bold hidden lg:table-cell">Total Payments</TableCell>
                        <TableCell className="text-right font-mono font-bold text-green-600">{formatCurrency(totalPayments)}</TableCell>
                    </TableRow>
                </TableFooter>
            </Table>
        </div>
    );
}
