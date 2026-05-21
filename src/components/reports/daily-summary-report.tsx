
'use client';

import React, { useState, useMemo } from 'react';
import type { Customer, StorageRecord, UnloadingRecord, Expense, Payment, OtherIncome } from "@/lib/definitions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TrendingUp, TrendingDown, Scale, ArrowDownToDot, ArrowUpFromDot, Search } from 'lucide-react';
import { toDate, formatCurrency } from '@/lib/utils';
import { format, isSameDay } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type DailyData = {
    inflows: StorageRecord[];
    outflows: (StorageRecord & { bagsWithdrawn: number; rentBilled: number; outflowDate: Date })[];
    unloadings: UnloadingRecord[];
    payments: (Payment & { customerName: string; recordId: string; description: string; })[];
    expenses: Expense[];
    otherIncomes: OtherIncome[];
    summary: {
        totalIncome: number;
        totalExpenses: number;
        netBalance: number;
        totalInflowBags: number;
        totalOutflowBags: number;
    }
}

const DailySummaryContent = ({ dailyData, selectedDate }: { dailyData: DailyData, selectedDate: Date }) => {
    const timestamp = useMemo(() => format(new Date(), 'dd/MM/yyyy, hh:mm a'), []);

    return (
        <div className="p-4 space-y-8 text-black">
            <div className="mb-6 text-center border-b pb-4">
                <h2 className="text-2xl font-black uppercase tracking-tight">SRI LAKSHMI WAREHOUSE</h2>
                <h3 className="font-bold uppercase text-slate-500 tracking-widest text-[14px]">Daily Operations Audit</h3>
                <p className="text-[13px] font-bold mt-1 text-primary">{format(selectedDate, 'EEEE, dd MMMM yyyy')}</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                <Card className="shadow-sm border-slate-200">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 p-2">
                        <CardTitle className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Income</CardTitle>
                        <TrendingUp className="h-3 w-3 text-green-500" />
                    </CardHeader>
                    <CardContent className="p-2 pt-0">
                        <div className="text-lg font-black text-green-600">{formatCurrency(dailyData.summary.totalIncome)}</div>
                    </CardContent>
                </Card>
                <Card className="shadow-sm border-slate-200">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 p-2">
                        <CardTitle className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Expenses</CardTitle>
                        <TrendingDown className="h-3 w-3 text-red-500" />
                    </CardHeader>
                    <CardContent className="p-2 pt-0">
                        <div className="text-lg font-black text-destructive">{formatCurrency(dailyData.summary.totalExpenses)}</div>
                    </CardContent>
                </Card>
                <Card className="shadow-sm border-slate-200">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 p-2">
                        <CardTitle className="text-[10px] font-black uppercase tracking-wider text-slate-400">Day Balance</CardTitle>
                        <Scale className="h-3 w-3 text-blue-500" />
                    </CardHeader>
                    <CardContent className="p-2 pt-0">
                        <div className={`text-lg font-black ${dailyData.summary.netBalance >= 0 ? 'text-primary' : 'text-destructive'}`}>{formatCurrency(dailyData.summary.netBalance)}</div>
                    </CardContent>
                </Card>
                <Card className="shadow-sm border-slate-200">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 p-2">
                        <CardTitle className="text-[10px] font-black uppercase tracking-wider text-slate-400">Bags In</CardTitle>
                        <ArrowDownToDot className="h-3 w-3 text-sky-500" />
                    </CardHeader>
                    <CardContent className="p-2 pt-0">
                         <div className="text-lg font-black text-slate-800">{dailyData.summary.totalInflowBags}</div>
                    </CardContent>
                </Card>
                <Card className="shadow-sm border-slate-200">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 p-2">
                        <CardTitle className="text-[10px] font-black uppercase tracking-wider text-slate-400">Bags Out</CardTitle>
                        <ArrowUpFromDot className="h-3 w-3 text-orange-500" />
                    </CardHeader>
                    <CardContent className="p-2 pt-0">
                         <div className="text-lg font-black text-slate-800">{dailyData.summary.totalOutflowBags}</div>
                    </CardContent>
                </Card>
            </div>

            {/* Detailed Transaction Tables */}
            <div className="space-y-6 text-[13px]">
                {dailyData.payments.length > 0 && (
                    <div className="space-y-2">
                        <h4 className="text-[10px] font-black uppercase text-slate-500 border-l-4 border-green-500 pl-2">Cash Receipts (Income)</h4>
                        <Table className="border border-slate-100 text-[13px]">
                            <TableHeader className="bg-slate-50">
                                <TableRow className="h-7">
                                    <TableHead className="font-bold py-1">Customer</TableHead>
                                    <TableHead className="font-bold py-1">Description</TableHead>
                                    <TableHead className="font-bold text-right py-1">Amount</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {dailyData.payments.map((p, i) => (
                                    <TableRow key={i} className="h-7">
                                        <TableCell className="font-bold py-1">{p.customerName}</TableCell>
                                        <TableCell className="py-1">{p.description} (Ref: {p.recordId})</TableCell>
                                        <TableCell className="text-right font-mono font-bold text-green-600 py-1">{formatCurrency(p.amount)}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}

                {dailyData.expenses.length > 0 && (
                    <div className="space-y-2">
                        <h4 className="text-[10px] font-black uppercase text-slate-500 border-l-4 border-destructive pl-2">Vouchers (Expenses)</h4>
                        <Table className="border border-slate-100 text-[13px]">
                            <TableHeader className="bg-slate-50">
                                <TableRow className="h-7">
                                    <TableHead className="font-bold py-1">Ref No</TableHead>
                                    <TableHead className="font-bold py-1">Description</TableHead>
                                    <TableHead className="font-bold text-right py-1">Amount</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {dailyData.expenses.map((e, i) => (
                                    <TableRow key={i} className="h-7">
                                        <TableCell className="font-bold font-mono py-1">{e.refNo || '-'}</TableCell>
                                        <TableCell className="py-1">{e.category}: {e.description}</TableCell>
                                        <TableCell className="text-right font-mono font-bold text-destructive py-1">{formatCurrency(e.amount)}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </div>

            <div className="mt-16 flex flex-col items-end text-center space-y-1">
                <div className="w-80 border-t border-slate-400 pt-3">
                    <p className="text-[#1e293b] font-black text-[12px] uppercase tracking-wider">Authorized Auditor Signature</p>
                    <p className="text-primary font-bold text-[10px] uppercase mt-1">SRI LAKSHMI WAREHOUSE</p>
                </div>
                <div className="text-[10px] text-slate-400 italic mt-6 space-y-0.5">
                    <p>Report digital validity verified on {timestamp}</p>
                </div>
            </div>
        </div>
    );
};

export function DailySummaryReport({ records, customers, unloadingRecords, expenses, otherIncomes }: { records: StorageRecord[], customers: Customer[], unloadingRecords: UnloadingRecord[], expenses: Expense[], otherIncomes: OtherIncome[] }) {
    const [dateInput, setDateInput] = useState(new Date().toISOString().split('T')[0]);
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    
    const handleSearch = () => {
        if (dateInput) {
            setSelectedDate(new Date(dateInput));
        }
    };

    const dailyData = useMemo(() => {
        const date = selectedDate;
        const data: DailyData = {
            inflows: [],
            outflows: [],
            unloadings: [],
            payments: [],
            expenses: [],
            otherIncomes: [],
            summary: { totalIncome: 0, totalExpenses: 0, netBalance: 0, totalInflowBags: 0, totalOutflowBags: 0 }
        };

        const customerMap = new Map(customers.map(c => [c.id, c.name]));

        data.inflows = records.filter(r => isSameDay(toDate(r.storageStartDate), date));
        data.summary.totalInflowBags = data.inflows.reduce((sum, r) => sum + (r.bagsIn || 0), 0);

        records.forEach(r => {
            (r.outflows || []).forEach(outflow => {
                if (isSameDay(toDate(outflow.date), date)) {
                    data.outflows.push({ ...r, ...outflow, outflowDate: toDate(outflow.date) } as any);
                    data.summary.totalOutflowBags += outflow.bagsWithdrawn;
                }
            });
            (r.payments || []).forEach(p => {
                if (isSameDay(toDate(p.date), date)) {
                    data.payments.push({ ...p, customerName: customerMap.get(r.customerId) ?? 'Unknown', recordId: r.id, description: `Payment for Storage` });
                    data.summary.totalIncome += p.amount;
                }
            });
        });

        data.unloadings = unloadingRecords.filter(r => isSameDay(toDate(r.unloadingDate), date));
        unloadingRecords.forEach(r => {
            (r.payments || []).forEach(p => {
                if (isSameDay(toDate(p.date), date)) {
                    data.payments.push({ ...p, customerName: customerMap.get(r.customerId) ?? 'Unknown', recordId: r.billNo || r.id, description: 'Payment for Unloading' });
                    data.summary.totalIncome += p.amount;
                }
            });
        });

        data.otherIncomes = otherIncomes.filter(i => isSameDay(toDate(i.date), date));
        data.summary.totalIncome += data.otherIncomes.reduce((sum, i) => sum + i.amount, 0);

        data.expenses = expenses.filter(e => isSameDay(toDate(e.date), date));
        data.summary.totalExpenses = data.expenses.reduce((sum, e) => sum + e.amount, 0);

        data.summary.netBalance = data.summary.totalIncome - data.summary.totalExpenses;
        
        return data;

    }, [selectedDate, records, customers, unloadingRecords, expenses, otherIncomes]);
    
    return (
        <Card className="border-primary/20 shadow-lg">
            <CardHeader className="flex-col md:flex-row items-start md:items-center justify-between gap-4 print-hide border-b bg-slate-50/50 p-4">
                <div className="flex-1 text-left">
                    <CardTitle className="text-lg font-black uppercase tracking-tight">Audit Control Center</CardTitle>
                    <CardDescription className="text-[12px] font-medium">Verify day-end balances and physical stock movements.</CardDescription>
                </div>
                <div className="flex items-end gap-2">
                    <div className="space-y-1 text-left">
                        <Label htmlFor="daily-date" className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Audit Date</Label>
                        <Input id="daily-date" type="date" className="w-[160px] text-[13px] h-9 font-bold" value={dateInput} onChange={(e) => setDateInput(e.target.value)} />
                    </div>
                    <Button onClick={handleSearch} size="sm" className="h-9 font-black uppercase tracking-widest"><Search className="h-4 w-4 mr-2" /> Load</Button>
                </div>
            </CardHeader>
            <CardContent className="pt-4">
                <DailySummaryContent dailyData={dailyData} selectedDate={selectedDate} />
            </CardContent>
        </Card>
    );
}
