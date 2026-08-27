'use client';

import React, { useState, useMemo } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { format, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear, isWithinInterval, subMonths } from "date-fns";
import type { Customer, StorageRecord, UnloadingRecord, CustomerPayment, WarehouseInfo } from "@/lib/definitions";
import { formatCurrency, toDate } from '@/lib/utils';
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
    const [periodType, setPeriodType] = useState<'monthly' | 'quarterly' | 'yearly'>('monthly');
    const [selectedOffset, setSelectedOffset] = useState('0'); // 0 = current, 1 = previous...

    const periodRange = useMemo(() => {
        const now = new Date();
        const offset = parseInt(selectedOffset, 10);
        let start: Date;
        let end: Date;

        if (periodType === 'monthly') {
            const target = subMonths(now, offset);
            start = startOfMonth(target);
            end = endOfMonth(target);
        } else if (periodType === 'quarterly') {
            const target = subMonths(now, offset * 3);
            start = startOfQuarter(target);
            end = endOfQuarter(target);
        } else {
            const target = subMonths(now, offset * 12);
            start = startOfYear(target);
            end = endOfYear(target);
        }

        return { start, end };
    }, [periodType, selectedOffset]);

    const customerSummaries = useMemo(() => {
        const { start, end } = periodRange;
        const map: Record<string, SummaryRow> = {};

        const getRow = (id: string) => {
            if (!map[id]) {
                map[id] = {
                    customerId: id,
                    customerName: customers.find(c => c.id === id)?.name || 'Unknown',
                    bagsIn: 0,
                    bagsOut: 0,
                    billedAmount: 0,
                    paidAmount: 0,
                    pendingAmount: 0
                };
            }
            return map[id];
        };

        // 1. Process Bags In & Inflow Charges
        records.forEach(r => {
            const row = getRow(r.customerId);
            const inflowDate = toDate(r.storageStartDate);
            
            if (isWithinInterval(inflowDate, { start, end })) {
                row.bagsIn += (Number(r.bagsIn) || 0);
                row.billedAmount += (Number(r.hamaliPayable) || 0) + (Number(r.khataAmount) || 0);
            }

            // Bags Out & Rent Billed in Patti
            (r.outflows || []).forEach(o => {
                const oDate = toDate(o.date);
                if (isWithinInterval(oDate, { start, end })) {
                    row.bagsOut += (Number(o.bagsWithdrawn) || 0);
                    row.billedAmount += (Number(o.rentBilled) || 0);
                }
            });

            // Payments
            (r.payments || []).forEach(p => {
                if (isWithinInterval(toDate(p.date), { start, end }) && p.type !== 'discount') {
                    row.paidAmount += (Number(p.amount) || 0);
                }
            });
        });

        // 2. Process Unloading Records
        unloadingRecords.forEach(u => {
            const row = getRow(u.customerId);
            const uDate = toDate(u.unloadingDate);
            
            if (isWithinInterval(uDate, { start, end })) {
                row.bagsIn += (Number(u.bagsUnloaded) || 0);
                row.billedAmount += (Number(u.totalHamali) || 0);
            }

            (u.payments || []).forEach(p => {
                if (isWithinInterval(toDate(p.date), { start, end }) && p.type !== 'discount') {
                    row.paidAmount += (Number(p.amount) || 0);
                }
            });
        });

        // 3. Process Bulk Ledger Payments
        customerPayments.forEach(cp => {
            const row = getRow(cp.customerId);
            if (isWithinInterval(toDate(cp.date), { start, end }) && !cp.isDiscount) {
                row.paidAmount += (Number(cp.amount) || 0);
            }
        });

        // 4. Calculate Current Net Pending (Account Level)
        // Note: Pending is usually a real-time snapshot, not period-bound
        customers.forEach(cust => {
            const row = getRow(cust.id);
            let totalLiability = 0;
            let totalPaid = 0;

            records.filter(r => r.customerId === cust.id).forEach(r => {
                totalLiability += (Number(r.hamaliPayable) || 0) + (Number(r.totalRentBilled) || 0) + (Number(r.khataAmount) || 0);
                (r.payments || []).forEach(p => totalPaid += (Number(p.amount) || 0));
            });

            unloadingRecords.filter(u => u.customerId === cust.id).forEach(u => {
                const remaining = Math.max(0, u.bagsUnloaded - (u.bagsSentToDrying || 0));
                totalLiability += (remaining * u.hamaliPerBag);
                (u.payments || []).forEach(p => totalPaid += (Number(p.amount) || 0));
            });

            customerPayments.filter(cp => cp.customerId === cust.id).forEach(cp => totalPaid += (Number(cp.amount) || 0));
            row.pendingAmount = Math.max(0, totalLiability - totalPaid);
        });

        return Object.values(map)
            .filter(r => r.bagsIn > 0 || r.bagsOut > 0 || r.billedAmount > 0 || r.paidAmount > 0 || r.pendingAmount > 0.5)
            .sort((a, b) => a.customerName.localeCompare(b.customerName));
    }, [records, unloadingRecords, customerPayments, customers, periodRange]);

    const totals = useMemo(() => {
        return customerSummaries.reduce((acc, r) => {
            acc.bagsIn += r.bagsIn;
            acc.bagsOut += r.bagsOut;
            acc.billed += r.billedAmount;
            acc.paid += r.paidAmount;
            acc.pending += r.pendingAmount;
            return acc;
        }, { bagsIn: 0, bagsOut: 0, billed: 0, paid: 0, pending: 0 });
    }, [customerSummaries]);

    const generatedDate = useMemo(() => format(new Date(), 'dd/MM/yy, hh:mm a'), []);

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-end gap-4 print-hide bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div className="space-y-1">
                    <Label className="text-[10px] font-black uppercase text-slate-400">Period Type</Label>
                    <Select onValueChange={(v: any) => { setPeriodType(v); setSelectedOffset('0'); }} value={periodType}>
                        <SelectTrigger className="w-[160px] h-9 font-bold"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="monthly">Monthly</SelectItem>
                            <SelectItem value="quarterly">Quarterly</SelectItem>
                            <SelectItem value="yearly">Yearly</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-1">
                    <Label className="text-[10px] font-black uppercase text-slate-400">Select Period</Label>
                    <Select onValueChange={setSelectedOffset} value={selectedOffset}>
                        <SelectTrigger className="w-[200px] h-9 font-bold"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="0">Current Period</SelectItem>
                            <SelectItem value="1">1 Period Ago</SelectItem>
                            <SelectItem value="2">2 Periods Ago</SelectItem>
                            <SelectItem value="3">3 Periods Ago</SelectItem>
                            <SelectItem value="4">4 Periods Ago</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="bg-white p-6 rounded-xl border shadow-sm printable-area">
                <div className="text-center border-b-2 border-black pb-4 mb-6">
                    <h2 className="text-2xl font-black uppercase tracking-tight leading-none text-center">{warehouseInfo?.name || "SRI LAKSHMI WAREHOUSE"}</h2>
                    <h3 className="text-sm font-black uppercase tracking-widest mt-2 text-primary text-center">
                        Financial & Stock Summary: {format(periodRange.start, 'dd MMM yy')} — {format(periodRange.end, 'dd MMM yy')}
                    </h3>
                    <p className="text-[10px] text-slate-400 uppercase mt-1 text-center">Audit Token: FSS-{periodType.toUpperCase()}-{generatedDate}</p>
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
                                <TableHead className="font-black text-black uppercase text-[10px] py-3 text-center">Current Pending</TableHead>
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
                                <TableRow><TableCell colSpan={6} className="text-center py-20 text-muted-foreground italic">No transactions found for this period.</TableCell></TableRow>
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
