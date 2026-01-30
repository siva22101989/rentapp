'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { format } from "date-fns";
import type { Customer, StorageRecord, Outflow } from "@/lib/definitions";
import { toDate, formatCurrency } from '@/lib/utils';
import { useMemo } from "react";

export type OutflowEvent = Outflow & {
    customerId: string;
    recordId: string;
    commodityDescription: string;
    location?: string;
    date: Date;
};

type ReportTableProps = {
    events: OutflowEvent[];
    customers: Customer[];
    title: string;
}

export function OutflowReportTable({ events, customers, title }: ReportTableProps) {
    const generatedDate = useMemo(() => format(new Date(), 'dd MMM yyyy, hh:mm a'), []);

    const getCustomerName = (customerId: string) => {
        return customers.find(c => c.id === customerId)?.name ?? 'Unknown';
    }

    const totalBagsWithdrawn = events.reduce((acc, event) => acc + (event.bagsWithdrawn || 0), 0);
    const totalRentBilled = events.reduce((acc, event) => acc + (event.rentBilled || 0), 0);

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
                        <TableHead>Serial No</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Commodity</TableHead>
                        <TableHead>Lot No</TableHead>
                        <TableHead className="text-right">Bags Withdrawn</TableHead>
                        <TableHead className="text-right">Rent Billed</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {events.map((event, index) => (
                        <TableRow key={index}>
                            <TableCell>{format(toDate(event.date), 'dd MMM yyyy')}</TableCell>
                            <TableCell>{event.recordId}</TableCell>
                            <TableCell className="font-medium">{getCustomerName(event.customerId)}</TableCell>
                            <TableCell>{event.commodityDescription}</TableCell>
                            <TableCell>{event.location}</TableCell>
                            <TableCell className="text-right font-mono">{event.bagsWithdrawn}</TableCell>
                            <TableCell className="text-right font-mono">{formatCurrency(event.rentBilled)}</TableCell>
                        </TableRow>
                    ))}
                    {events.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={7} className="text-center text-muted-foreground">
                                No outflow records found for the selected criteria.
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
                <TableFooter>
                    <TableRow>
                        <TableCell colSpan={5} className="text-right font-bold">Totals</TableCell>
                        <TableCell className="text-right font-mono font-bold">{totalBagsWithdrawn}</TableCell>
                        <TableCell className="text-right font-mono font-bold">{formatCurrency(totalRentBilled)}</TableCell>
                    </TableRow>
                </TableFooter>
            </Table>
        </div>
    );
}
