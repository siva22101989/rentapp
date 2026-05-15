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

type DailyReportProps = {
    records: StorageRecord[];
    customers: Customer[];
    unloadingRecords: UnloadingRecord[];
    expenses: Expense[];
    otherIncomes: OtherIncome[];
}

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
    const generatedDate = useMemo(() => format(new Date(), 'dd MMM yyyy, hh:mm a'), []);

    return (
        <div className="p-4 space-y-6">
            <div className="mb-6 text-center">
                <h2 className="text-xl font-bold uppercase tracking-wide">SRI LAKSHMI WAREHOUSE</h2>
                <h3 className="font-semibold uppercase tracking-tight">Daily Summary Report</h3>
                <p className="text-sm text-gray-500">{format(selectedDate, 'EEEE, dd MMMM yyyy')}</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-xs font-bold uppercase">Income</CardTitle>
                        <TrendingUp className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">{formatCurrency(dailyData.summary.totalIncome)}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-xs font-bold uppercase">Expenses</CardTitle>
                        <TrendingDown className="h-4 w-4 text-red-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-destructive">{formatCurrency(dailyData.summary.totalExpenses)}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-xs font-bold uppercase">Balance</CardTitle>
                        <Scale className="h-4 w-4 text-gray-500" />
                    </CardHeader>
                    <CardContent>
                        <div className={`text-2xl font-bold ${dailyData.summary.netBalance >= 0 ? 'text-primary' : 'text-destructive'}`}>{formatCurrency(dailyData.summary.netBalance)}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-xs font-bold uppercase">Bags In</CardTitle>
                        <ArrowDownToDot className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                         <div className="text-2xl font-bold">{dailyData.summary.totalInflowBags}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-xs font-bold uppercase">Bags Out</CardTitle>
                        <ArrowUpFromDot className="h-4 w-4 text-orange-500" />
                    </CardHeader>
                    <CardContent>
                         <div className="text-2xl font-bold">{dailyData.summary.totalOutflowBags}</div>
                    </CardContent>
                </Card>
            </div>

            <div className="mt-16 pt-8 flex flex-col items-end text-center space-y-2">
                <div className="w-72 border-t border-slate-400 pt-4">
                    <p className="text-[#1e293b] font-bold text-sm uppercase tracking-wider">AUTHORIZED MANAGER SIGNATURE</p>
                    <p className="text-primary font-bold text-xs uppercase mt-1">SRI LAKSHMI WAREHOUSE</p>
                </div>
                <p className="text-[10px] text-slate-400">Report validity verified on {generatedDate}</p>
                <p className="text-[10px] text-slate-400 italic">This is a computer generated statement.</p>
            </div>
        </div>
    );
};

export function DailySummaryReport({ records, customers, unloadingRecords, expenses, otherIncomes }: DailyReportProps) {
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
            summary: {
                totalIncome: 0,
                totalExpenses: 0,
                netBalance: 0,
                totalInflowBags: 0,
                totalOutflowBags: 0,
            }
        };

        const customerMap = new Map(customers.map(c => [c.id, c.name]));

        data.inflows = records.filter(r => isSameDay(toDate(r.storageStartDate), date));
        data.summary.totalInflowBags = data.inflows.reduce((sum, r) => sum + (r.bagsIn || 0), 0);

        records.forEach(r => {
            (r.outflows || []).forEach(outflow => {
                if (isSameDay(toDate(outflow.date), date)) {
                    data.outflows.push({ ...r, ...outflow, outflowDate: toDate(outflow.date) });
                    data.summary.totalOutflowBags += outflow.bagsWithdrawn;
                }
            });
        });

        data.unloadings = unloadingRecords.filter(r => isSameDay(toDate(r.unloadingDate), date));
        
        records.forEach(r => {
            (r.payments || []).forEach(p => {
                if (isSameDay(toDate(p.date), date)) {
                    data.payments.push({ ...p, customerName: customerMap.get(r.customerId) ?? 'Unknown', recordId: r.id, description: `Payment for Storage` });
                    data.summary.totalIncome += p.amount;
                }
            });
        });
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
        <Card>
            <CardHeader className="flex-col md:flex-row items-start md:items-center justify-between gap-4 print-hide">
                <div className="flex-1">
                    <CardTitle className="text-lg">Daily Summary Report</CardTitle>
                    <CardDescription className="text-xs">Select a date to view all warehouse transactions for that day.</CardDescription>
                </div>
                <div className="flex items-end gap-2 w-full sm:w-auto">
                    <div className="space-y-1">
                        <Label htmlFor="daily-date" className="text-xs">Select Date</Label>
                        <Input 
                            id="daily-date"
                            type="date"
                            className="w-full sm:w-[180px] text-sm"
                            value={dateInput}
                            onChange={(e) => setDateInput(e.target.value)}
                        />
                    </div>
                    <Button onClick={handleSearch} size="sm">
                        <Search className="h-4 w-4 mr-2" />
                        Show
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                <DailySummaryContent dailyData={dailyData} selectedDate={selectedDate} />
            </CardContent>
        </Card>
    );
}
