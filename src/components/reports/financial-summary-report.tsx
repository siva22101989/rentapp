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
    const [selectedMonth, setSelectedMonth] = useState<string>('3'); // Default to April

    const activeRange = useMemo(() => {
        if (breakdownType === 'year' || financialYear === 'all-time') return globalRange;
        if (!globalRange || !globalRange.from) return globalRange;

        const baseYear = globalRange.from.getFullYear();
        const monthIdx = parseInt(selectedMonth);
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
                    bagsIn: 0, bagsOut: 0, billed: 0, paid: 0, pending: 0
                };
            }
            return map[id];
        };

        const inRange = (date: Date) => {
            if (financialYear === 'all-time') return true;
            if (!activeRange || !activeRange.from || !activeRange.to) return true;
            return isWithinInterval(date, { start: activeRange.from, end: activeRange.to });
        };

        // 1. Process Period-specific movements
        records.forEach(r => {
            const row = getRow(r.customerId);
            if (inRange(toDate(r.storageStartDate))) {
                row.bagsIn += (Number(r.bagsIn) || 0);
                row.billed += (Number(r.hamaliPayable) || 0) + (Number(r.khataAmount) || 0);
            }
            (r.outflows || []).forEach(o => {
                if (inRange(toDate(o.date))) {
                    row.bagsOut += (Number(o.bagsWithdrawn) || 0);
                    row.billed += (Number(o.rentBilled) || 0);
                }
            });
            (r.payments || []).forEach(p => {
                if (inRange(toDate(p.date)) && p.type !== 'discount') {
                    row.paid += (Number(p.amount) || 0);
                }
            });
        });

        unloadingRecords.forEach(u => {
            const row = getRow(u.customerId);
            if (inRange(toDate(u.unloadingDate))) {
                row.bagsIn += (Number(u.bagsUnloaded) || 0);
                row.billed += (Number(u.totalHamali) || 0);
            }
            (u.payments || []).forEach(p => {
                if (inRange(toDate(p.date)) && p.type !== 'discount') {
                    row.paid += (Number(p.amount) || 0);
                }
            });
        });

        customerPayments.forEach(cp => {
            const row = getRow(cp.customerId);
            if (inRange(toDate(cp.date)) && !cp.isDiscount) {
                row.paid += (Number(cp.amount) || 0);
            }
        });

        // 2. Account-wide total balance (Current State)
        customers.forEach(cust => {
            const row = getRow(cust.id);
            let totalLiab = 0; let totalPaid = 0;
            records.filter(r => r.customerId === cust.id).forEach(r => {
                totalLiab += (Number(r.hamaliPayable) || 0) + (Number(r.totalRentBilled) || 0) + (Number(r.khataAmount) || 0);
                (r.payments || []).forEach(p => totalPaid += (Number(p.amount) || 0));
            });
            unloadingRecords.filter(u => u.customerId === cust.id).forEach(u => {
                const rem = Math.max(0, (u.bagsUnloaded || 0) - (u.bagsSentToDrying || 0));
                totalLiab += rem * (u.hamaliPerBag || 0);
                (u.payments || []).forEach(p => totalPaid += (Number(p.amount) || 0));
            });
            customerPayments.filter(cp => cp.customerId === cust.id).forEach(cp => totalPaid += (Number(cp.amount) || 0));
            row.pending = Math.max(0, totalLiab - totalPaid);
        });

        return Object.values(map)
            .filter(r => r.bagsIn > 0 || r.bagsOut > 0 || r.billed > 0 || r.paid > 0 || r.pending > 0.5)
            .sort((a, b) => a.customerName.localeCompare(b.customerName));
    }, [records, unloadingRecords, customerPayments, customers, activeRange, financialYear]);

    const totals = useMemo(() => {
        return customerSummaries.reduce((acc, r) => {
            acc.bagsIn += r.bagsIn; acc.bagsOut += r.bagsOut;
            acc.billed += r.billed; acc.paid += r.paid;
            acc.pending += r.pending;
            return acc;
        }, { bagsIn: 0, bagsOut: 0, billed: 0, paid: 0, pending: 0 });
    }, [customerSummaries]);

    const generatedDate = useMemo(() => format(new Date(), 'dd/MM/yy, hh:mm a'), []);

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row items-end gap-4 print-hide bg-slate-50 p-4 rounded-xl border border-primary/10">
                <div className="space-y-1">
                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Report Granularity</Label>
                    <Select value={breakdownType} onValueChange={(v: any) => setBreakdownType(v)}>
                        <SelectTrigger className="w-[180px] h-9 font-bold"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="year">Full Year Summary</SelectItem>
                            <SelectItem value="month">Monthly Audit</SelectItem>
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
                        Financial & Stock Summary Report ({breakdownType === 'year' ? financialYear : MONTHS.find(m => m.value === selectedMonth)?.label + ' ' + financialYear})
                    </h3>
                    <p className="text-[10px] text-slate-400 uppercase mt-1 text-center">Report Audit Token: FSR-{generatedDate}</p>
                </div>

                <div className="table-scroll-container border-y-2 border-black">
                    <Table className="text-[13px]">
                        <TableHeader>
                            <TableRow className="bg-slate-50 border-b-2 border-black">
                                <TableHead className="font-black text-black uppercase text-[10px] py-3 text-center">Customer Name</TableHead>
                                <TableHead className="font-black text-black uppercase text-[10px] py-3 text-center">Bags In</TableHead>
                                <TableHead className="font-black text-black uppercase text-[10px] py-3 text-center">Bags Out</TableHead>
                                <TableHead className="font-black text-black uppercase text-[10px] py-3 text-center">Total Billed (Period)</TableHead>
                                <TableHead className="font-black text-black uppercase text-[10px] py-3 text-center">Total Paid (Period)</TableHead>
                                <TableHead className="font-black text-black uppercase text-[10px] py-3 text-center">Current Total Pending</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {customerSummaries.map((row) => (
                                <TableRow key={row.customerId} className="h-9 border-b border-slate-100 hover:bg-slate-50/50">
                                    <TableCell className="p-1 font-black uppercase tracking-tight text-center">{row.customerName}</TableCell>
                                    <TableCell className="p-1 text-center font-mono font-bold text-green-700">{row.bagsIn || '-'}</TableCell>
                                    <TableCell className="p-1 text-center font-mono font-bold text-orange-600">{row.bagsOut || '-'}</TableCell>
                                    <TableCell className="p-1 text-right font-mono text-center">{row.billed > 0 ? formatCurrency(row.billed) : '-'}</TableCell>
                                    <TableCell className="p-1 text-right font-mono text-green-600 font-bold text-center">{row.paid > 0 ? formatCurrency(row.paid) : '-'}</TableCell>
                                    <TableCell className={`p-1 text-right font-mono font-black text-center ${row.pending > 0.5 ? 'text-destructive' : 'text-slate-400'}`}>
                                        {formatCurrency(row.pending)}
                                    </TableCell>
                                </TableRow>
                            ))}
                            {customerSummaries.length === 0 && (
                                <TableRow><TableCell colSpan={6} className="text-center py-20 text-muted-foreground italic">No transactions recorded for the selected period.</TableCell></TableRow>
                            )}
                        </TableBody>
                        <TableFooter>
                            <TableRow className="bg-slate-50 text-black font-black border-t-2 border-black h-12">
                                <TableCell className="text-right uppercase text-[10px] tracking-widest pr-4">Grand Summary Totals</TableCell>
                                <TableCell className="text-center font-mono text-base text-green-700">{totals.bagsIn}</TableCell>
                                <TableCell className="text-center font-mono text-base text-orange-600">{totals.bagsOut}</TableCell>
                                <TableCell className="text-right font-mono text-center">{formatCurrency(totals.billed)}</TableCell>
                                <TableCell className="text-right font-mono text-green-700 text-center">{formatCurrency(totals.paid)}</TableCell>
                                <TableCell className="text-right font-mono text-destructive text-lg text-center">{formatCurrency(totals.pending)}</TableCell>
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
        </div>
    );
}