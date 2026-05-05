'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { format } from "date-fns";
import type { Customer } from "@/lib/definitions";
import { formatCurrency } from '@/lib/utils';
import { useMemo } from "react";
import type { WorkerHamaliEvent } from "./hamali-report";

export function WorkerHamaliReportTable({ events, customers, title }: { events: WorkerHamaliEvent[], customers: Customer[], title: string }) {
    const generatedDate = useMemo(() => format(new Date(), 'dd MMM yyyy, hh:mm a'), []);
    const getCustomerName = (id?: string) => id ? (customers.find(c => c.id === id)?.name ?? 'Unknown') : '';

    const totalPayable = events.reduce((acc, e) => acc + e.payable, 0);
    const totalPaid = events.reduce((acc, e) => acc + e.paid, 0);
    
    return (
        <div className="bg-white p-4 rounded-lg">
             <div className="mb-4 text-center">
                <h2 className="text-xl font-bold">GrainDost</h2>
                <p className="text-lg font-semibold">{title}</p>
                <p className="text-xs text-muted-foreground">Generated: {generatedDate}</p>
            </div>
            <Table className="text-xs">
                <TableHeader>
                    <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Ref ID</TableHead>
                        <TableHead>Particulars</TableHead>
                        <TableHead className="text-right">Bags</TableHead>
                        <TableHead className="text-right">Worker Rate</TableHead>
                        <TableHead className="text-right">Payable (Cr)</TableHead>
                        <TableHead className="text-right">Paid (Dr)</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {events.map((event, index) => (
                        <TableRow key={index}>
                            <TableCell>{format(event.date, 'dd/MM/yy')}</TableCell>
                            <TableCell className="font-mono">{event.recordId}</TableCell>
                            <TableCell>
                                {event.description} {event.customerId ? `(${getCustomerName(event.customerId)})` : ''}
                            </TableCell>
                            <TableCell className="text-right font-mono">{event.bags || ''}</TableCell>
                            <TableCell className="text-right font-mono">{event.workerRate ? event.workerRate.toFixed(2) : ''}</TableCell>
                            <TableCell className="text-right font-mono text-green-600">
                                {event.payable > 0 ? formatCurrency(event.payable) : ''}
                            </TableCell>
                            <TableCell className="text-right font-mono text-destructive">
                                 {event.paid > 0 ? formatCurrency(event.paid) : ''}
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
                <TableFooter>
                    <TableRow>
                        <TableCell colSpan={5} className="text-right font-bold">Totals</TableCell>
                        <TableCell className="text-right font-mono font-bold text-green-600">{formatCurrency(totalPayable)}</TableCell>
                        <TableCell className="text-right font-mono font-bold text-destructive">{formatCurrency(totalPaid)}</TableCell>
                    </TableRow>
                     <TableRow className="bg-muted/30">
                        <TableCell colSpan={6} className="text-right font-bold">Pending Payable to Workers</TableCell>
                        <TableCell className="text-right font-mono font-bold text-destructive text-lg">{formatCurrency(totalPayable - totalPaid)}</TableCell>
                    </TableRow>
                </TableFooter>
            </Table>
        </div>
    );
}