'use client';

import React, { useMemo } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { format, isWithinInterval } from "date-fns";
import type { Customer, StorageRecord, UnloadingRecord, CustomerPayment, WarehouseInfo } from "@/lib/definitions";
import { formatCurrency, toDate } from '@/lib/utils';
import { useDateFilter } from '@/firebase/provider';

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
    const { dateRange, financialYear } = useDateFilter();

    const customerSummaries = useMemo(() => {
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

        const inRange = (date: Date) => {
            if (financialYear === 'all-time') return true;
            if (!dateRange || !dateRange.from || !dateRange.to) return true;
            return isWithinInterval(date, { start: dateRange.from, end: dateRange.to });
        };

        // 1. Process Bags In & Inflow Charges
        records.forEach(r => {
            const row = getRow(r.customerId);
            const inflowDate = toDate(r.storageStartDate);
            
            if (inRange(inflowDate)) {
                row.bagsIn += (Number(r.bagsIn) || 0);
                row.billedAmount += (Number(r.hamaliPayable) || 0) + (Number(r.khataAmount) || 0);
            }

            // Bags Out & Rent Billed in Patti
            (r.outflows || []).forEach(o => {
                const oDate = toDate(o.date);
                if (inRange(oDate)) {
                    row.bagsOut += (Number(o.bagsWithdrawn) || 0);
                    row.billedAmount += (Number(o.rentBilled) || 0);
                }
            });

            // Payments
            (r.payments || []).forEach(p => {
                if (inRange(toDate(p.date)) && p.type !== 'discount') {
                    row.paidAmount += (Number(p.amount) || 0);
                }
            });
        });

        // 2. Process Unloading Records
        unloadingRecords.forEach(u => {
            const row = getRow(u.customerId);
            const uDate = toDate(u.unloadingDate);
            
            if (inRange(uDate)) {
                row.bagsIn += (Number(u.bagsUnloaded) || 0);
                row.billedAmount += (Number(u.totalHamali) || 0);
            }

            (u.payments || []).forEach(p => {
                if (inRange(toDate(p.date)) && p.type !== 'discount') {
                    row.paidAmount += (Number(p.amount) || 0);
                }
            });
        });

        // 3. Process Bulk Ledger Payments
        customerPayments.forEach(cp => {
            const row = getRow(cp.customerId);
            if (inRange(toDate(cp.date)) && !cp.isDiscount) {
                row.paidAmount += (Number(cp.amount) || 0);
            }
        });

        // 4. Calculate Current Net Pending (Account Level) - Real time snapshot
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
    }, [records, unloadingRecords, customerPayments, customers, dateRange, financialYear]);

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
            <div className="bg-white p-6 rounded-xl border shadow-sm printable-area">
                <div className="text-center border-b-2 border-black pb-4 mb-6">
                    <h2 className="text-2xl font-black uppercase tracking-tight leading-none text-center">{warehouseInfo?.name || "SRI LAKSHMI WAREHOUSE"}</h2>
                    <h3 className="text-sm font-black uppercase tracking-widest mt-2 text-primary text-center">
                        Financial & Stock Summary {financialYear !== 'all-time' ? `(FY ${financialYear})` : '(All Time)'}
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
                                <TableRow><TableCell colSpan={6} className="text-center py-20 text-muted-foreground italic">No transactions found for the selected range.</TableCell></TableRow>
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