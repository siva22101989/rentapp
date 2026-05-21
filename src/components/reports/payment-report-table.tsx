
'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { format } from "date-fns";
import type { Customer } from "@/lib/definitions";
import { formatCurrency, toDate } from '@/lib/utils';
import { useMemo } from "react";
import { Badge } from "../ui/badge";

export type PaymentEvent = {
    date: Date;
    customerId: string;
    description: string;
    recordId: string;
    amount: number;
    type: 'rent' | 'hamali' | 'other' | 'unloading' | 'discount';
};

type ReportTableProps = {
    events: PaymentEvent[];
    customers: Customer[];
    title: string;
}

export function PaymentReportTable({ events, customers, title }: ReportTableProps) {
    const generatedDate = useMemo(() => format(new Date(), 'dd MMM yyyy, hh:mm a'), []);

    const getCustomerName = (customerId: string) => {
        return customers.find(c => c.id === customerId)?.name ?? 'Unknown';
    }

    const totalPayments = events.reduce((acc, event) => acc + event.amount, 0);
    
    const getTypeBadge = (type: PaymentEvent['type']) => {
        switch(type) {
            case 'rent': return <Badge variant="default" className="bg-blue-100 text-blue-800 text-[9px] h-4 py-0">Rent</Badge>;
            case 'hamali': return <Badge variant="default" className="bg-orange-100 text-orange-800 text-[9px] h-4 py-0">Hamali</Badge>;
            case 'unloading': return <Badge variant="default" className="bg-yellow-100 text-yellow-800 text-[9px] h-4 py-0">Unloading</Badge>;
            case 'discount': return <Badge variant="default" className="bg-purple-100 text-purple-800 text-[9px] h-4 py-0">Discount</Badge>;
            default: return <Badge variant="secondary" className="text-[9px] h-4 py-0">Other</Badge>;
        }
    }

    return (
        <div className="bg-white p-4 rounded-lg">
             <div className="mb-4 text-center">
                <h2 className="text-xl font-bold uppercase tracking-wide">SRI LAKSHMI WAREHOUSE</h2>
                <p className="text-muted-foreground font-semibold uppercase text-[14px]">{title}</p>
                <p className="text-xs text-muted-foreground">Generated on: {generatedDate}</p>
            </div>
            <Table className="text-[13px]">
                <TableHeader>
                    <TableRow className="bg-muted/50">
                        <TableHead className="uppercase text-[10px] font-bold">Date</TableHead>
                        <TableHead className="uppercase text-[10px] font-bold">Customer</TableHead>
                        <TableHead className="uppercase text-[10px] font-bold">Type</TableHead>
                        <TableHead className="uppercase text-[10px] font-bold">Description</TableHead>
                        <TableHead className="uppercase text-[10px] font-bold">Ref ID</TableHead>
                        <TableHead className="text-right uppercase text-[10px] font-bold">Amount Paid</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {events.map((event, index) => (
                        <TableRow key={index} className="h-8">
                            <TableCell className="p-1">{format(event.date, 'dd/MM/yy')}</TableCell>
                            <TableCell className="p-1 font-medium whitespace-nowrap">{getCustomerName(event.customerId)}</TableCell>
                            <TableCell className="p-1">{getTypeBadge(event.type)}</TableCell>
                            <TableCell className="p-1 tracking-tight">{event.description}</TableCell>
                            <TableCell className="p-1 font-mono text-slate-400">{event.recordId}</TableCell>
                            <TableCell className="p-1 text-right font-mono text-green-600 font-bold">
                                {formatCurrency(event.amount)}
                            </TableCell>
                        </TableRow>
                    ))}
                    {events.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={6} className="text-center text-muted-foreground py-10 italic">No payments found.</TableCell>
                        </TableRow>
                    )}
                </TableBody>
                <TableFooter>
                    <TableRow className="bg-secondary/30 font-bold">
                        <TableCell colSpan={5} className="p-2 text-right uppercase text-[10px]">Total Cash Receipts</TableCell>
                        <TableCell className="p-2 text-right font-mono text-green-700 text-lg">{formatCurrency(totalPayments)}</TableCell>
                    </TableRow>
                </TableFooter>
            </Table>
            
            <div className="mt-16 pt-8 flex flex-col items-end text-center space-y-1">
                <div className="w-72 border-t border-slate-400 pt-4">
                    <p className="text-[#1e293b] font-bold text-sm uppercase tracking-wider">AUTHORIZED MANAGER SIGNATURE</p>
                    <p className="text-primary font-bold text-xs uppercase mt-1">SRI LAKSHMI WAREHOUSE</p>
                </div>
            </div>
        </div>
    );
}
