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
            <div className="mb-4 text-center">
                <h2 className="text-xl font-bold">GrainDost</h2>
                <p className="text-muted-foreground font-semibold">{title}</p>
                <p className="text-xs text-muted-foreground">Generated on: {generatedDate}</p>
            </div>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Customer Name</TableHead>
                        <TableHead className="text-right">Hamali Pending</TableHead>
                        <TableHead className="text-right">Rent Pending</TableHead>
                        <TableHead className="text-right">Total Billed</TableHead>
                        <TableHead className="text-right">Amount Paid</TableHead>
                        <TableHead className="text-right font-bold">Balance Due</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {summaries.map((summary) => (
                        <TableRow key={summary.customerId}>
                            <TableCell className="font-medium">{summary.customerName}</TableCell>
                            <TableCell className="text-right font-mono text-orange-600">{formatCurrency(summary.hamaliPending)}</TableCell>
                            <TableCell className="text-right font-mono text-blue-600">{formatCurrency(summary.rentPending)}</TableCell>
                            <TableCell className="text-right font-mono">{formatCurrency(summary.totalBilled)}</TableCell>
                            <TableCell className="text-right font-mono text-green-600">{formatCurrency(summary.amountPaid)}</TableCell>
                            <TableCell className="text-right font-mono font-bold text-destructive">{formatCurrency(summary.balanceDue)}</TableCell>
                        </TableRow>
                    ))}
                     {summaries.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                                No pending dues found.
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
                <TableFooter>
                    <TableRow className="bg-secondary/50">
                        <TableCell className="text-right font-bold">Total Portfolio Dues</TableCell>
                        <TableCell className="text-right font-mono font-bold text-orange-600">{formatCurrency(totals.hamali)}</TableCell>
                        <TableCell className="text-right font-mono font-bold text-blue-600">{formatCurrency(totals.rent)}</TableCell>
                        <TableCell className="text-right font-mono font-bold">{formatCurrency(totals.billed)}</TableCell>
                        <TableCell className="text-right font-mono font-bold text-green-600">{formatCurrency(totals.paid)}</TableCell>
                        <TableCell className="text-right font-bold text-destructive font-mono text-lg">{formatCurrency(totals.total)}</TableCell>
                    </TableRow>
                </TableFooter>
            </Table>
            <p className="text-[10px] text-muted-foreground mt-4 italic print-hide">
                * This report consolidates all active records for each customer. Lifetime billed vs lifetime paid.
            </p>
        </div>
    );
}
