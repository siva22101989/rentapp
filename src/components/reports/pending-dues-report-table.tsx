
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
            <div className="mb-6 text-center border-b pb-4">
                <h2 className="text-xl font-bold text-primary tracking-tight uppercase leading-none">SRI LAKSHMI WAREHOUSE</h2>
                <p className="text-muted-foreground font-semibold text-base uppercase tracking-wider mt-1">{title}</p>
                <div className="flex justify-center gap-4 mt-1 text-[11px] text-slate-400">
                    <span>Generated: {generatedDate}</span>
                </div>
            </div>

            <Table className="text-[13px]">
                <TableHeader>
                    <TableRow className="bg-slate-50/80 hover:bg-slate-50/80 border-b-2">
                        <TableHead className="font-bold text-slate-900 py-3 uppercase text-[10px]">Customer Name</TableHead>
                        <TableHead className="text-right font-bold text-slate-900 py-3 uppercase text-[10px]">Hamali Pending</TableHead>
                        <TableHead className="text-right font-bold text-slate-900 py-3 uppercase text-[10px]">Rent Pending</TableHead>
                        <TableHead className="text-right font-bold text-slate-900 py-3 uppercase text-[10px]">Total Billed</TableHead>
                        <TableHead className="text-right font-bold text-slate-900 py-3 uppercase text-[10px]">Amount Paid</TableHead>
                        <TableHead className="text-right font-bold text-slate-900 py-3 uppercase text-[10px]">Balance Due</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {summaries.map((summary) => (
                        <TableRow key={summary.customerId} className="hover:bg-slate-50/50 border-b border-slate-100 h-8">
                            <TableCell className="font-bold text-slate-800 p-1">{summary.customerName}</TableCell>
                            <TableCell className="text-right font-mono text-orange-600 font-medium p-1">{formatCurrency(summary.hamaliPending)}</TableCell>
                            <TableCell className="text-right font-mono text-blue-600 font-medium p-1">{formatCurrency(summary.rentPending)}</TableCell>
                            <TableCell className="text-right font-mono text-slate-600 p-1">{formatCurrency(summary.totalBilled)}</TableCell>
                            <TableCell className="text-right font-mono text-green-600 p-1">{formatCurrency(summary.amountPaid)}</TableCell>
                            <TableCell className="text-right font-mono font-black text-destructive p-1">{formatCurrency(summary.balanceDue)}</TableCell>
                        </TableRow>
                    ))}
                     {summaries.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={6} className="text-center text-muted-foreground py-10 italic">
                                No pending dues found.
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
                <TableFooter>
                    <TableRow className="bg-slate-900 text-white hover:bg-slate-900 border-t-2 border-slate-900 font-black">
                        <TableCell className="p-3 uppercase text-[10px] tracking-tight">Grand Total Portfolio</TableCell>
                        <TableCell className="text-right font-mono text-orange-200">{formatCurrency(totals.hamali)}</TableCell>
                        <TableCell className="text-right font-mono text-blue-200">{formatCurrency(totals.rent)}</TableCell>
                        <TableCell className="text-right font-mono text-slate-300">{formatCurrency(totals.billed)}</TableCell>
                        <TableCell className="text-right font-mono text-green-300">{formatCurrency(totals.paid)}</TableCell>
                        <TableCell className="text-right text-white font-mono text-[14px]">{formatCurrency(totals.total)}</TableCell>
                    </TableRow>
                </TableFooter>
            </Table>
            
            <div className="mt-16 pt-8 flex flex-col items-end text-center space-y-2">
                <div className="w-72 border-t border-slate-400 pt-4">
                    <p className="text-[#1e293b] font-bold text-[12px] uppercase tracking-wider">AUTHORIZED MANAGER SIGNATURE</p>
                </div>
            </div>
        </div>
    );
}
