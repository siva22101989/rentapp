
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
                <h2 className="text-2xl font-bold text-primary tracking-tight">GrainDost Warehouse</h2>
                <p className="text-muted-foreground font-semibold text-lg uppercase tracking-wider mt-1">{title}</p>
                <div className="flex justify-center gap-4 mt-2 text-xs text-muted-foreground">
                    <span>Generated: {generatedDate}</span>
                    <span className="hidden print:inline">•</span>
                    <span className="hidden print:inline">Status: Outstanding Balance Only</span>
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
            
            <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-8 print:mt-16">
                <div className="space-y-4 p-4 rounded-lg bg-slate-50 border border-slate-100">
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Accounting Notes</h4>
                    <ul className="text-[10px] text-slate-500 space-y-2 list-disc pl-4 italic leading-relaxed">
                        <li>This report represents consolidated outstanding balances per customer across all active and completed Storage IDs.</li>
                        <li>Handling/Hamali charges are calculated based on original truck/handling quantity to ensure billing accuracy regardless of weight loss.</li>
                        <li>Payments are applied using "First-In, First-Out" logic, clearing older records first.</li>
                        <li>Labor (Hamali) dues are prioritized for settlement before Rent allocations in bulk payments.</li>
                    </ul>
                </div>
                <div className="flex flex-col justify-end items-center text-center">
                    <div className="w-48 border-t border-slate-300 pt-2 font-bold text-xs text-slate-700 uppercase">Authorized Auditor Signature</div>
                    <p className="text-[9px] text-slate-400 mt-1">Report validity verified on {generatedDate}</p>
                </div>
            </div>
        </div>
    );
}
