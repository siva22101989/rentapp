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
        <div className="bg-white p-6 text-black font-sans text-[13px] printable-area border-2 border-black shadow-none rounded-xl w-full mx-auto" style={{ width: '277mm' }}>
             <div className="mb-6 text-center border-b-2 border-black pb-4">
                <h2 className="text-2xl font-black uppercase tracking-tight leading-none text-primary text-center">{warehouseInfo?.name || "SRI LAKSHMI WAREHOUSE"}</h2>
                <h3 className="text-sm font-black uppercase tracking-widest mt-2 text-center">{title}</h3>
                <p className="text-[10px] text-slate-400 mt-1 uppercase text-center font-bold">Audit Cycle Generation: {generatedDate}</p>
            </div>
            
            <div className="table-scroll-container border-y-2 border-black">
                <Table className="text-[13px]">
                    <TableHeader>
                        <TableRow className="border-b-2 border-black bg-slate-50 hover:bg-slate-50">
                            <TableHead className="font-black text-black p-2 text-center uppercase text-[10px] border-r">Date</TableHead>
                            <TableHead className="font-black text-black p-2 text-center uppercase text-[10px] border-r">Customer Name</TableHead>
                            <TableHead className="font-black text-black p-2 text-center uppercase text-[10px] border-r">Process Details</TableHead>
                            <TableHead className="font-black text-black p-2 text-center uppercase text-[10px] border-r">Ref ID</TableHead>
                            <TableHead className="font-black text-black p-2 text-center uppercase text-[10px] border-r">Rate</TableHead>
                            <TableHead className="font-black text-black p-2 text-center uppercase text-[10px] border-r">Bags</TableHead>
                            <TableHead className="font-black text-primary p-2 text-center uppercase text-[10px] border-r">Hamali Amount (+)</TableHead>
                            <TableHead className="font-black text-green-700 p-2 text-center uppercase text-[10px] border-r">Paid (-)</TableHead>
                            <TableHead className="font-black text-black p-2 text-center uppercase text-[10px]">Balance</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {ledgerItems.map((item, index) => (
                            <TableRow key={index} className="h-10 border-b border-slate-100 hover:bg-slate-50/50">
                                <TableCell className="p-1 text-center whitespace-nowrap border-r">{format(item.date, 'dd/MM/yy')}</TableCell>
                                <TableCell className="p-1 font-black whitespace-nowrap uppercase tracking-tighter text-center border-r">{getCustomerName(item.customerId)}</TableCell>
                                <TableCell className="p-1 text-slate-600 italic tracking-tight text-center border-r">{item.description}</TableCell>
                                <TableCell className="p-1 text-center font-mono text-slate-400 border-r">{item.recordId.replace(/\D/g, '')}</TableCell>
                                <TableCell className="p-1 text-right font-mono text-center border-r">{item.rate ? item.rate.toFixed(2) : ''}</TableCell>
                                <TableCell className="p-1 text-right font-mono text-center border-r">{item.bags || ''}</TableCell>
                                <TableCell className="p-1 text-right font-mono font-bold text-center border-r">
                                    {item.type === 'charge' ? formatCurrency(item.amount) : ''}
                                </TableCell>
                                <TableCell className="p-1 text-right font-mono font-bold text-green-600 text-center border-r">
                                    {item.type === 'payment' ? formatCurrency(item.amount) : ''}
                                </TableCell>
                                <TableCell className="p-1 text-right font-mono font-black text-center bg-slate-50/30">
                                    {formatCurrency(item.runningBalance)}
                                </TableCell>
                            </TableRow>
                        ))}
                         {ledgerItems.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={9} className="text-center py-24 text-muted-foreground italic font-medium">
                                    No customer hamali records found for the selected period.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                    <TableFooter>
                        <TableRow className="bg-slate-50 text-black font-black border-t-2 border-black h-14">
                            <TableCell colSpan={6} className="p-2 text-right uppercase text-[10px] tracking-[0.2em] pr-6">Grand Ledger Audit Totals</TableCell>
                            <TableCell className="p-2 text-center font-mono text-base border-r">{formatCurrency(totalCharges)}</TableCell>
                            <TableCell className="p-2 text-center font-mono text-base text-green-700 border-r">{formatCurrency(totalPayments)}</TableCell>
                            <TableCell className="p-2 text-center font-mono text-lg text-destructive">{formatCurrency(totalCharges - totalPayments)}</TableCell>
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