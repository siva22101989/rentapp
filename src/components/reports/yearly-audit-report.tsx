'use client';

import React, { useMemo } from 'react';
import type { Customer, StorageRecord, UnloadingRecord, Expense, WarehouseInfo, OtherIncome, CustomerPayment, Borrowing, Lending } from "@/lib/definitions";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { format } from "date-fns";
import { toDate, formatCurrency } from '@/lib/utils';
import { calculateFinalRent } from '@/lib/billing';
import { useDateFilter } from '@/firebase/provider';

type YearlyAuditProps = {
    records: StorageRecord[];
    unloadingRecords: UnloadingRecord[];
    expenses: Expense[];
    otherIncomes: OtherIncome[];
    customerPayments: CustomerPayment[];
    borrowings: Borrowing[];
    lendings: Lending[];
    warehouseInfo: WarehouseInfo | null;
    title: string;
};

export function YearlyAuditReport({ records, unloadingRecords, expenses, otherIncomes, customerPayments, borrowings, lendings, warehouseInfo, title }: YearlyAuditProps) {
    const { dateRange, financialYear } = useDateFilter();
    const generatedDate = useMemo(() => format(new Date(), 'dd MMM yyyy, hh:mm a'), []);

    const auditData = useMemo(() => {
        if (!dateRange || !dateRange.from) return null;
        
        const start = dateRange.from;
        const end = dateRange.to ? new Date(dateRange.to) : new Date();
        end.setHours(23, 59, 59, 999);

        const inRange = (date: Date) => date >= start && date <= end;

        // --- 1. Physical Stock Audit ---
        let openingStock = 0;
        let periodInflow = 0;
        let periodOutflow = 0;

        records.forEach(r => {
            const inflowDate = toDate(r.storageStartDate);
            const initialBags = Number(r.bagsIn) || 0;
            
            // Bags in before the year started
            if (inflowDate < start) {
                let withdrawnBeforeYear = 0;
                (r.outflows || []).forEach(o => {
                    if (toDate(o.date) < start) withdrawnBeforeYear += Number(o.bagsWithdrawn);
                });
                openingStock += Math.max(0, initialBags - withdrawnBeforeYear);
            }

            // Bags in during the year
            if (inRange(inflowDate)) {
                periodInflow += initialBags;
            }

            // Bags out during the year
            (r.outflows || []).forEach(o => {
                if (inRange(toDate(o.date))) periodOutflow += Number(o.bagsWithdrawn);
            });
        });

        // Unloading records are essentially inflows
        unloadingRecords.forEach(ur => {
            if (inRange(toDate(ur.unloadingDate))) periodInflow += Number(ur.bagsUnloaded);
        });

        const closingStock = openingStock + periodInflow - periodOutflow;

        // --- 2. Financial Audit ---
        const cashIncome = 
            records.flatMap(r => r.payments || []).filter(p => inRange(toDate(p.date)) && p.type !== 'discount').reduce((s, p) => s + p.amount, 0) +
            unloadingRecords.flatMap(r => r.payments || []).filter(p => inRange(toDate(p.date)) && p.type !== 'discount').reduce((s, p) => s + p.amount, 0) +
            customerPayments.filter(p => inRange(toDate(p.date)) && !p.isDiscount).reduce((s, p) => s + p.amount, 0) +
            otherIncomes.filter(i => inRange(toDate(i.date))).reduce((s, i) => s + i.amount, 0);

        const totalDiscounts = 
            records.flatMap(r => r.payments || []).filter(p => inRange(toDate(p.date)) && p.type === 'discount').reduce((s, p) => s + p.amount, 0) +
            unloadingRecords.flatMap(r => r.payments || []).filter(p => inRange(toDate(p.date)) && p.type === 'discount').reduce((s, p) => s + p.amount, 0) +
            customerPayments.filter(p => inRange(toDate(p.date)) && p.isDiscount).reduce((s, p) => s + p.amount, 0) +
            records.flatMap(r => r.outflows || []).filter(o => inRange(toDate(o.date))).reduce((s, o) => s + (o.discount || 0), 0);

        const operationalExpenses = expenses.filter(e => inRange(toDate(e.date))).reduce((s, e) => s + e.amount, 0);

        let capitalInterest = 0;
        const capital = warehouseInfo?.capitalInvestment || 0;
        const rate = warehouseInfo?.annualInterestRate || 0;
        if (capital > 0 && rate > 0) {
            const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
            capitalInterest = (capital * (rate / 100) / 365) * diffDays;
        }

        const netProfit = cashIncome - (operationalExpenses + totalDiscounts + capitalInterest);

        // --- 3. Receivables Audit ---
        const activeRecords = records.filter(r => !r.storageEndDate && r.bagsStored > 0);
        const accruedRent = activeRecords.reduce((total, record) => {
            const { rent } = calculateFinalRent({ ...record, storageStartDate: toDate(record.storageStartDate) }, new Date(), record.bagsStored);
            return total + rent;
        }, 0);

        return {
            openingStock, periodInflow, periodOutflow, closingStock,
            cashIncome, totalDiscounts, operationalExpenses, capitalInterest, netProfit,
            accruedRent,
            totalBorrowed: borrowings.filter(b => b.status !== 'Paid Off').reduce((s, b) => s + b.principal, 0),
            totalLent: lendings.filter(l => l.status !== 'Paid Off').reduce((s, l) => s + l.principal, 0),
            periodStart: start,
            periodEnd: end
        };
    }, [records, unloadingRecords, expenses, otherIncomes, customerPayments, dateRange, warehouseInfo, borrowings, lendings]);

    if (!auditData) {
        return <div className="p-8 text-center text-muted-foreground border-2 border-dashed rounded-xl bg-white">Please select a Financial Year to generate the audit report.</div>;
    }

    return (
        <div className="bg-white p-8 text-black font-sans text-sm border-2 border-black rounded-lg shadow-sm printable-area">
             <div className="text-center border-b-2 border-black pb-4 mb-8">
                <h1 className="text-2xl font-black uppercase tracking-tight leading-none mb-1">{warehouseInfo?.name || "SRI LAKSHMI WAREHOUSE"}</h1>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{warehouseInfo?.addressLine1} {warehouseInfo?.addressLine2}</p>
                <div className="mt-4 py-2 px-10 border-2 border-black inline-block font-black text-xl tracking-[0.1em] uppercase bg-slate-50">
                    Annual Master Audit Report
                </div>
                <p className="text-sm font-black mt-3 text-primary uppercase">Financial Year: {financialYear}</p>
                <p className="text-[10px] text-slate-400 mt-1 uppercase">Generated: {generatedDate}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                {/* SECTION 1: PHYSICAL INVENTORY */}
                <div className="space-y-4">
                    <h3 className="text-xs font-black uppercase tracking-widest bg-slate-100 p-2 border-l-4 border-black text-center">I. Physical Stock Movement (Bags)</h3>
                    <Table>
                        <TableBody>
                            <TableRow className="h-10 border-b border-slate-100">
                                <TableCell className="font-bold text-center">Opening Stock Balance (at start of year)</TableCell>
                                <TableCell className="text-right font-mono font-black text-lg text-center">{auditData.openingStock}</TableCell>
                            </TableRow>
                            <TableRow className="h-10 border-b border-slate-100">
                                <TableCell className="font-bold text-center">Total Annual Inflow (Bags Received)</TableCell>
                                <TableCell className="text-right font-mono font-bold text-green-600 text-center">+ {auditData.periodInflow}</TableCell>
                            </TableRow>
                            <TableRow className="h-10 border-b border-slate-100">
                                <TableCell className="font-bold text-center">Total Annual Outflow (Bags Withdrawn)</TableCell>
                                <TableCell className="text-right font-mono font-bold text-orange-600 text-center">- {auditData.periodOutflow}</TableCell>
                            </TableRow>
                            <TableRow className="h-14 bg-slate-50 border-y-2 border-black font-black">
                                <TableCell className="uppercase text-[11px] text-center">Net Closing Godown Stock</TableCell>
                                <TableCell className="text-right font-mono text-2xl text-primary text-center">{auditData.closingStock}</TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                </div>

                {/* SECTION 2: FINANCIAL PERFORMANCE */}
                <div className="space-y-4">
                    <h3 className="text-xs font-black uppercase tracking-widest bg-slate-100 p-2 border-l-4 border-black text-center">II. Annual Profit & Loss (INR)</h3>
                    <Table>
                        <TableBody>
                            <TableRow className="h-10 border-b border-slate-100">
                                <TableCell className="font-bold text-center">Total Realized Cash Income</TableCell>
                                <TableCell className="text-right font-mono font-bold text-green-600 text-center">{formatCurrency(auditData.cashIncome)}</TableCell>
                            </TableRow>
                            <TableRow className="h-10 border-b border-slate-100">
                                <TableCell className="font-bold text-center">Total Operational Expenses</TableCell>
                                <TableCell className="text-right font-mono text-destructive text-center">({formatCurrency(auditData.operationalExpenses)})</TableCell>
                            </TableRow>
                            <TableRow className="h-10 border-b border-slate-100">
                                <TableCell className="font-bold text-center">Total Discounts & Waivers (Loss)</TableCell>
                                <TableCell className="text-right font-mono text-destructive text-center">({formatCurrency(auditData.totalDiscounts)})</TableCell>
                            </TableRow>
                            {auditData.capitalInterest > 0 && (
                                <TableRow className="h-10 border-b border-slate-100 italic">
                                    <TableCell className="font-medium text-slate-500 text-center">Interest on Capital ({warehouseInfo?.annualInterestRate}%)</TableCell>
                                    <TableCell className="text-right font-mono text-slate-400 text-center">({formatCurrency(auditData.capitalInterest)})</TableCell>
                                </TableRow>
                            )}
                            <TableRow className="h-14 bg-slate-50 border-y-2 border-black font-black">
                                <TableCell className="uppercase text-[11px] text-center">Final Net Profit for Year</TableCell>
                                <TableCell className={`text-right font-mono text-2xl text-center ${auditData.netProfit >= 0 ? 'text-green-700' : 'text-destructive'}`}>
                                    {formatCurrency(auditData.netProfit)}
                                </TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                </div>
            </div>

            {/* SECTION 3: UNREALIZED ASSETS & LIABILITIES */}
            <div className="mt-12">
                 <h3 className="text-xs font-black uppercase tracking-widest bg-slate-100 p-2 border-l-4 border-black mb-4 text-center">III. Current Liquidity & Asset Snapshot</h3>
                 <div className="grid grid-cols-3 gap-6">
                    <div className="p-4 border rounded-xl bg-blue-50/30 text-center space-y-1">
                        <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Accrued Rent (Asset)</p>
                        <p className="text-xl font-black text-blue-700 font-mono">{formatCurrency(auditData.accruedRent)}</p>
                        <p className="text-[9px] text-slate-400 italic">Rent value of bags currently in Godown.</p>
                    </div>
                    <div className="p-4 border rounded-xl bg-emerald-50/30 text-center space-y-1">
                        <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Total Lent Principal</p>
                        <p className="text-xl font-black text-emerald-700 font-mono">{formatCurrency(auditData.totalLent)}</p>
                        <p className="text-[9px] text-slate-400 italic">Current outstanding loans given.</p>
                    </div>
                    <div className="p-4 border rounded-xl bg-red-50/30 text-center space-y-1">
                        <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Total Borrowed Principal</p>
                        <p className="text-xl font-black text-destructive font-mono">{formatCurrency(auditData.totalBorrowed)}</p>
                        <p className="text-[9px] text-slate-400 italic">Current outstanding loans taken.</p>
                    </div>
                 </div>
            </div>

            {/* SIGNATURES */}
            <div className="mt-32 flex justify-between">
                <div className="w-64 border-t-2 border-black text-center pt-2">
                    <p className="font-black text-[12px] uppercase tracking-widest text-slate-800">Internal Auditor</p>
                    <p className="text-[10px] text-slate-400 uppercase mt-1">Warehouse Division</p>
                </div>
                <div className="w-80 border-t-2 border-black text-center pt-2">
                    <p className="font-black text-[12px] uppercase tracking-widest text-slate-800">Authorized Manager / Owner</p>
                    <p className="text-[10px] text-slate-400 uppercase mt-1">{warehouseInfo?.name}</p>
                </div>
            </div>

            <div className="mt-16 pt-6 text-[9px] text-slate-400 italic text-center border-t border-slate-100">
                <p>This document constitutes a formal business audit for the period of {financialYear}.</p>
                <p>Digital Audit Token: YR-{financialYear.replace('-', '')}-{format(new Date(), 'yyyyMMdd')}</p>
            </div>
        </div>
    );
}
