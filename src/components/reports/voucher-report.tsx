
'use client';

import React, { useMemo } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { format } from "date-fns";
import type { Expense, OtherIncome, WarehouseInfo } from "@/lib/definitions";
import { formatCurrency, toDate } from '@/lib/utils';
import { useDateFilter } from '@/firebase/provider';

type VoucherEvent = {
    date: Date;
    refNo: string;
    type: 'Income' | 'Expense';
    category: string;
    description: string;
    amount: number;
}

export function VoucherReport({ 
    expenses, 
    otherIncomes, 
    warehouseInfo 
}: { 
    expenses: Expense[], 
    otherIncomes: OtherIncome[], 
    warehouseInfo: WarehouseInfo | null 
}) {
    const { dateRange, financialYear } = useDateFilter();
    const generatedDate = useMemo(() => format(new Date(), 'dd/MM/yy, hh:mm a'), []);

    const voucherEvents = useMemo(() => {
        const events: VoucherEvent[] = [];

        const inRange = (date: Date) => {
            if (financialYear === 'all-time') return true;
            if (!dateRange || !dateRange.from || !dateRange.to) return true;
            return date >= dateRange.from && date <= dateRange.to;
        };

        expenses.forEach(e => {
            const d = toDate(e.date);
            if (inRange(d)) {
                events.push({
                    date: d,
                    refNo: e.refNo || 'EXP',
                    type: 'Expense',
                    category: e.category,
                    description: e.description,
                    amount: e.amount
                });
            }
        });

        otherIncomes.forEach(i => {
            const d = toDate(i.date);
            if (inRange(d)) {
                events.push({
                    date: d,
                    refNo: i.refNo || 'INC',
                    type: 'Income',
                    category: i.category,
                    description: i.description,
                    amount: i.amount
                });
            }
        });

        // Newest First sorting
        return events.sort((a, b) => b.date.getTime() - a.date.getTime());
    }, [expenses, otherIncomes, dateRange, financialYear]);

    const totals = useMemo(() => {
        return voucherEvents.reduce((acc, v) => {
            if (v.type === 'Income') acc.income += v.amount;
            else acc.expense += v.amount;
            return acc;
        }, { income: 0, expense: 0 });
    }, [voucherEvents]);

    return (
        <div className="bg-white p-6 rounded-xl border-2 border-black shadow-none printable-area w-full mx-auto" style={{ width: '277mm' }}>
            <div className="text-center border-b-2 border-black pb-4 mb-6">
                <h2 className="text-2xl font-black uppercase tracking-tight leading-none text-center text-primary">{warehouseInfo?.name || "SRI LAKSHMI WAREHOUSE"}</h2>
                <h3 className="text-sm font-black uppercase tracking-widest mt-2 text-center">Voucher Register (Income & Expense History)</h3>
                <p className="text-[10px] text-slate-400 uppercase mt-1 text-center font-bold">Audit Cycle: {financialYear} • Generated: {generatedDate}</p>
            </div>

            <div className="table-scroll-container border-y-2 border-black">
                <Table className="text-[13px]">
                    <TableHeader>
                        <TableRow className="bg-slate-50 border-b-2 border-black h-12">
                            <TableHead className="font-black text-black uppercase text-[10px] py-3 text-center border-r">Date</TableHead>
                            <TableHead className="font-black text-black uppercase text-[10px] py-3 text-center border-r">Ref No</TableHead>
                            <TableHead className="font-black text-black uppercase text-[10px] py-3 text-center border-r">Voucher Type</TableHead>
                            <TableHead className="font-black text-black uppercase text-[10px] py-3 text-center border-r">Category</TableHead>
                            <TableHead className="font-black text-black uppercase text-[10px] py-3 text-center border-r">Description</TableHead>
                            <TableHead className="font-black text-black uppercase text-[10px] py-3 text-right pr-4">Amount (INR)</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {voucherEvents.map((v, i) => (
                            <TableRow key={i} className="h-10 border-b border-slate-100 hover:bg-slate-50/50">
                                <TableCell className="p-1 text-center whitespace-nowrap border-r font-mono">{format(v.date, 'dd/MM/yy')}</TableCell>
                                <TableCell className="p-1 text-center font-mono font-bold text-slate-400 border-r">{v.refNo}</TableCell>
                                <TableCell className="p-1 text-center border-r">
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-tighter ${v.type === 'Income' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                        {v.type}
                                    </span>
                                </TableCell>
                                <TableCell className="p-1 font-bold text-center border-r">{v.category}</TableCell>
                                <TableCell className="p-1 text-slate-600 italic tracking-tight border-r max-w-[300px] text-center">{v.description}</TableCell>
                                <TableCell className={`p-1 text-right font-mono font-black pr-4 ${v.type === 'Income' ? 'text-green-700' : 'text-destructive'}`}>
                                    {v.type === 'Income' ? '' : '-'}{formatCurrency(v.amount)}
                                </TableCell>
                            </TableRow>
                        ))}
                        {voucherEvents.length === 0 && (
                            <TableRow><TableCell colSpan={6} className="text-center py-24 text-muted-foreground italic">No voucher records found for the selected period.</TableCell></TableRow>
                        )}
                    </TableBody>
                    <TableFooter>
                        <TableRow className="bg-slate-50 text-black font-black border-t-2 border-black h-16">
                            <TableCell colSpan={4} className="text-right uppercase text-[10px] tracking-widest pr-6">Ledger Summary Totals</TableCell>
                            <TableCell className="p-2 border-r">
                                <div className="space-y-1 text-xs">
                                    <div className="flex justify-between"><span>Total Inflow (+):</span><span className="text-green-700">{formatCurrency(totals.income)}</span></div>
                                    <div className="flex justify-between"><span>Total Outflow (-):</span><span className="text-destructive">{formatCurrency(totals.expense)}</span></div>
                                </div>
                            </TableCell>
                            <TableCell className="p-2 text-right pr-4">
                                <div className="text-[10px] uppercase text-slate-400 mb-1">Net Voucher Balance</div>
                                <div className={`text-xl font-mono ${totals.income - totals.expense >= 0 ? 'text-primary' : 'text-destructive'}`}>
                                    {formatCurrency(totals.income - totals.expense)}
                                </div>
                            </TableCell>
                        </TableRow>
                    </TableFooter>
                </Table>
            </div>

            <div className="mt-20 flex justify-end">
                <div className="w-72 border-t-2 border-black text-center pt-2">
                    <p className="font-black text-[12px] uppercase tracking-widest text-slate-800 text-center">Authorized Auditor Signature</p>
                </div>
            </div>
        </div>
    );
}
