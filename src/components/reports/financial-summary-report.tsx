'use client';

import React, { useMemo, useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { format, isWithinInterval, startOfMonth, endOfMonth } from "date-fns";
import type { Customer, StorageRecord, UnloadingRecord, CustomerPayment, WarehouseInfo } from "@/lib/definitions";
import { formatCurrency, toDate } from '@/lib/utils';
import { useDateFilter } from '@/firebase/provider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from '../ui/label';

const MONTHS = [
    { label: 'April', value: '3' }, { label: 'May', value: '4' }, { label: 'June', value: '5' },
    { label: 'July', value: '6' }, { label: 'August', value: '7' }, { label: 'September', value: '8' },
    { label: 'October', value: '9' }, { label: 'November', value: '10' }, { label: 'December', value: '11' },
    { label: 'January', value: '0' }, { label: 'February', value: '1' }, { label: 'March', value: '2' },
];

export function FinancialSummaryReport({ 
    records, 
    customers, 
    unloadingRecords, 
    customerPayments = [],
    warehouseInfo 
}: { 
    records: StorageRecord[], 
    customers: Customer[], 
    unloadingRecords: UnloadingRecord[], 
    customerPayments: CustomerPayment[],
    warehouseInfo: WarehouseInfo | null 
}) {
    const { dateRange: globalRange, financialYear } = useDateFilter();
    
    const [breakdownType, setBreakdownType] = useState<'year' | 'month'>('year');
    const [selectedMonth, setSelectedMonth] = useState<string>(new Date().getMonth().toString());

    const activeRange = useMemo(() => {
        if (breakdownType === 'year' || financialYear === 'all-time') return globalRange;
        if (!globalRange || !globalRange.from) return globalRange;

        const baseYear = globalRange.from.getFullYear();
        const monthIdx = parseInt(selectedMonth);
        // Financial year logic: months 0-2 (Jan-Mar) are in the calendar year following the FY start year
        const year = monthIdx <= 2 ? baseYear + 1 : baseYear;
        
        return {
            from: startOfMonth(new Date(year, monthIdx)),
            to: endOfMonth(new Date(year, monthIdx))
        };
    }, [breakdownType, selectedMonth, globalRange, financialYear]);

    const customerSummaries = useMemo(() => {
        const map: Record<string, any> = {};

        const getRow = (id: string) => {
            if (!map[id]) {
                map[id] = {
                    customerId: id,
                    customerName: customers.find(c => c.id === id)?.name || 'Unknown',
                    bagsIn: 0, bagsOut: 0, billed: 0, paid: 0, balance: 0
                };
            }
            return map[id];
        };

        const inRange = (date: Date) => {
            if (financialYear === 'all-time') return true;
            if (!activeRange || !activeRange.from || !activeRange.to) return true;
            const d = toDate(date);
            return d >= activeRange.from && d <= activeRange.to;
        };

        // 1. Process Storage Records (Inflow activity in range)
        records.forEach(r => {
            const row = getRow(r.customerId);
            const inflowDate = toDate(r.storageStartDate);
            
            if (inRange(inflowDate)) {
                row.bagsIn += (Number(r.bagsIn) || 0);
                row.billed += (Number(r.hamaliPayable) || 0) + (Number(r.khataAmount) || 0);
            }

            // Withdrawals (Outflow activity in range)
            (r.outflows || []).forEach(o => {
                if (inRange(toDate(o.date))) {
                    row.bagsOut += (Number(o.bagsWithdrawn) || 0);
                    row.billed += (Number(o.rentBilled) || 0);
                }
            });

            // Payments (Cash activity in range)
            (r.payments || []).forEach(p => {
                if (inRange(toDate(p.date))) {
                    if (p.type === 'discount') {
                        // Discounts act as credits to the balance but are not cash paid
                        row.paid += (Number(p.amount) || 0);
                    } else {
                        row.paid += (Number(p.amount) || 0);
                    }
                }
            });
        });

        // 2. Process Unloading Records (Activity in range)
        unloadingRecords.forEach(u => {
            const row = getRow(u.customerId);
            if (inRange(toDate(u.unloadingDate))) {
                row.bagsIn += (Number(u.bagsUnloaded) || 0);
                row.billed += (Number(u.totalHamali) || 0);
            }
            (u.payments || []).forEach(p => {
                if (inRange(toDate(p.date))) {
                    row.paid += (Number(p.amount) || 0);
                }
            });
        });

        // 3. Process Bulk Ledger (Cash activity in range)
        customerPayments.forEach(cp => {
            const row = getRow(cp.customerId);
            if (inRange(toDate(cp.date))) {
                row.paid += (Number(cp.amount) || 0);
            }
        });

        return Object.values(map)
            .map(row => ({
                ...row,
                balance: row.billed - row.paid
            }))
            // Filter strictly: only show customers who actually had movement or money flow in this specific period
            .filter(r => Math.abs(r.bagsIn) > 0 || Math.abs(r.bagsOut) > 0 || Math.abs(r.billed) > 0.5 || Math.abs(r.paid) > 0.5)
            .sort((a, b) => a.customerName.localeCompare(b.customerName));
    }, [records, unloadingRecords, customerPayments, customers, activeRange, financialYear]);

    const totals = useMemo(() => {
        return customerSummaries.reduce((acc, r) => {
            acc.bagsIn += r.bagsIn; acc.bagsOut += r.bagsOut;
            acc.billed += r.billed; acc.paid += r.paid;
            acc.balance += r.balance;
            return acc;
        }, { bagsIn: 0, bagsOut: 0, billed: 0, paid: 0, balance: 0 });
    }, [customerSummaries]);

    const generatedDate = useMemo(() => format(new Date(), 'dd/MM/yy, hh:mm a'), []);

    const periodLabel = useMemo(() => {
        if (breakdownType === 'year') return `Financial Year ${financialYear}`;
        const month = MONTHS.find(m => m.value === selectedMonth)?.label;
        return `${month} ${financialYear}`;
    }, [breakdownType, selectedMonth, financialYear]);

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row items-end gap-4 print-hide bg-slate-50 p-4 rounded-xl border border-primary/10">
                <div className="space-y-1">
                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Audit Scope</Label>
                    <Select value={breakdownType} onValueChange={(v: any) => setBreakdownType(v)}>
                        <SelectTrigger className="w-[180px] h-9 font-bold"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="year">Full Year Scope</SelectItem>
                            <SelectItem value="month">Specific Month Audit</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                {breakdownType === 'month' && (
                    <div className="space-y-1 animate-in fade-in slide-in-from-left-2">
                        <Label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Select Month</Label>
                        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                            <SelectTrigger className="w-[180px] h-9 font-bold"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {MONTHS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                )}
            </div>

            <div className="bg-white p-6 rounded-xl border shadow-sm printable-area">
                <div className="text-center border-b-2 border-black pb-4 mb-6">
                    <h2 className="text-2xl font-black uppercase tracking-tight leading-none text-center text-primary">{warehouseInfo?.name || "SRI LAKSHMI WAREHOUSE"}</h2>
                    <h3 className="text-sm font-black uppercase tracking-widest mt-2 text-center">
                        Periodic Financial & Stock Audit
                    </h3>
                    <p className="text-xs font-bold text-slate-600 mt-1 uppercase text-center">Period: {periodLabel}</p>
                    <p className="text-[10px] text-slate-400 uppercase mt-1 text-center italic">Report includes ONLY transactions occurring within the selected dates.</p>
                </div>

                <div className="table-scroll-container border-y-2 border-black">
                    <Table className="text-[13px]">
                        <TableHeader>
                            <TableRow className="bg-slate-50 border-b-2 border-black h-12">
                                <TableHead className="font-black text-black uppercase text-[10px] py-3 text-center">Customer Name</TableHead>
                                <TableHead className="font-black text-black uppercase text-[10px] py-3 text-center">Bags In</TableHead>
                                <TableHead className="font-black text-black uppercase text-[10px] py-3 text-center">Bags Out</TableHead>
                                <TableHead className="font-black text-black uppercase text-[10px] py-3 text-center">Billed (Period)</TableHead>
                                <TableHead className="font-black text-black uppercase text-[10px] py-3 text-center">Paid/Credit (Period)</TableHead>
                                <TableHead className="font-black text-black uppercase text-[10px] py-3 text-center">Period Balance</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {customerSummaries.map((row) => (
                                <TableRow key={row.customerId} className="h-10 border-b border-slate-100 hover:bg-slate-50/50">
                                    <TableCell className="p-1 font-black uppercase tracking-tight text-center">{row.customerName}</TableCell>
                                    <TableCell className="p-1 text-center font-mono font-bold text-green-700">{row.bagsIn || '-'}</TableCell>
                                    <TableCell className="p-1 text-center font-mono font-bold text-orange-600">{row.bagsOut || '-'}</TableCell>
                                    <TableCell className="p-1 text-right font-mono text-center">{row.billed > 0 ? formatCurrency(row.billed) : '-'}</TableCell>
                                    <TableCell className="p-1 text-right font-mono text-green-600 font-bold text-center">{row.paid > 0 ? formatCurrency(row.paid) : '-'}</TableCell>
                                    <TableCell className={`p-1 text-right font-mono font-black text-center ${row.balance > 0.5 ? 'text-destructive' : (row.balance < -0.5 ? 'text-green-700' : 'text-slate-300')}`}>
                                        {formatCurrency(row.balance)}
                                    </TableCell>
                                </TableRow>
                            ))}
                            {customerSummaries.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-24 text-muted-foreground italic font-medium">
                                        No transactions recorded for the selected period.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                        <TableFooter>
                            <TableRow className="bg-slate-50 text-black font-black border-t-2 border-black h-14">
                                <TableCell className="text-right uppercase text-[10px] tracking-widest pr-4">Grand Audit Totals</TableCell>
                                <TableCell className="text-center font-mono text-base text-green-700">{totals.bagsIn}</TableCell>
                                <TableCell className="text-center font-mono text-base text-orange-600">{totals.bagsOut}</TableCell>
                                <TableCell className="text-right font-mono text-center">{formatCurrency(totals.billed)}</TableCell>
                                <TableCell className="text-right font-mono text-green-700 text-center">{formatCurrency(totals.paid)}</TableCell>
                                <TableCell className={`text-right font-mono text-lg text-center ${totals.balance > 0 ? 'text-destructive' : 'text-green-800'}`}>
                                    {formatCurrency(totals.balance)}
                                </TableCell>
                            </TableRow>
                        </TableFooter>
                    </Table>
                </div>

                <div className="mt-20 flex flex-col md:flex-row justify-between gap-12">
                    <div className="flex-1 text-[11px] text-slate-400 space-y-1">
                        <p><strong>Note:</strong> This report represents activity ONLY within the chosen timeframe.</p>
                        <p><strong>Period Balance:</strong> Positive means money owed from this period. Negative means advance/excess payment in this period.</p>
                        <p><strong>Generated on:</strong> {generatedDate}</p>
                    </div>
                    <div className="w-72 border-t-2 border-black text-center pt-2 shrink-0">
                        <p className="font-black text-[12px] uppercase tracking-widest text-slate-800 text-center">Authorized Manager Signature</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
