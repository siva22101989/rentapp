
'use client';

import React, { useState, useRef, useMemo } from 'react';
import type { Customer, StorageRecord, UnloadingRecord, Expense, Payment, OtherIncome } from "@/lib/definitions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Calendar as CalendarIcon, TrendingUp, TrendingDown, Scale, ArrowDownToDot, ArrowUpFromDot, Printer } from 'lucide-react';
import { toDate, formatCurrency } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format, isSameDay } from 'date-fns';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { printElement } from '@/lib/print-util';

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

const DailySummaryContent = React.forwardRef<HTMLDivElement, { dailyData: DailyData, customers: Customer[], selectedDate: Date }>(({ dailyData, customers, selectedDate }, ref) => {
    const getCustomerName = (customerId: string) => customers.find(c => c.id === customerId)?.name ?? 'Unknown';

    return (
        <div ref={ref} className="bg-white p-4 rounded-lg text-black printable-area">
            <div className="mb-6 text-center">
                <h2 className="text-xl font-bold">SRI LAKSHMI WAREHOUSE</h2>
                <h3 className="font-semibold">Daily Summary Report</h3>
                <p className="text-sm text-gray-500">{format(selectedDate, 'EEEE, dd MMMM yyyy')}</p>
            </div>

            {/* Summary List */}
            <div className="space-y-2 mb-6">
                <div className="flex justify-between items-center p-3 border rounded-lg">
                    <div className="flex items-center gap-2"><TrendingUp className="h-4 w-4 text-green-500" /><span className="text-sm font-medium">Total Income</span></div>
                    <div className="text-sm font-semibold font-mono text-green-600">{formatCurrency(dailyData.summary.totalIncome)}</div>
                </div>
                <div className="flex justify-between items-center p-3 border rounded-lg">
                    <div className="flex items-center gap-2"><TrendingDown className="h-4 w-4 text-red-500" /><span className="text-sm font-medium">Total Expenses</span></div>
                    <div className="text-sm font-semibold font-mono text-destructive">{formatCurrency(dailyData.summary.totalExpenses)}</div>
                </div>
                <div className="flex justify-between items-center p-3 border rounded-lg">
                    <div className="flex items-center gap-2"><Scale className="h-4 w-4 text-gray-500" /><span className="text-sm font-medium">Net Balance</span></div>
                    <div className={`text-sm font-semibold font-mono ${dailyData.summary.netBalance >= 0 ? 'text-primary' : 'text-destructive'}`}>{formatCurrency(dailyData.summary.netBalance)}</div>
                </div>
                 <div className="flex justify-between items-center p-3 border rounded-lg">
                    <div className="flex items-center gap-2"><ArrowDownToDot className="h-4 w-4 text-blue-500" /><span className="text-sm font-medium">Bags In</span></div>
                    <div className="text-sm font-semibold font-mono">{dailyData.summary.totalInflowBags}</div>
                </div>
                 <div className="flex justify-between items-center p-3 border rounded-lg">
                    <div className="flex items-center gap-2"><ArrowUpFromDot className="h-4 w-4 text-orange-500" /><span className="text-sm font-medium">Bags Out</span></div>
                    <div className="text-sm font-semibold font-mono">{dailyData.summary.totalOutflowBags}</div>
                </div>
            </div>

            {/* Outflows Table */}
            <div className="space-y-6">
                {dailyData.outflows.length > 0 && (
                    <section>
                        <h3 className="font-semibold mb-2">Outflows</h3>
                        <Table>
                            <TableHeader><TableRow><TableHead className="text-black">Record ID</TableHead><TableHead className="text-black">Customer</TableHead><TableHead className="text-black">Commodity</TableHead><TableHead className="text-right text-black">Bags Withdrawn</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {dailyData.outflows.map(rec => (
                                    <TableRow key={`out-${rec.id}`}><TableCell>{rec.id}</TableCell><TableCell>{getCustomerName(rec.customerId)}</TableCell><TableCell>{rec.commodityDescription}</TableCell><TableCell className="text-right font-mono">{rec.bagsWithdrawn}</TableCell></TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </section>
                )}
                 {(dailyData.inflows.length + dailyData.outflows.length + dailyData.payments.length + dailyData.expenses.length) === 0 && (
                    <div className="text-center py-16 text-gray-500">No transactions recorded for this day.</div>
                )}
            </div>
        </div>
    );
});
DailySummaryContent.displayName = 'DailySummaryContent';


export function DailySummaryReport({ records, customers, unloadingRecords, expenses, otherIncomes }: DailyReportProps) {
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    
    const reportRef = useRef<HTMLDivElement>(null);

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

        // Inflows
        data.inflows = records.filter(r => isSameDay(toDate(r.storageStartDate), date));
        data.summary.totalInflowBags = data.inflows.reduce((sum, r) => sum + (r.bagsIn || 0), 0);

        // Outflows
        records.forEach(r => {
            (r.outflows || []).forEach(outflow => {
                if (isSameDay(toDate(outflow.date), date)) {
                    data.outflows.push({ ...r, ...outflow, outflowDate: toDate(outflow.date) });
                    data.summary.totalOutflowBags += outflow.bagsWithdrawn;
                }
            });
        });

        // Unloadings
        data.unloadings = unloadingRecords.filter(r => isSameDay(toDate(r.unloadingDate), date));
        
        // Income sources
        records.forEach(r => {
            (r.payments || []).forEach(p => {
                if (isSameDay(toDate(p.date), date)) {
                    data.payments.push({ ...p, customerName: customerMap.get(r.customerId) ?? 'Unknown', recordId: r.id, description: `Payment for Storage (${p.type || 'other'})` });
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

        // Expenses
        data.expenses = expenses.filter(e => isSameDay(toDate(e.date), date));
        data.summary.totalExpenses = data.expenses.reduce((sum, e) => sum + e.amount, 0);

        // Final summary calculation
        data.summary.netBalance = data.summary.totalIncome - data.summary.totalExpenses;
        
        return data;

    }, [selectedDate, records, customers, unloadingRecords, expenses, otherIncomes]);


    const handleGenerate = () => {
        const element = reportRef.current;
        if (!element) return;
        printElement(element, `Daily Summary Report - ${format(selectedDate, 'yyyy-MM-dd')}`);
    };
    
    return (
        <Card>
            <CardHeader className="flex-col md:flex-row items-start md:items-center justify-between gap-4 print-hide">
                <div className="flex-1">
                    <CardTitle>Daily Summary Report</CardTitle>
                    <CardDescription>A summary of all transactions for a selected day.</CardDescription>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button
                            id="date"
                            variant={"outline"}
                            className="w-full sm:w-[260px] justify-start text-left font-normal"
                            >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {selectedDate ? format(selectedDate, "LLL dd, y") : <span>Pick a date</span>}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="end">
                            <Calendar
                            initialFocus
                            mode="single"
                            selected={selectedDate}
                            onSelect={(date) => date && setSelectedDate(date)}
                            />
                        </PopoverContent>
                    </Popover>
                    <Button onClick={handleGenerate}>
                        <Printer className="mr-2 h-4 w-4" />
                        Print / Save PDF
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                <DailySummaryContent dailyData={dailyData} customers={customers} selectedDate={selectedDate} ref={reportRef} />
            </CardContent>
        </Card>
    );
}
