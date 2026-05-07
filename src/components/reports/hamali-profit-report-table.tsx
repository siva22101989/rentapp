
'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { format } from "date-fns";
import type { Customer } from "@/lib/definitions";
import { formatCurrency } from '@/lib/utils';
import { useMemo } from "react";
import type { WorkerHamaliEvent } from "./hamali-report";

export function HamaliProfitReportTable({ events, customers, title }: { events: WorkerHamaliEvent[], customers: Customer[], title: string }) {
    const generatedDate = useMemo(() => format(new Date(), 'dd MMM yyyy, hh:mm a'), []);
    const getCustomerName = (id?: string) => id ? (customers.find(c => c.id === id)?.name ?? 'Unknown') : '';

    const payableEvents = useMemo(() => events.filter(e => e.payable > 0 || e.charge > 0), [events]);
    const totalCharge = payableEvents.reduce((acc, e) => acc + e.charge, 0);
    const totalPayable = payableEvents.reduce((acc, e) => acc + e.payable, 0);
    const totalDiff = totalCharge - totalPayable;

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
                        <TableHead>Patti No</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead className="text-right">Bags</TableHead>
                        <TableHead className="text-right">Cust. Rate</TableHead>
                        <TableHead className="text-right">Cust. Total</TableHead>
                        <TableHead className="text-right">Work. Rate</TableHead>
                        <TableHead className="text-right">Work. Total</TableHead>
                        <TableHead className="text-right font-bold">Difference</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {payableEvents.map((e, index) => {
                        const diff = e.charge - e.payable;
                        return (
                        <TableRow key={index}>
                            <TableCell>{format(e.date, 'dd/MM/yy')}</TableCell>
                            <TableCell className="font-mono">{e.recordId}</TableCell>
                            <TableCell className="font-medium whitespace-nowrap">{getCustomerName(e.customerId)}</TableCell>
                            <TableCell className="text-right font-mono">{e.bags}</TableCell>
                            <TableCell className="text-right font-mono">{e.customerRate?.toFixed(2)}</TableCell>
                            <TableCell className="text-right font-mono">{formatCurrency(e.charge)}</TableCell>
                            <TableCell className="text-right font-mono">{e.workerRate?.toFixed(2)}</TableCell>
                            <TableCell className="text-right font-mono">{formatCurrency(e.payable)}</TableCell>
                            <TableCell className={`text-right font-mono font-bold ${diff >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                                {formatCurrency(diff)}
                            </TableCell>
                        </TableRow>
                    )})}
                </TableBody>
                <TableFooter>
                    <TableRow className="bg-muted/50 font-bold">
                        <TableCell colSpan={5} className="text-right">Grand Totals</TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(totalCharge)}</TableCell>
                        <TableCell className="text-right font-mono" />
                        <TableCell className="text-right font-mono">{formatCurrency(totalPayable)}</TableCell>
                        <TableCell className={`text-right font-mono text-lg ${totalDiff >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                            {formatCurrency(totalDiff)}
                        </TableCell>
                    </TableRow>
                </TableFooter>
            </Table>
        </div>
    );
}
