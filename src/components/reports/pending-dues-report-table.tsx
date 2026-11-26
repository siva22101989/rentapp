
'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { format } from "date-fns";
import { formatCurrency } from '@/lib/utils';
import { useMemo } from "react";
import type { CustomerPendingSummary } from "../payments/pending-payments-table";
import type { Customer, StorageRecord, UnloadingRecord, CustomerPayment } from "@/lib/definitions";

type ReportTableProps = {
    summaries: CustomerPendingSummary[];
    title: string;
    customers: Customer[];
    storageRecords: StorageRecord[];
    unloadingRecords: UnloadingRecord[];
    customerPayments?: CustomerPayment[];
    isReport?: boolean;
};

export function PendingDuesReportTable({ summaries, title, customers, storageRecords, unloadingRecords, customerPayments = [], isReport = false }: ReportTableProps) {
    const generatedDate = useMemo(() => format(new Date(), 'dd MMM yyyy, hh:mm a'), []);

    const totals = useMemo(() => {
        return summaries.reduce((acc, s) => {
            acc.workerEarned += s.workerHamaliEarned;
            acc.hPending += s.customerHamaliPending;
            acc.rPending += s.rentPending;
            acc.total += s.totalBalance;
            return acc;
        }, { workerEarned: 0, hPending: 0, rPending: 0, total: 0 });
    }, [summaries]);

    return (
        <div className="bg-white p-6 rounded-xl border shadow-sm print:shadow-none print:border-none printable-area w-full mx-auto" style={{ width: '277mm' }}>
            <div className="mb-6 text-center border-b-2 border-black pb-4">
                <h2 className="text-2xl font-black text-primary tracking-tight uppercase leading-none text-center">SRI LAKSHMI WAREHOUSE</h2>
                <p className="text-muted-foreground font-black text-xs uppercase tracking-[0.2em] mt-2 text-center">{title}</p>
                <div className="flex justify-center gap-4 mt-2 text-[10px] text-slate-400 font-bold uppercase text-center">
                    <span>Audit Generation: {generatedDate}</span>
                </div>
            </div>

            <div className="table-scroll-container border-y-2 border-black">
                <Table className="text-[13px]">
                    <TableHeader>
                        <TableRow className="bg-slate-50 border-b-2 border-black hover:bg-slate-50">
                            <TableHead className="font-black text-black py-3 uppercase text-[10px] text-center border-r">Customer Name</TableHead>
                            <TableHead className="font-black text-slate-500 py-3 uppercase text-[10px] text-center border-r">Hamali Workers (Earned)</TableHead>
                            <TableHead className="font-black text-orange-700 py-3 uppercase text-[10px] text-center border-r">Cust. Hamali Due</TableHead>
                            <TableHead className="font-black text-blue-700 py-3 uppercase text-[10px] text-center border-r">Rent Pending</TableHead>
                            <TableHead className="font-black text-destructive py-3 uppercase text-[10px] text-center">Net Total Balance</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {summaries.map((summary) => {
                            return (
                                <TableRow key={summary.customerId} className="hover:bg-slate-50/50 border-b border-slate-100 h-10">
                                    <TableCell className="font-bold text-slate-900 p-2 text-center uppercase tracking-tight border-r">{summary.customerName}</TableCell>
                                    <TableCell className="text-right font-mono text-slate-500 p-2 text-center border-r italic">{formatCurrency(summary.workerHamaliEarned)}</TableCell>
                                    <TableCell className="text-right font-mono text-orange-600 font-bold p-2 text-center border-r">{formatCurrency(summary.customerHamaliPending)}</TableCell>
                                    <TableCell className="text-right font-mono text-blue-600 font-bold p-2 text-center border-r">{formatCurrency(summary.rentPending)}</TableCell>
                                    <TableCell className="text-right font-mono font-black text-destructive p-2 text-center bg-destructive/5">{formatCurrency(summary.totalBalance)}</TableCell>
                                </TableRow>
                            );
                        })}
                        {summaries.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center py-24 text-muted-foreground italic font-medium">
                                    No outstanding balances found in the Godown ledger.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                    <TableFooter>
                        <TableRow className="bg-slate-50 text-black border-t-2 border-black font-black h-14">
                            <TableCell className="p-3 uppercase text-[10px] tracking-widest text-center border-r">Grand Audit Totals</TableCell>
                            <TableCell className="text-center font-mono text-slate-400 border-r">{formatCurrency(totals.workerEarned)}</TableCell>
                            <TableCell className="text-center font-mono text-orange-600 text-lg border-r">{formatCurrency(totals.hPending)}</TableCell>
                            <TableCell className="text-center font-mono text-blue-600 text-lg border-r">{formatCurrency(totals.rPending)}</TableCell>
                            <TableCell className="text-center text-destructive font-mono text-xl underline underline-offset-4">{formatCurrency(totals.total)}</TableCell>
                        </TableRow>
                    </TableFooter>
                </Table>
            </div>
            
            <div className="mt-20 flex justify-end">
                <div className="w-72 border-t-2 border-black text-center pt-2">
                    <p className="font-black text-[12px] uppercase tracking-widest text-slate-800 text-center">Authorized Manager Signature</p>
                </div>
            </div>
        </div>
    );
}
