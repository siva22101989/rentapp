
'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { format } from "date-fns";
import { formatCurrency } from '@/lib/utils';
import { useMemo } from "react";
import type { WorkerHamaliEvent } from "./hamali-report";

type ReportTableProps = {
    events: WorkerHamaliEvent[];
    title: string;
}

export function WorkerHamaliReportTable({ events, title }: ReportTableProps) {
    const generatedDate = useMemo(() => format(new Date(), 'dd/MM/yy, h:mm a'), []);
    
    const totalPayable = events.reduce((acc, event) => acc + event.payable, 0);
    const totalPaid = events.reduce((acc, event) => acc + event.paid, 0);
    const balance = totalPayable - totalPaid;
    
    return (
        <div className="bg-white p-4 text-black font-sans text-sm printable-area">
             <div className="mb-4 text-center border-b-2 border-black pb-2">
                <h2 className="text-xl font-bold uppercase tracking-wide">SRI LAKSHMI WAREHOUSE</h2>
                <p className="text-muted-foreground font-semibold uppercase text-[12px]">{title}</p>
                <p className="text-[10px] text-slate-400">Generated: {generatedDate}</p>
            </div>
            <div className="table-scroll-container border-y-2 border-black">
                <Table className="text-[13px]">
                    <TableHeader>
                        <TableRow className="border-b border-black">
                            <TableHead className="font-bold text-black p-1 text-center uppercase text-[9px]">Date</TableHead>
                            <TableHead className="font-bold text-black p-1 text-left uppercase text-[9px]">Description</TableHead>
                            <TableHead className="font-bold text-black p-1 text-center uppercase text-[9px]">Ref ID</TableHead>
                            <TableHead className="font-bold text-black p-1 text-right uppercase text-[9px]">Payable</TableHead>
                            <TableHead className="font-bold text-black p-1 text-right uppercase text-[9px]">Paid</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {events.map((event, index) => (
                            <TableRow key={index} className="h-7 border-b border-slate-100">
                                <TableCell className="p-1 text-center whitespace-nowrap">{format(event.date, 'dd/MM/yy')}</TableCell>
                                <TableCell className="p-1">{event.description}</TableCell>
                                <TableCell className="p-1 text-center font-mono text-slate-400">{event.recordId}</TableCell>
                                <TableCell className="p-1 text-right font-mono">
                                    {event.payable > 0 ? formatCurrency(event.payable) : ''}
                                </TableCell>
                                <TableCell className="p-1 text-right font-mono text-green-700">
                                     {event.paid > 0 ? formatCurrency(event.paid) : ''}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                    <TableFooter>
                        <TableRow className="bg-slate-50 font-bold border-t-2 border-black">
                            <TableCell colSpan={3} className="p-1 text-right uppercase text-[10px]">Total Worker Dues</TableCell>
                            <TableCell className="p-1 text-right font-mono">{formatCurrency(totalPayable)}</TableCell>
                            <TableCell className="p-1 text-right font-mono text-green-700">{formatCurrency(totalPaid)}</TableCell>
                        </TableRow>
                         <TableRow className="bg-black text-white font-black">
                            <TableCell colSpan={4} className="p-1 text-right uppercase text-[10px]">Net Payable to Workers</TableCell>
                            <TableCell className="p-1 text-right font-mono text-[14px]">{formatCurrency(balance)}</TableCell>
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
