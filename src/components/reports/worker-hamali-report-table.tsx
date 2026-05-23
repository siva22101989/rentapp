'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { format } from "date-fns";
import type { WarehouseInfo } from "@/lib/definitions";
import { formatCurrency } from '@/lib/utils';
import { useMemo } from "react";
import type { WorkerHamaliEvent } from "./hamali-report";

type ReportTableProps = {
    events: WorkerHamaliEvent[];
    title: string;
    warehouseInfo: WarehouseInfo | null;
}

export function WorkerHamaliReportTable({ events, title, warehouseInfo }: ReportTableProps) {
    const generatedDate = useMemo(() => format(new Date(), 'dd/MM/yy, hh:mm a'), []);
    
    let runningBalance = 0;
    const ledgerItems = useMemo(() => {
        return events.map(event => {
            const payable = event.payable || 0;
            const paid = event.paid || 0;
            runningBalance += (payable - paid);
            return {
                ...event,
                runningBalance
            };
        });
    }, [events]);

    const totalPayable = events.reduce((acc, event) => acc + event.payable, 0);
    const totalPaid = events.reduce((acc, event) => acc + event.paid, 0);
    
    return (
        <div className="bg-white p-4 text-black font-sans text-[13px] printable-area border shadow-sm rounded-lg">
             <div className="mb-6 text-center border-b pb-4">
                <h2 className="text-xl font-bold uppercase tracking-wide">{warehouseInfo?.name || "SRI LAKSHMI WAREHOUSE"}</h2>
                <p className="text-muted-foreground font-semibold uppercase text-xs mt-1">{title}</p>
                <p className="text-[10px] text-slate-400 mt-1 uppercase">Audit Generation: {generatedDate}</p>
            </div>
            <div className="table-scroll-container border-y-2 border-black">
                <Table className="text-[13px]">
                    <TableHeader>
                        <TableRow className="border-b border-black bg-slate-50">
                            <TableHead className="font-bold text-black p-2 text-center uppercase text-[10px]">Date</TableHead>
                            <TableHead className="font-bold text-black p-2 text-left uppercase text-[10px]">Description (Customer - Process)</TableHead>
                            <TableHead className="font-bold text-black p-2 text-center uppercase text-[10px]">Ref ID</TableHead>
                            <TableHead className="font-bold text-black p-2 text-center uppercase text-[10px]">Bags</TableHead>
                            <TableHead className="font-bold text-black p-2 text-right uppercase text-[10px]">Payable (+)</TableHead>
                            <TableHead className="font-bold text-black p-2 text-right uppercase text-[10px]">Paid (-)</TableHead>
                            <TableHead className="font-bold text-black p-2 text-right uppercase text-[10px]">Balance</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {ledgerItems.map((item, index) => (
                            <TableRow key={index} className="h-8 border-b border-slate-100 hover:bg-slate-50/50">
                                <TableCell className="p-1 text-center whitespace-nowrap">{format(item.date, 'dd/MM/yy')}</TableCell>
                                <TableCell className="p-1 font-black whitespace-nowrap uppercase tracking-tighter">{item.description}</TableCell>
                                <TableCell className="p-1 text-center font-mono text-slate-400">{item.recordId.replace(/\D/g, '')}</TableCell>
                                <TableCell className="p-1 text-center font-mono">{item.bags || ''}</TableCell>
                                <TableCell className="p-1 text-right font-mono font-bold text-slate-900">
                                    {item.payable > 0 ? formatCurrency(item.payable) : ''}
                                </TableCell>
                                <TableCell className="p-1 text-right font-mono font-bold text-green-700">
                                     {item.paid > 0 ? formatCurrency(item.paid) : ''}
                                </TableCell>
                                <TableCell className="p-1 text-right font-mono font-black">
                                    {formatCurrency(item.runningBalance)}
                                </TableCell>
                            </TableRow>
                        ))}
                        {ledgerItems.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center py-20 text-muted-foreground italic">
                                    No hamali ledger records found for the selected period.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                    <TableFooter>
                        <TableRow className="bg-slate-900 text-white font-black border-t-2 border-black h-10">
                            <TableCell colSpan={4} className="p-2 text-right uppercase text-[10px] tracking-widest">Grand Ledger Totals</TableCell>
                            <TableCell className="p-2 text-right font-mono text-[13px]">{formatCurrency(totalPayable)}</TableCell>
                            <TableCell className="p-2 text-right font-mono text-[13px]">{formatCurrency(totalPaid)}</TableCell>
                            <TableCell className="p-2 text-right font-mono text-[14px] text-orange-400">{formatCurrency(totalPayable - totalPaid)}</TableCell>
                        </TableRow>
                    </TableFooter>
                </Table>
            </div>
            
            <div className="mt-16 flex justify-end">
                <div className="w-64 border-t-2 border-black text-center pt-2">
                    <p className="font-black text-[12px] uppercase tracking-widest text-slate-800">Authorized Manager Signature</p>
                </div>
            </div>
        </div>
    );
}
