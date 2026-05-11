
'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { format } from "date-fns";
import { formatCurrency } from '@/lib/utils';
import { useMemo } from "react";
import type { CustomerPendingSummary } from "../payments/pending-payments-table";

type ReportTableProps = {
    summaries: CustomerPendingSummary[];
    title: string;
};

export function PendingDuesReportTable({ summaries, title }: ReportTableProps) {
    const generatedDate = useMemo(() => format(new Date(), 'dd MMM yyyy, hh:mm a'), []);

    const totals = useMemo(() => {
        return summaries.reduce((acc, s) => {
            acc.billed += s.totalBilled;
            acc.paid += s.amountPaid;
            acc.hamali += s.hamaliPending;
            acc.rent += s.rentPending;
            acc.total += s.balanceDue;
            return acc;
        }, { billed: 0, paid: 0, hamali: 0, rent: 0, total: 0 });
    }, [summaries]);

    return (
        <div className="bg-white p-4 rounded-lg">
            <div className="mb-6 text-center">
                <h2 className="text-2xl font-bold">GrainDost</h2>
                <p className="text-muted-foreground font-semibold text-lg">{title}</p>
                <p className="text-xs text-muted-foreground">Generated on: {generatedDate}</p>
            </div>
            <Table>
                <TableHeader>
                    <TableRow className="bg-muted/50">
                        <TableHead className="font-bold">Customer Name</TableHead>
                        <TableHead className="text-right font-bold">Hamali Pending</TableHead>
                        <TableHead className="text-right font-bold">Rent Pending</TableHead>
                        <TableHead className="text-right font-bold">Total Billed</TableHead>
                        <TableHead className="text-right font-bold">Amount Paid</TableHead>
                        <TableHead className="text-right font-bold">Balance Due</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {summaries.map((summary) => (
                        <TableRow key={summary.customerId} className="hover:bg-muted/30">
                            <TableCell className="font-semibold">{summary.customerName}</TableCell>
                            <TableCell className="text-right font-mono text-orange-600">{formatCurrency(summary.hamaliPending)}</TableCell>
                            <TableCell className="text-right font-mono text-blue-600">{formatCurrency(summary.rentPending)}</TableCell>
                            <TableCell className="text-right font-mono">{formatCurrency(summary.totalBilled)}</TableCell>
                            <TableCell className="text-right font-mono text-green-600">{formatCurrency(summary.amountPaid)}</TableCell>
                            <TableCell className="text-right font-mono font-bold text-destructive">{formatCurrency(summary.balanceDue)}</TableCell>
                        </TableRow>
                    ))}
                     {summaries.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={6} className="text-center text-muted-foreground py-12">
                                Great! No pending dues found at this time.
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
                <TableFooter>
                    <TableRow className="bg-secondary/50 border-t-2 border-primary/20">
                        <TableCell className="font-bold text-base">Grand Total Portfolio</TableCell>
                        <TableCell className="text-right font-mono font-bold text-orange-600">{formatCurrency(totals.hamali)}</TableCell>
                        <TableCell className="text-right font-mono font-bold text-blue-600">{formatCurrency(totals.rent)}</TableCell>
                        <TableCell className="text-right font-mono font-bold">{formatCurrency(totals.billed)}</TableCell>
                        <TableCell className="text-right font-mono font-bold text-green-600">{formatCurrency(totals.paid)}</TableCell>
                        <TableCell className="text-right font-bold text-destructive font-mono text-xl">{formatCurrency(totals.total)}</TableCell>
                    </TableRow>
                </TableFooter>
            </Table>
            <div className="mt-6 p-4 bg-muted/20 border border-dashed rounded-md text-[11px] text-muted-foreground italic">
                <p>* This report provide a consolidated financial summary per customer. Headings sequence: Customer Name, Hamali Pending, Rent Pending, Total Billed, Amount Paid, and Balance Due.</p>
            </div>
        </div>
    );
}
