'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { format, isWithinInterval, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter } from "date-fns";
import type { Customer, StorageRecord, UnloadingRecord, CustomerPayment, WarehouseInfo } from "@/lib/definitions";
import { formatCurrency, toDate } from '@/lib/utils';
import { useDateFilter } from '@/firebase/provider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from '../ui/label';

type SummaryRow = {
    customerId: string;
    customerName: string;
    bagsIn: number;
    bagsOut: number;
    billedAmount: number;
    paidAmount: number;
    pendingAmount: number;
};

const QUARTERS = [
    { label: 'Q1 (Apr - Jun)', value: '1', months: [3, 4, 5] },
    { label: 'Q2 (Jul - Sep)', value: '2', months: [6, 7, 8] },
    { label: 'Q3 (Oct - Dec)', value: '3', months: [9, 10, 11] },
    { label: 'Q4 (Jan - Mar)', value: '4', months: [0, 1, 2] },
];

const MONTHS = [
    { label: 'April', value: '3' }, { label: 'May', value: '4' }, { label: 'June', value: '5' },
    { label: 'July', value: '6' }, { label: 'August', value: '7' }, { label: 'September', value: '8' },
    { label: 'October', value: '9' }, { label: 'November', value: '10' }, { label: 'December', value: '11' },
    { label: 'January', value: '0' }, { label: 'February', value: '1' }, { label: 'March', value: '2' },
];

export function FinancialPeriodSummaryReport({ 
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
    
    const [viewType, setViewType] = useState<'year' | 'quarter' | 'month'>('year');
    const [subPeriod, setSubPeriod] = useState<string>('');

    // Reset sub-period when view type changes
    useEffect(() => {
        if (viewType === 'quarter') setSubPeriod('1');
        else if (viewType === 'month') setSubPeriod('3'); // April
        else setSubPeriod('');
    }, [viewType]);

    const activeRange = useMemo(() => {
        if (viewType === 'year' || financialYear === 'all-time') return globalRange;
        if (!globalRange || !globalRange.from) return globalRange;

        const baseYear = globalRange.from.getFullYear();

        if (viewType === 'month') {
            const monthIdx = parseInt(subPeriod);
            // If month is Jan-Mar, it's the next calendar year of the FY start
            const year = monthIdx <= 2 ? baseYear + 1 : baseYear;
            return {
                from: startOfMonth(new Date(year, monthIdx)),
                to: endOfMonth(new Date(year, monthIdx))
            };
        }

        if (viewType === 'quarter') {
            const quarter = QUARTERS.find(q => q.value === subPeriod);
            if (!quarter) return globalRange;
            const startMonth = quarter.months[0];
            const year = startMonth <= 2 ? baseYear + 1 : baseYear;
            return {
                from: startOfMonth(new Date(year, startMonth)),
                to: endOfMonth(new Date(year, quarter.months[2]))
            };
        }

        return globalRange;
    }, [viewType, subPeriod, globalRange, financialYear]);

    const customerSummaries = useMemo(() => {
        const map: Record<string, SummaryRow> = {};

        const getRow = (id: string) => {
            if (!map[id]) {
                map[id] = {
                    customerId: id,
                    customerName: customers.find(c => c.id === id)?.name || 'Unknown',
                    bagsIn: 0, bagsOut: 0, billedAmount: 0, paidAmount: 0, pendingAmount: 0
                };
            }
            return map[id];
        };

        const inRange = (date: Date) => {
            if (financialYear === 'all-time') return true;
            if (!activeRange || !activeRange.from || !activeRange.to) return true;
            return isWithinInterval(date, { start: activeRange.from, end: activeRange.to });
        };

        records.forEach(r => {
            const row = getRow(r.customerId);
            if (inRange(toDate(r.storageStartDate))) {
                row.bagsIn += (Number(r.bagsIn) || 0);
                row.billedAmount += (Number(r.hamaliPayable) || 0) + (Number(r.khataAmount) || 0);
            }
            (r.outflows || []).forEach(o => {
                if (inRange(toDate(o.date))) {
                    row.bagsOut += (Number(o.bagsWithdrawn) || 0);
                    row.billedAmount += (Number(o.rentBilled) || 0);
                }
            });
            (r.payments || []).forEach(p => {
                if (inRange(toDate(p.date)) && p.type !== 'discount') {
                    row.paidAmount += (Number(p.amount) || 0);
                }
            });
        });

        unloadingRecords.forEach(u => {
            const row = getRow(u.customerId);
            if (inRange(toDate(u.unloadingDate))) {
                row.bagsIn += (Number(u.bagsUnloaded) || 0);
                row.billedAmount += (Number(u.totalHamali) || 0);
            }
            (u.payments || []).forEach(p => {
                if (inRange(toDate(p.date)) && p.type !== 'discount') {
                    row.paidAmount += (Number(p.amount) || 0);
                }
            });
        });

        customerPayments.forEach(cp => {
            const row = getRow(cp.customerId);
            if (inRange(toDate(cp.date)) && !cp.isDiscount) {
                row.paidAmount += (Number(cp.amount) || 0);
            }
        });

        // Account-wide total balance (Real-time snapshot)
        customers.forEach(cust => {
            const row = getRow(cust.id);
            let liab = 0; let paid = 0;
            records.filter(r => r.customerId === cust.id).forEach(r => {
                liab += (Number(r.hamaliPayable) || 0) + (Number(r.totalRentBilled) || 0) + (Number(r.khataAmount) || 0);
                (r.payments || []).forEach(p => paid += (Number(p.amount) || 0));
            });
            unloadingRecords.filter(u => u.customerId === cust.id).forEach(u => {
                const rem = Math.max(0, u.bagsUnloaded - (u.bagsSentToDrying || 0));
                liab += (rem * u.hamaliPerBag);
                (u.payments || []).forEach(p => paid += (Number(p.amount) || 0));
            });
            customerPayments.filter(cp => cp.customerId === cust.id).forEach(cp => paid += (Number(cp.amount) || 0));
            row.pendingAmount = Math.max(0, liab - paid);
        });

        return Object.values(map)
            .filter(r => r.bagsIn > 0 || r.bagsOut > 0 || r.billedAmount > 0 || r.paidAmount > 0 || r.pendingAmount > 0.5)
            .sort((a, b) => a.customerName.localeCompare(b.customerName));
    }, [records, unloadingRecords, customerPayments, customers, activeRange, financialYear]);

    const totals = useMemo(() => {
        return customerSummaries.reduce((acc, r) => {
            acc.bagsIn += r.bagsIn; acc.bagsOut += r.bagsOut;
            acc.billed += r.billedAmount; acc.paid += r.paidAmount;
            acc.pending += r.pendingAmount;
            return acc;
        }, { bagsIn: 0, bagsOut: 0, billed: 0, paid: 0, pending: 0 });
    }, [customerSummaries]);

    const generatedDate = useMemo(() => format(new Date(), 'dd/MM/yy, hh:mm a'), []);

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row items-end gap-4 print-hide bg-slate-50 p-4 rounded-xl border border-primary/10">
                <div className="space-y-1">
                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Report Breakdown</Label>
                    <Select value={viewType} onValueChange={(v: any) => setViewType(v)}>
                        <SelectTrigger className="w-[180px] h-9 font-bold"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="year">Full Year Summary</SelectItem>
                            <SelectItem value="quarter">Quarterly Audit</SelectItem>
                            <SelectItem value="month">Monthly Audit</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                {viewType === 'quarter' && (
                    <div className="space-y-1 animate-in fade-in slide-in-from-left-2">
                        <Label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Select Quarter</Label>
                        <Select value={subPeriod} onValueChange={setSubPeriod}>
                            <SelectTrigger className="w-[180px] h-9 font-bold"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {QUARTERS.map(q => <SelectItem key={q.value} value={q.value}>{q.label}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                )}
                {viewType === 'month' && (
                    <div className="space-y-1 animate-in fade-in slide-in-from-left-2">
                        <Label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Select Month</Label>
                        <Select value={subPeriod} onValueChange={setSubPeriod}>
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
                    <h2 className="text-2xl font-black uppercase tracking-tight leading-none text-center">{warehouseInfo?.name || "SRI LAKSHMI WAREHOUSE"}</h2>
                    <h3 className="text-sm font-black uppercase tracking-widest mt-2 text-primary text-center">
                        Financial & Stock Audit ({viewType.toUpperCase()}: {financialYear})
                        {viewType === 'quarter' && ` - ${QUARTERS.find(q => q.value === subPeriod)?.label}`}
                        {viewType === 'month' && ` - ${MONTHS.find(m => m.value === subPeriod)?.label}`}
                    </h3>
                    <p className="text-[10px] text-slate-400 uppercase mt-1 text-center">Report Audit Token: FSS-{generatedDate}</p>
                </div>

                <div className="table-scroll-container border-y-2 border-black">
                    <Table className="text-[13px]">
                        <TableHeader>
                            <TableRow className="bg-slate-50 border-b-2 border-black">
                                <TableHead className="font-black text-black uppercase text-[10px] py-3 text-center">Customer Name</TableHead>
                                <TableHead className="font-black text-black uppercase text-[10px] py-3 text-center">Bags In</TableHead>
                                <TableHead className="font-black text-black uppercase text-[10px] py-3 text-center">Bags Out</TableHead>
                                <TableHead className="font-black text-black uppercase text-[10px] py-3 text-center">Amount Billed</TableHead>
                                <TableHead className="font-black text-black uppercase text-[10px] py-3 text-center">Amount Paid</TableHead>
                                <TableHead className="font-black text-black uppercase text-[10px] py-3 text-center">Current Total Pending</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {customerSummaries.map((row) => (
                                <TableRow key={row.customerId} className="h-9 border-b border-slate-100 hover:bg-slate-50/50">
                                    <TableCell className="p-1 font-black uppercase tracking-tight text-center">{row.customerName}</TableCell>
                                    <TableCell className="p-1 text-center font-mono font-bold text-green-700">{row.bagsIn || '-'}</TableCell>
                                    <TableCell className="p-1 text-center font-mono font-bold text-orange-600">{row.bagsOut || '-'}</TableCell>
                                    <TableCell className="p-1 text-right font-mono text-center">{row.billedAmount > 0 ? formatCurrency(row.billedAmount) : '-'}</TableCell>
                                    <TableCell className="p-1 text-right font-mono text-green-600 font-bold text-center">{row.paidAmount > 0 ? formatCurrency(row.paidAmount) : '-'}</TableCell>
                                    <TableCell className={`p-1 text-right font-mono font-black text-center ${row.pendingAmount > 0.5 ? 'text-destructive' : 'text-slate-400'}`}>
                                        {formatCurrency(row.pendingAmount)}
                                    </TableCell>
                                </TableRow>
                            ))}
                            {customerSummaries.length === 0 && (
                                <TableRow><TableCell colSpan={6} className="text-center py-20 text-muted-foreground italic">No transactions found for the selected {viewType}.</TableCell></TableRow>
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