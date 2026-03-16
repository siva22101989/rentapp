
'use client';

import React, { useState, useRef, useMemo } from 'react';
import type { Customer, StorageRecord, UnloadingRecord, Expense, Payment, OtherIncome } from "@/lib/definitions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Download, Loader2, Calendar as CalendarIcon, TrendingUp, TrendingDown, Scale, ArrowDownToDot, ArrowUpFromDot, FileText } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { toDate, formatCurrency } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format, isSameDay } from 'date-fns';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

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
                <h2 className="text-xl font-bold">Daily Summary Report</h2>
                <p className="text-muted-foreground">{format(selectedDate, 'EEEE, dd MMMM yyyy')}</p>
            </div>

            {/* Summary Cards */}
            <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5 mb-6">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Total Income</CardTitle><TrendingUp className="h-4 w-4 text-green-500" /></CardHeader>
                    <CardContent><div className="text-2xl font-bold text-green-600">{formatCurrency(dailyData.summary.totalIncome)}</div></CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Total Expenses</CardTitle><TrendingDown className="h-4 w-4 text-red-500" /></CardHeader>
                    <CardContent><div className="text-2xl font-bold text-destructive">{formatCurrency(dailyData.summary.totalExpenses)}</div></CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Net Balance</CardTitle><Scale className="h-4 w-4 text-muted-foreground" /></CardHeader>
                    <CardContent><div className={`text-2xl font-bold ${dailyData.summary.netBalance >= 0 ? 'text-primary' : 'text-destructive'}`}>{formatCurrency(dailyData.summary.netBalance)}</div></CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Bags In</CardTitle><ArrowDownToDot className="h-4 w-4 text-blue-500" /></CardHeader>
                    <CardContent><div className="text-2xl font-bold">{dailyData.summary.totalInflowBags}</div></CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Bags Out</CardTitle><ArrowUpFromDot className="h-4 w-4 text-orange-500" /></CardHeader>
                    <CardContent><div className="text-2xl font-bold">{dailyData.summary.totalOutflowBags}</div></CardContent>
                </Card>
            </div>

            {/* Detailed Tables */}
            <div className="space-y-6">
                {dailyData.inflows.length > 0 && (
                    <section>
                        <h3 className="font-semibold mb-2">Inflows</h3>
                        <Table>
                            <TableHeader><TableRow><TableHead className="text-black">Record ID</TableHead><TableHead className="text-black">Customer</TableHead><TableHead className="text-black">Commodity</TableHead><TableHead className="text-right text-black">Bags</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {dailyData.inflows.map(rec => (
                                    <TableRow key={`in-${rec.id}`}><TableCell>{rec.id}</TableCell><TableCell>{getCustomerName(rec.customerId)}</TableCell><TableCell>{rec.commodityDescription}</TableCell><TableCell className="text-right font-mono">{rec.bagsIn}</TableCell></TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </section>
                )}
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
                 {dailyData.unloadings.length > 0 && (
                    <section>
                        <h3 className="font-semibold mb-2">Unloadings</h3>
                        <Table>
                            <TableHeader><TableRow><TableHead className="text-black">Bill No.</TableHead><TableHead className="text-black">Customer</TableHead><TableHead className="text-black">Commodity</TableHead><TableHead className="text-right text-black">Bags Unloaded</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {dailyData.unloadings.map(rec => (
                                    <TableRow key={`unloading-${rec.id}`}><TableCell>{rec.billNo}</TableCell><TableCell>{getCustomerName(rec.customerId)}</TableCell><TableCell>{rec.commodityDescription}</TableCell><TableCell className="text-right font-mono">{rec.bagsUnloaded}</TableCell></TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </section>
                )}
                {(dailyData.payments.length > 0 || dailyData.otherIncomes.length > 0) && (
                     <section>
                        <h3 className="font-semibold mb-2">Income</h3>
                        <Table>
                            <TableHeader><TableRow><TableHead className="text-black">Customer/Source</TableHead><TableHead className="text-black">Description</TableHead><TableHead className="text-black">Ref ID</TableHead><TableHead className="text-right text-black">Amount</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {dailyData.payments.map((p, i) => (
                                    <TableRow key={`payment-${i}`}><TableCell>{p.customerName}</TableCell><TableCell>{p.description}</TableCell><TableCell>{p.recordId}</TableCell><TableCell className="text-right font-mono">{formatCurrency(p.amount)}</TableCell></TableRow>
                                ))}
                                {dailyData.otherIncomes.map((i, idx) => (
                                    <TableRow key={`other-income-${idx}`}><TableCell>{i.category}</TableCell><TableCell>{i.description}</TableCell><TableCell>N/A</TableCell><TableCell className="text-right font-mono">{formatCurrency(i.amount)}</TableCell></TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </section>
                )}
                {dailyData.expenses.length > 0 && (
                     <section>
                        <h3 className="font-semibold mb-2">Expenses</h3>
                        <Table>
                            <TableHeader><TableRow><TableHead className="text-black">Category</TableHead><TableHead className="text-black">Description</TableHead><TableHead className="text-right text-black">Amount</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {dailyData.expenses.map(exp => (
                                    <TableRow key={`exp-${exp.id}`}><TableCell>{exp.category}</TableCell><TableCell>{exp.description}</TableCell><TableCell className="text-right font-mono">{formatCurrency(exp.amount)}</TableCell></TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </section>
                )}
            </div>
            {(dailyData.inflows.length + dailyData.outflows.length + dailyData.payments.length + dailyData.expenses.length) === 0 && (
                <div className="text-center py-16 text-muted-foreground">No transactions recorded for this day.</div>
            )}
        </div>
    );
});
DailySummaryContent.displayName = 'DailySummaryContent';


export function DailySummaryReport({ records, customers, unloadingRecords, expenses, otherIncomes }: DailyReportProps) {
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [isGenerating, setIsGenerating] = useState(false);
    
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


    const handleDownloadPdf = async () => {
        const element = reportRef.current;
        if (!element) return;
        setIsGenerating(true);
        try {
            const canvas = await html2canvas(element, { 
                scale: 2, 
                useCORS: true,
                windowWidth: element.scrollWidth,
                windowHeight: element.scrollHeight
            });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4'); // Portrait
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            
            const imgProps= pdf.getImageProperties(imgData);
            const imgWidth = imgProps.width;
            const imgHeight = imgProps.height;

            const ratio = imgWidth / pdfWidth;
            const canvasHeight = imgHeight / ratio;
            
            let position = 0;
            let heightLeft = canvasHeight;

            pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, canvasHeight);
            heightLeft -= pdfHeight;

            while (heightLeft > 0) {
                position = position - pdfHeight;
                pdf.addPage();
                pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, canvasHeight);
                heightLeft -= pdfHeight;
            }
            pdf.save(`daily-summary-${format(selectedDate, 'yyyy-MM-dd')}.pdf`);
        } catch (error) {
            console.error('Error generating PDF:', error);
        } finally {
            setIsGenerating(false);
        }
    };
    
    return (
        <Card>
            <CardHeader className="flex-col md:flex-row items-start md:items-center justify-between gap-4">
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
                    <Dialog>
                        <DialogTrigger asChild>
                             <Button>
                                <FileText className="mr-2 h-4 w-4" />
                                Generate Report
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-4xl">
                            <DialogHeader>
                                <DialogTitle>Daily Summary Report</DialogTitle>
                                <DialogDescription>{format(selectedDate, 'EEEE, dd MMMM yyyy')}</DialogDescription>
                            </DialogHeader>
                            <div className="max-h-[70vh] overflow-y-auto">
                                <DailySummaryContent dailyData={dailyData} customers={customers} selectedDate={selectedDate} ref={reportRef} />
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => window.print()}>Print</Button>
                                <Button onClick={handleDownloadPdf} disabled={isGenerating}>
                                    {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                                    Save as PDF
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            </CardHeader>
            <CardContent>
                <div className="text-center text-muted-foreground py-16">
                    <FileText className="mx-auto h-12 w-12" />
                    <p className="mt-4">
                        Pick a date and click "Generate Report" to view the daily summary.
                    </p>
                </div>
            </CardContent>
        </Card>
    );
}
