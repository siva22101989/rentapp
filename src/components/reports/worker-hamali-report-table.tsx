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
        return (events || []).map(event => {
            const payable = Number(event.payable) || 0;
            const paid = Number(event.paid) || 0;
            runningBalance += (payable - paid);
            return {
                ...event,
                runningBalance
            };
        });
    }, [events]);

    const totalPayable = (events || []).reduce((acc, event) => acc + (Number(event.payable) || 0), 0);
    const totalPaid = (events || []).reduce((acc, event) => acc + (Number(event.paid) || 0), 0);
    const totalBags = (events || []).reduce((acc, event) => acc + (Number(event.bags) || 0), 0);
    
    return (
        <div className="bg-white p-6 text-black font-sans text-[13px] printable-area border-2 border-black shadow-none rounded-xl w-full mx-auto" style={{ width: '277mm' }}>
             <div className="mb-6 text-center border-b-2 border-black pb-4">
                <h2 className="text-2xl font-black uppercase tracking-tight leading-none text-primary text-center">{warehouseInfo?.name || "SRI LAKSHMI WAREHOUSE"}</h2>
                <h3 className="text-sm font-black uppercase tracking-widest mt-2 text-center">{title}</h3>
                <p className="text-[10px] text-slate-400 mt-1 uppercase text-center font-bold font-mono">Staff Ledger Token: WHL-{format(new Date(), 'yyyyMMdd')}</p>
            </div>
            <div className="table-scroll-container border-y-2 border-black">
                <Table className="text-[13px]">
                    <TableHeader>
                        <TableRow className="border-b-2 border-black bg-slate-50 hover:bg-slate-50">
                            <TableHead className="font-black text-black p-2 text-center uppercase text-[10px] border-r">Date</TableHead>
                            <TableHead className="font-black text-black p-2 text-center uppercase text-[10px] border-r">Description (Customer - Process)</TableHead>
                            <TableHead className="font-black text-black p-2 text-center uppercase text-[10px] border-r">Ref ID</TableHead>
                            <TableHead className="font-black text-black p-2 text-center uppercase text-[10px] border-r">Bags</TableHead>
                            <TableHead className="font-black text-slate-900 p-2 text-center uppercase text-[10px] border-r">Staff Payable (+)</TableHead>
                            <TableHead className="font-black text-green-700 p-2 text-center uppercase text-[10px] border-r">Cash Distributed (-)</TableHead>
                            <TableHead className="font-black text-black p-2 text-center uppercase text-[10px]">Net Staff Balance</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {ledgerItems.map((item, index) => (
                            <TableRow key={index} className="h-10 border-b border-slate-100 hover:bg-slate-50/50">
                                <TableCell className="p-1 text-center whitespace-nowrap border-r">{format(item.date, 'dd/MM/yy')}</TableCell>
                                <TableCell className="p-1 font-black whitespace-nowrap uppercase tracking-tighter text-center border-r">{item.description}</TableCell>
                                <TableCell className="p-1 text-center font-mono text-slate-400 border-r">{item.recordId.replace(/\D/g, '')}</TableCell>
                                <TableCell className="p-1 text-center font-mono border-r">{item.bags || ''}</TableCell>
                                <TableCell className="p-1 text-right font-mono font-bold text-slate-900 text-center border-r">
                                    {item.payable > 0 ? formatCurrency(item.payable) : ''}
                                </TableCell>
                                <TableCell className="p-1 text-right font-mono font-bold text-green-700 text-center border-r">
                                     {item.paid > 0 ? formatCurrency(item.paid) : ''}
                                </TableCell>
                                <TableCell className="p-1 text-right font-mono font-black text-center bg-slate-50/30">
                                    {formatCurrency(item.runningBalance)}
                                </TableCell>
                            </TableRow>
                        ))}
                        {ledgerItems.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center py-24 text-muted-foreground italic font-medium">
                                    No staff hamali transactions found for the selected period.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                    <TableFooter>
                        <TableRow className="bg-slate-50 text-black font-black border-t-2 border-black h-14">
                            <TableCell colSpan={3} className="p-2 text-right uppercase text-[10px] tracking-[0.2em] pr-6">Grand Ledger Totals</TableCell>
                            <TableCell className="p-2 text-center font-mono text-base border-r">{totalBags || ''}</TableCell>
                            <TableCell className="p-2 text-center font-mono text-base border-r">{formatCurrency(totalPayable)}</TableCell>
                            <TableCell className="p-2 text-center font-mono text-base text-green-700 border-r">{formatCurrency(totalPaid)}</TableCell>
                            <TableCell className="p-2 text-center font-mono text-lg text-orange-600">{formatCurrency(totalPayable - totalPaid)}</TableCell>
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