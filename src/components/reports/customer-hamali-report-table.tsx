'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { format } from "date-fns";
import type { Customer, WarehouseInfo } from "@/lib/definitions";
import { formatCurrency } from '@/lib/utils';
import { useMemo } from "react";
import type { CustomerHamaliEvent } from "./hamali-report";

export function CustomerHamaliReportTable({ events, customers, title, warehouseInfo }: { events: CustomerHamaliEvent[], customers: Customer[], title: string, warehouseInfo: WarehouseInfo | null }) {
    const generatedDate = useMemo(() => format(new Date(), 'dd MMM yyyy, hh:mm a'), []);
    const getCustomerName = (id: string) => customers.find(c => c.id === id)?.name ?? 'Unknown';

    const totalCharges = events.filter(e => e.type === 'charge').reduce((acc, e) => acc + e.amount, 0);
    const totalPayments = events.filter(e => e.type === 'payment').reduce((acc, e) => acc + e.amount, 0);
    
    return (
        <div className="bg-white p-4 rounded-lg">
             <div className="mb-4 text-center">
                <h2 className="text-xl font-bold">{warehouseInfo?.name || "GrainDost"}</h2>
                <p className="text-lg font-semibold">{title}</p>
                <p className="text-xs text-muted-foreground">Generated: {generatedDate}</p>
            </div>
            <Table className="text-xs">
                <TableHeader>
                    <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Patti No</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Particulars</TableHead>
                        <TableHead className="text-right">Bags</TableHead>
                        <TableHead className="text-right">Rate</TableHead>
                        <TableHead className="text-right">Charge (Dr)</TableHead>
                        <TableHead className="text-right">Payment (Cr)</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {events.map((event, index) => (
                        <TableRow key={index}>
                            <TableCell>{format(event.date, 'dd/MM/yy')}</TableCell>
                            <TableCell className="font-mono">{event.recordId}</TableCell>
                            <TableCell className="font-medium whitespace-nowrap">{getCustomerName(event.customerId)}</TableCell>
                            <TableCell>{event.description}</TableCell>
                            <TableCell className="text-right font-mono">{event.bags || ''}</TableCell>
                            <TableCell className="text-right font-mono">{event.rate ? event.rate.toFixed(2) : ''}</TableCell>
                            <TableCell className="text-right font-mono text-destructive">
                                {event.type === 'charge' ? formatCurrency(event.amount) : ''}
                            </TableCell>
                            <TableCell className="text-right font-mono text-green-600">
                                {event.type === 'payment' ? formatCurrency(event.amount) : ''}
                            </TableCell>
                        </TableRow>
                    ))}
                    {events.length === 0 && <TableRow><TableCell colSpan={8} className="text-center py-8">No records found.</TableCell></TableRow>}
                </TableBody>
                <TableFooter>
                    <TableRow>
                        <TableCell colSpan={6} className="text-right font-bold">Totals</TableCell>
                        <TableCell className="text-right font-mono font-bold text-destructive">{formatCurrency(totalCharges)}</TableCell>
                        <TableCell className="text-right font-mono font-bold text-green-600">{formatCurrency(totalPayments)}</TableCell>
                    </TableRow>
                     <TableRow className="bg-muted/30">
                        <TableCell colSpan={7} className="text-right font-bold">Balance Pending from Customer</TableCell>
                        <TableCell className="text-right font-mono font-bold text-destructive text-lg">{formatCurrency(totalCharges - totalPayments)}</TableCell>
                    </TableRow>
                </TableFooter>
            </Table>
        </div>
    );
}