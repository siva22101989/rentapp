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
        <div className="bg-white p-6 rounded-xl border shadow-sm print:shadow-none print:border-none">
            <div className="mb-8 text-center border-b pb-6">
                <h2 className="text-2xl font-bold text-primary tracking-tight">Sri Lakshmi Warehouse</h2>
                <p className="text-muted-foreground font-semibold text-lg uppercase tracking-wider mt-1">{title}</p>
                <div className="flex justify-center gap-4 mt-2 text-xs text-muted-foreground">
                    <span>Generated: {generatedDate}</span>
                </div>
            </div>

            <Table>
                <TableHeader>
                    <TableRow className="bg-slate-50/80 hover:bg-slate-50/80 border-b-2">
                        <TableHead className="font-bold text-slate-900 py-4">Customer Name</TableHead>
                        <TableHead className="text-right font-bold text-slate-900 py-4">Hamali Pending</TableHead>
                        <TableHead className="text-right font-bold text-slate-900 py-4">Rent Pending</TableHead>
                        <TableHead className="text-right font-bold text-slate-900 py-4">Total Billed</TableHead>
                        <TableHead className="text-right font-bold text-slate-900 py-4">Amount Paid</TableHead>
                        <TableHead className="text-right font-bold text-slate-900 py-4">Balance Due</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {summaries.map((summary) => (
                        <TableRow key={summary.customerId} className="hover:bg-slate-50/50 border-b border-slate-100">
                            <TableCell className="font-bold text-slate-800 py-3">{summary.customerName}</TableCell>
                            <TableCell className="text-right font-mono text-orange-600 font-medium">{formatCurrency(summary.hamaliPending)}</TableCell>
                            <TableCell className="text-right font-mono text-blue-600 font-medium">{formatCurrency(summary.rentPending)}</TableCell>
                            <TableCell className="text-right font-mono text-slate-600">{formatCurrency(summary.totalBilled)}</TableCell>
                            <TableCell className="text-right font-mono text-green-600">{formatCurrency(summary.amountPaid)}</TableCell>
                            <TableCell className="text-right font-mono font-bold text-destructive text-base">{formatCurrency(summary.balanceDue)}</TableCell>
                        </TableRow>
                    ))}
                     {summaries.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={6} className="text-center text-muted-foreground py-20 italic">
                                All customer accounts are currently settled. No pending dues found.
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
                <TableFooter>
                    <TableRow className="bg-slate-900 text-white hover:bg-slate-900 border-t-2 border-slate-900">
                        <TableCell className="font-bold text-base py-4">Grand Total Portfolio</TableCell>
                        <TableCell className="text-right font-mono font-bold text-orange-200 py-4">{formatCurrency(totals.hamali)}</TableCell>
                        <TableCell className="text-right font-mono font-bold text-blue-200 py-4">{formatCurrency(totals.rent)}</TableCell>
                        <TableCell className="text-right font-mono font-bold text-slate-300 py-4">{formatCurrency(totals.billed)}</TableCell>
                        <TableCell className="text-right font-mono font-bold text-green-300 py-4">{formatCurrency(totals.paid)}</TableCell>
                        <TableCell className="text-right font-bold text-white font-mono text-xl py-4">{formatCurrency(totals.total)}</TableCell>
                    </TableRow>
                </TableFooter>
            </Table>
            
            <div className="mt-16 pt-8 flex flex-col items-center text-center space-y-2">
                <div className="w-64 border-t border-slate-300 pt-4">
                    <p className="text-[#1e293b] font-bold text-sm uppercase tracking-wider">Authorized Manager Signature</p>
                    <p className="text-primary font-bold text-xs uppercase mt-1">Sri Lakshmi Warehouse</p>
                </div>
                <p className="text-[10px] text-slate-400 mt-2">Report validity verified on {generatedDate}</p>
            </div>
        </div>
    );
}