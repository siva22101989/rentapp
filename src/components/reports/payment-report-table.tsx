
'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { format } from "date-fns";
import type { Customer } from "@/lib/definitions";
import { formatCurrency } from '@/lib/utils';
import { useMemo } from "react";
import { Button } from "../ui/button";
import { Eye } from "lucide-react";
import Link from "next/link";

export type PaymentEvent = {
    date: Date;
    customerId: string;
    description: string;
    recordId: string;
    amount: number;
    type: 'rent' | 'hamali' | 'other' | 'unloading' | 'discount';
    isUnloading?: boolean;
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
        <div className="bg-white p-4 text-black font-sans text-sm printable-area">
             <div className="mb-4 text-center border-b-2 border-black pb-2">
                <h2 className="text-xl font-bold uppercase">SRI LAKSHMI WAREHOUSE</h2>
                <p className="text-muted-foreground font-semibold uppercase text-[12px]">{title}</p>
                <p className="text-[10px] text-slate-500">Generated: {generatedDate}</p>
            </div>
            <div className="table-scroll-container border-y-2 border-black">
                <Table className="text-[13px]">
                    <TableHeader>
                        <TableRow className="border-b border-black">
                            <TableHead className="font-bold text-black p-1 text-center uppercase text-[10px]">Date</TableHead>
                            <TableHead className="font-bold text-black p-1 text-left uppercase text-[10px]">Customer Name</TableHead>
                            <TableHead className="font-bold text-black p-1 text-center uppercase text-[10px]">Type</TableHead>
                            <TableHead className="font-bold text-black p-1 text-center uppercase text-[10px]">Ref No</TableHead>
                            <TableHead className="font-bold text-black p-1 text-right uppercase text-[10px]">Amount Paid</TableHead>
                            <TableHead className="font-bold text-black p-1 text-right uppercase text-[10px] print-hide">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {events.map((event, index) => (
                            <TableRow key={index} className="h-7 border-b border-slate-100">
                                <TableCell className="p-1 text-center whitespace-nowrap">{format(event.date, 'dd/MM/yy')}</TableCell>
                                <TableCell className="p-1 font-medium uppercase whitespace-nowrap">{getCustomerName(event.customerId)}</TableCell>
                                <TableCell className="p-1 text-center uppercase text-[9px] font-bold">{event.type}</TableCell>
                                <TableCell className="p-1 text-center font-mono text-slate-400">{event.recordId}</TableCell>
                                <TableCell className="p-1 text-right font-mono font-bold text-green-700">
                                    {formatCurrency(event.amount)}
                                </TableCell>
                                <TableCell className="p-1 text-right print-hide">
                                    <Button asChild variant="ghost" size="icon" className="h-8 w-8">
                                        <Link href={event.isUnloading ? `/unloading/receipt/${event.recordId}` : `/inflow/receipt/${event.recordId}`} target="_blank">
                                            <Eye className="h-4 w-4" />
                                        </Link>
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                    <TableFooter>
                        <TableRow className="bg-slate-50 font-bold border-t-2 border-black">
                            <TableCell colSpan={4} className="p-1 text-right uppercase text-[10px]">Total Cash Receipts</TableCell>
                            <TableCell className="p-1 text-right font-mono text-green-700 text-[14px]">{formatCurrency(totalPayments)}</TableCell>
                            <TableCell className="print-hide" />
                        </TableRow>
                    </TableFooter>
                </Table>
            </div>
            <div className="mt-16 flex justify-end">
                <div className="w-56 border-t border-black text-center pt-1">
                    <p className="font-bold text-[12px] uppercase">Authorized Signature</p>
                </div>
            </div>
        </div>
    );
}
