
'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { format } from "date-fns";
import type { Customer } from "@/lib/definitions";
import { formatCurrency } from '@/lib/utils';
import { useMemo } from "react";

type WorkerHamaliEvent = {
    date: Date;
    description: string;
    recordId: string;
    customerId?: string;
    payable: number;
    paid: number;
    bags?: number;
}

type ReportTableProps = {
    events: WorkerHamaliEvent[];
    customers: Customer[];
    title: string;
}

export function WorkerHamaliReportTable({ events, title }: ReportTableProps) {
    const generatedDate = useMemo(() => format(new Date(), 'dd MMM yyyy, hh:mm a'), []);
    
    const totalPayable = events.reduce((acc, event) => acc + event.payable, 0);
    const totalPaid = events.reduce((acc, event) => acc + event.paid, 0);
    const balance = totalPayable - totalPaid;
    
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
                        <TableHead className="uppercase text-[10px] font-bold">Description</TableHead>
                        <TableHead className="uppercase text-[10px] font-bold">Ref ID</TableHead>
                        <TableHead className="text-center uppercase text-[10px] font-bold">Bags</TableHead>
                        <TableHead className="text-right uppercase text-[10px] font-bold">Worker Payable</TableHead>
                        <TableHead className="text-right uppercase text-[10px] font-bold">Paid</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {events.map((event, index) => (
                        <TableRow key={index} className="h-8">
                            <TableCell className="p-1 text-[13px]">{format(event.date, 'dd/MM/yy')}</TableCell>
                            <TableCell className="p-1 tracking-tight text-[13px]">{event.description}</TableCell>
                            <TableCell className="p-1 font-mono text-slate-400 text-[13px]">{event.recordId}</TableCell>
                            <TableCell className="p-1 text-center font-mono text-[13px]">{event.bags || ''}</TableCell>
                            <TableCell className="p-1 text-right font-mono text-[13px]">
                                {event.payable > 0 ? formatCurrency(event.payable) : ''}
                            </TableCell>
                            <TableCell className="p-1 text-right font-mono text-green-600 text-[13px]">
                                 {event.paid > 0 ? formatCurrency(event.paid) : ''}
                            </TableCell>
                        </TableRow>
                    ))}
                     {events.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={6} className="text-center text-muted-foreground py-10 italic">No worker transactions found.</TableCell>
                        </TableRow>
                    )}
                </TableBody>
                <TableFooter>
                    <TableRow className="bg-secondary/30 font-bold">
                        <TableCell colSpan={4} className="p-2 text-right uppercase text-[10px]">Totals</TableCell>
                        <TableCell className="p-2 text-right font-mono">{formatCurrency(totalPayable)}</TableCell>
                        <TableCell className="p-2 text-right font-mono text-green-600">{formatCurrency(totalPaid)}</TableCell>
                    </TableRow>
                     <TableRow className="font-black border-t-2 border-primary">
                        <TableCell colSpan={5} className="p-2 text-right uppercase text-[11px] text-slate-500">Balance Pending to Workers</TableCell>
                        <TableCell className="p-2 text-right font-mono text-lg text-destructive">{formatCurrency(balance)}</TableCell>
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
