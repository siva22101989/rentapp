
'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { format } from "date-fns";
import type { Customer, WarehouseInfo } from "@/lib/definitions";
import { formatCurrency } from '@/lib/utils';
import { useMemo } from "react";
import type { CustomerHamaliEvent } from "./hamali-report";

type ReportTableProps = {
    events: CustomerHamaliEvent[];
    customers: Customer[];
    title: string;
    warehouseInfo: WarehouseInfo | null;
}

export function CustomerHamaliReportTable({ events, customers, title, warehouseInfo }: ReportTableProps) {
    const generatedDate = useMemo(() => format(new Date(), 'dd/MM/yy, hh:mm a'), []);

    const getCustomerName = (customerId?: string) => {
        if (!customerId) return '';
        return customers.find(c => c.id === customerId)?.name ?? 'Unknown';
    }

    let runningBalance = 0;
    const ledgerItems = useMemo(() => {
        return events.map(event => {
            const debit = event.type === 'charge' ? event.amount : 0;
            const credit = event.type === 'payment' ? event.amount : 0;
            runningBalance += (debit - credit);
            return {
                ...event,
                runningBalance
            };
        });
    }, [events]);

    const totalCharges = events.filter(e => e.type === 'charge').reduce((acc, event) => acc + event.amount, 0);
    const totalPayments = events.filter(e => e.type === 'payment').reduce((acc, event) => acc + event.amount, 0);
    
    return (
        <div className="bg-white p-4 text-black font-sans text-[13px] printable-area border shadow-sm rounded-lg">
             <div className="mb-6 text-center border-b pb-4">
                <h2 className="text-xl font-bold uppercase tracking-tight leading-none">{warehouseInfo?.name || "SRI LAKSHMI WAREHOUSE"}</h2>
                <p className="text-muted-foreground font-semibold uppercase text-xs mt-1">{title}</p>
                <p className="text-[10px] text-slate-400 mt-1 uppercase">Audit Generation: {generatedDate}</p>
            </div>
            
            <div className="table-scroll-container border-y-2 border-black">
                <Table className="text-[13px]">
                    <TableHeader>
                        <TableRow className="border-b border-black bg-slate-50">
                            <TableHead className="font-bold text-black p-2 text-center uppercase text-[10px]">Date</TableHead>
                            <TableHead className="font-bold text-black p-2 text-left uppercase text-[10px]">Customer Name</TableHead>
                            <TableHead className="font-bold text-black p-2 text-left uppercase text-[10px]">Process Details</TableHead>
                            <TableHead className="font-bold text-black p-2 text-center uppercase text-[10px]">Ref ID</TableHead>
                            <TableHead className="font-bold text-black p-2 text-right uppercase text-[10px]">Rate</TableHead>
                            <TableHead className="font-bold text-black p-2 text-right uppercase text-[10px]">Bags</TableHead>
                            <TableHead className="font-bold text-black p-2 text-right uppercase text-[10px]">Charge (+)</TableHead>
                            <TableHead className="font-bold text-black p-2 text-right uppercase text-[10px]">Paid (-)</TableHead>
                            <TableHead className="font-bold text-black p-2 text-right uppercase text-[10px]">Balance</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {ledgerItems.map((item, index) => (
                            <TableRow key={index} className="h-8 border-b border-slate-100 hover:bg-slate-50/50">
                                <TableCell className="p-1 text-center whitespace-nowrap">{format(item.date, 'dd/MM/yy')}</TableCell>
                                <TableCell className="p-1 font-black whitespace-nowrap uppercase tracking-tighter">{getCustomerName(item.customerId)}</TableCell>
                                <TableCell className="p-1 text-slate-600 italic tracking-tight">{item.description}</TableCell>
                                <TableCell className="p-1 text-center font-mono text-slate-400">{item.recordId.replace(/\D/g, '')}</TableCell>
                                <TableCell className="p-1 text-right font-mono">{item.rate ? item.rate.toFixed(2) : ''}</TableCell>
                                <TableCell className="p-1 text-right font-mono">{item.bags || ''}</TableCell>
                                <TableCell className="p-1 text-right font-mono font-bold">
                                    {item.type === 'charge' ? formatCurrency(item.amount) : ''}
                                </TableCell>
                                <TableCell className="p-1 text-right font-mono font-bold text-green-600">
                                    {item.type === 'payment' ? formatCurrency(item.amount) : ''}
                                </TableCell>
                                <TableCell className="p-1 text-right font-mono font-black">
                                    {formatCurrency(item.runningBalance)}
                                </TableCell>
                            </TableRow>
                        ))}
                         {ledgerItems.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={9} className="text-center py-20 text-muted-foreground italic">
                                    No customer ledger records found for the selected period.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                    <TableFooter>
                        <TableRow className="bg-slate-900 text-white font-black border-t-2 border-black h-10">
                            <TableCell colSpan={6} className="p-2 text-right uppercase text-[10px] tracking-widest">Grand Ledger Totals</TableCell>
                            <TableCell className="p-2 text-right font-mono text-[13px]">{formatCurrency(totalCharges)}</TableCell>
                            <TableCell className="p-2 text-right font-mono text-[13px]">{formatCurrency(totalPayments)}</TableCell>
                            <TableCell className="p-2 text-right font-mono text-[14px]">{formatCurrency(totalCharges - totalPayments)}</TableCell>
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
