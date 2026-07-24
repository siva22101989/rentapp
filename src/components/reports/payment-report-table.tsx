'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { format } from "date-fns";
import type { Customer, PaymentType } from "@/lib/definitions";
import { formatCurrency } from '@/lib/utils';
import { useMemo } from "react";
import { PaymentActionsMenu } from "./payment-actions-menu";

export type PaymentEvent = {
    date: Date;
    customerId: string;
    description: string;
    recordId: string; // The database document ID
    displayBillNo: string; // User-facing ID (Bill No or BULK)
    amount: number;
    type: PaymentType;
    recordType: 'storage' | 'unloading' | 'bulk';
    paymentIndex: number;
};

type ReportTableProps = {
    events: PaymentEvent[];
    customers: Customer[];
    title: string;
}

export function PaymentReportTable({ events, customers, title }: ReportTableProps) {
    const generatedDate = useMemo(() => format(new Date(), 'dd/MM/yy, h:mm a'), []);

    const getCustomerName = (customerId: string) => {
        return customers.find(c => c.id === customerId)?.name ?? 'Unknown';
    }

    const totalPayments = events.reduce((acc, event) => acc + event.amount, 0);

    return (
        <div className="bg-white p-4 text-black font-sans text-sm printable-area border shadow-sm rounded-lg">
             <div className="mb-6 text-center border-b pb-4">
                <h2 className="text-xl font-bold uppercase tracking-tight text-center">SRI LAKSHMI WAREHOUSE</h2>
                <p className="text-muted-foreground font-semibold uppercase text-[12px] mt-1 text-center">{title}</p>
                <p className="text-[10px] text-slate-400 mt-1 uppercase text-center">Audit Generation: {generatedDate}</p>
            </div>
            
            <div className="table-scroll-container border-y-2 border-slate-900">
                <Table className="text-[13px]">
                    <TableHeader>
                        <TableRow className="border-b border-slate-900 bg-slate-50">
                            <TableHead className="font-bold text-black p-2 text-center uppercase text-[10px]">Date</TableHead>
                            <TableHead className="font-bold text-black p-2 text-center uppercase text-[10px]">Customer Name</TableHead>
                            <TableHead className="font-bold text-black p-2 text-center uppercase text-[10px]">Type</TableHead>
                            <TableHead className="font-bold text-black p-2 text-center uppercase text-[10px]">Bill No</TableHead>
                            <TableHead className="font-bold text-black p-2 text-center uppercase text-[10px]">Amount Paid</TableHead>
                            <TableHead className="font-bold text-black p-2 text-center uppercase text-[10px] print-hide">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {events.map((event, index) => {
                            const displayId = event.displayBillNo;
                            return (
                            <TableRow key={index} className="h-9 border-b border-slate-100 hover:bg-slate-50/50">
                                <TableCell className="p-1 text-center whitespace-nowrap">{format(event.date, 'dd/MM/yy')}</TableCell>
                                <TableCell className="p-1 font-black whitespace-nowrap uppercase tracking-tighter text-center">{getCustomerName(event.customerId)}</TableCell>
                                <TableCell className="p-1 text-center uppercase text-[9px] font-bold">
                                    <span className="bg-slate-100 px-2 py-0.5 rounded-full border text-slate-600">{event.type}</span>
                                </TableCell>
                                <TableCell className="p-1 text-center font-mono font-bold text-slate-400">{displayId}</TableCell>
                                <TableCell className="p-1 text-center font-mono font-black text-green-700">
                                    {formatCurrency(event.amount)}
                                </TableCell>
                                <TableCell className="p-1 text-center print-hide">
                                    <PaymentActionsMenu event={event} />
                                </TableCell>
                            </TableRow>
                        )})}
                        {events.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-20 text-muted-foreground italic">
                                    No cash receipts found for the selected period.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                    <TableFooter>
                        <TableRow className="bg-slate-50 text-black font-black border-t-2 border-slate-900 h-12 hover:bg-slate-50">
                            <TableCell colSpan={4} className="p-2 text-right uppercase text-[10px] tracking-widest">Grand Total Portfolio Collected</TableCell>
                            <TableCell className="p-2 text-center font-mono text-[14px] text-green-700">{formatCurrency(totalPayments)}</TableCell>
                            <TableCell className="print-hide" />
                        </TableRow>
                    </TableFooter>
                </Table>
            </div>
            
            <div className="mt-16 flex justify-end">
                <div className="w-72 border-t-2 border-slate-900 text-center pt-2">
                    <p className="font-black text-[12px] uppercase tracking-widest text-slate-800 text-center">Authorized Manager Signature</p>
                </div>
            </div>
        </div>
    );
}