
'use client';

import { useState, useRef, useMemo } from 'react';
import type { Customer, StorageRecord, UnloadingRecord, Expense } from "@/lib/definitions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from '@/components/ui/button';
import { Download, Loader2, Calendar as CalendarIcon, X } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { CustomerHamaliReportTable } from './customer-hamali-report-table';
import { WorkerHamaliReportTable } from './worker-hamali-report-table';
import { toDate } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { DateRange } from 'react-day-picker';

export type CustomerHamaliEvent = {
    date: Date;
    customerId: string;
    description: string;
    recordId: string;
    amount: number;
    type: 'charge' | 'payment';
    bags?: number;
}
export type WorkerHamaliEvent = {
    date: Date;
    description: string;
    recordId: string;
    customerId?: string;
    payable: number;
    paid: number;
    bags?: number;
}

export function HamaliReport({ records, customers, unloadingRecords, expenses }: { records: StorageRecord[], customers: Customer[], unloadingRecords: UnloadingRecord[], expenses: Expense[] }) {
    const [reportView, setReportView] = useState<'customer' | 'worker'>('customer');
    const [selectedCustomerId, setSelectedCustomerId] = useState<string>('all');
    const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
    const [isGenerating, setIsGenerating] = useState(false);
    const [financialYear, setFinancialYear] = useState<string>('');
    
    const reportRef = useRef<HTMLDivElement>(null);

    const financialYears = useMemo(() => {
        const currentYear = new Date().getFullYear();
        const currentMonth = new Date().getMonth(); // 0-indexed: Jan is 0, Nov is 10
        // If current month is Nov or Dec, the FY starts this year. Otherwise, it started last year.
        const startYear = currentMonth >= 10 ? currentYear : currentYear - 1;
        const years = [];
        for (let i = 0; i < 10; i++) {
            const year = startYear - i;
            years.push(`${year}-${(year + 1).toString().slice(2)}`);
        }
        return years;
    }, []);

    const handleFinancialYearChange = (fy: string) => {
        setFinancialYear(fy);
        if (fy === 'all-time') {
            setDateRange(undefined);
            return;
        }

        const startYear = parseInt(fy.substring(0, 4), 10);
        const fromDate = new Date(startYear, 10, 1); // November 1st
        const toDate = new Date(startYear + 1, 9, 31); // October 31st
        
        setDateRange({ from: fromDate, to: toDate });
    };

    const customerHamaliEvents = useMemo(() => {
        const events: CustomerHamaliEvent[] = [];

        // --- CHARGES ---
        // From all storage records
        records.forEach(sr => {
            if (sr.hamaliPayable > 0) {
                 events.push({
                    date: toDate(sr.storageStartDate),
                    customerId: sr.customerId,
                    description: sr.inflowType === 'Plot' ? 'Plot to Storage Hamali' : 'Direct Inflow Hamali',
                    recordId: sr.id,
                    amount: sr.hamaliPayable,
                    type: 'charge',
                    bags: sr.bagsIn,
                });
            }
        });
        
        // From unloading records that have not been fully processed
        unloadingRecords.forEach(ur => {
            const bagsRemaining = ur.bagsUnloaded - (ur.bagsSentToDrying || 0);
            if (bagsRemaining > 0) {
                const remainingHamali = bagsRemaining * ur.hamaliPerBag;
                 if (remainingHamali > 0) {
                    events.push({
                        date: toDate(ur.unloadingDate),
                        customerId: ur.customerId,
                        description: 'Unloading Hamali (pending finalize)',
                        recordId: ur.billNo || ur.id.substring(0, 5),
                        amount: remainingHamali,
                        type: 'charge',
                        bags: bagsRemaining
                    });
                }
            }
        });

        // --- PAYMENTS ---
        records.forEach(sr => {
            (sr.payments || []).filter(p => p.type === 'hamali').forEach(payment => {
                events.push({
                    date: toDate(payment.date),
                    customerId: sr.customerId,
                    description: 'Payment (Storage)',
                    recordId: sr.id,
                    amount: payment.amount,
                    type: 'payment',
                });
            });
        });

        unloadingRecords.forEach(ur => {
            (ur.payments || []).forEach(payment => {
                events.push({
                    date: toDate(payment.date),
                    customerId: ur.customerId,
                    description: 'Payment (Unloading)',
                    recordId: ur.billNo || ur.id.substring(0,5),
                    amount: payment.amount,
                    type: 'payment',
                });
            });
        });
        
        let filteredEvents = events;
        if (selectedCustomerId && selectedCustomerId !== 'all') {
            filteredEvents = filteredEvents.filter(e => e.customerId === selectedCustomerId);
        }
        if (dateRange?.from) {
            filteredEvents = filteredEvents.filter(e => e.date >= dateRange.from!);
        }
        if (dateRange?.to) {
            const toDateObj = new Date(dateRange.to);
            toDateObj.setHours(23, 59, 59, 999);
            filteredEvents = filteredEvents.filter(e => e.date <= toDateObj);
        }

        return filteredEvents.sort((a,b) => a.date.getTime() - b.date.getTime());
    }, [records, unloadingRecords, selectedCustomerId, dateRange]);

    const workerHamaliEvents = useMemo(() => {
        const events: WorkerHamaliEvent[] = [];

        // 1. Payable from Storage Records
        records.forEach(sr => {
            if (sr.workerHamaliPayable && sr.workerHamaliPayable > 0) {
                events.push({
                    date: toDate(sr.storageStartDate),
                    description: sr.inflowType === 'Plot' ? 'Plot to Storage Hamali' : 'Direct Inflow Hamali',
                    recordId: sr.id,
                    customerId: sr.customerId,
                    payable: sr.workerHamaliPayable,
                    paid: 0,
                    bags: sr.bagsIn,
                });
            }
        });

        // 2. Payable from Unloading Records (for bags not yet finalized into storage)
        unloadingRecords.forEach(ur => {
            const bagsRemaining = ur.bagsUnloaded - (ur.bagsSentToDrying || 0);
            if (bagsRemaining > 0 && ur.workerHamaliPayable) {
                const hamaliPerBag = ur.hamaliPerBag || 0; // or calculate from total
                const remainingPayable = bagsRemaining * hamaliPerBag;
                if (remainingPayable > 0) {
                    events.push({
                        date: toDate(ur.unloadingDate),
                        description: 'Unloading Hamali (Pending Finalize)',
                        recordId: ur.billNo || ur.id.substring(0, 5),
                        customerId: ur.customerId,
                        payable: remainingPayable,
                        paid: 0,
                        bags: bagsRemaining,
                    });
                }
            }
        });

        // 3. Paid amounts from Expenses
        expenses.filter(e => e.category === 'Hamali').forEach(exp => {
            events.push({
                date: toDate(exp.date),
                description: exp.description,
                recordId: exp.id.substring(0,5),
                payable: 0,
                paid: exp.amount,
            });
        });

        let filtered = events;
        if (selectedCustomerId && selectedCustomerId !== 'all') {
            filtered = filtered.filter(e => e.customerId === selectedCustomerId);
        }
        if (dateRange?.from) {
            filtered = filtered.filter(e => e.date >= dateRange.from!);
        }
        if (dateRange?.to) {
            const toDateObj = new Date(dateRange.to);
            toDateObj.setHours(23, 59, 59, 999);
            filtered = filtered.filter(e => e.date <= toDateObj);
        }

        return filtered.sort((a,b) => a.date.getTime() - b.date.getTime());
    }, [records, unloadingRecords, expenses, selectedCustomerId, dateRange]);


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
            const pdf = new jsPDF('l', 'mm', 'a4'); // Landscape
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            const imgWidth = canvas.width;
            const imgHeight = canvas.height;
            const ratio = imgWidth / imgHeight;
            let widthInPdf = pdfWidth - 20;
            let heightInPdf = widthInPdf / ratio;
            if (heightInPdf > pdfHeight - 20) {
                heightInPdf = pdfHeight - 20;
                widthInPdf = heightInPdf * ratio;
            }
            const x = (pdfWidth - widthInPdf) / 2;
            const y = 10;

            pdf.addImage(imgData, 'PNG', x, y, widthInPdf, heightInPdf);
            pdf.save(`hamali-report-${reportView}-${Date.now()}.pdf`);
        } catch (error) {
            console.error('Error generating PDF:', error);
        } finally {
            setIsGenerating(false);
        }
    };
    
    const customer = customers.find(c => c.id === selectedCustomerId);
    const title = `Hamali ${reportView === 'customer' ? 'Customer' : 'Worker'} Ledger ${customer ? `for ${customer.name}` : ''}`;

    return (
        <Card>
            <CardHeader className="flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex-1">
                    <CardTitle>Hamali Register</CardTitle>
                    <CardDescription>View ledgers for customer charges or worker payments.</CardDescription>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto flex-wrap">
                    <Select onValueChange={(v) => setReportView(v as 'customer' | 'worker')} value={reportView}>
                        <SelectTrigger className='w-full sm:w-auto'>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="customer">Customer Ledger</SelectItem>
                            <SelectItem value="worker">Worker Ledger</SelectItem>
                        </SelectContent>
                    </Select>
                    <Select onValueChange={setSelectedCustomerId} value={selectedCustomerId}>
                        <SelectTrigger className="w-full sm:w-auto">
                            <SelectValue placeholder="All Customers" />
                        </SelectTrigger>
                        <SelectContent>
                             <SelectItem value="all">All Customers</SelectItem>
                            {customers.map(customer => (
                                <SelectItem key={customer.id} value={customer.id}>
                                    {customer.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                     <Select value={financialYear} onValueChange={handleFinancialYearChange}>
                        <SelectTrigger className="w-full sm:w-auto">
                            <SelectValue placeholder="Select FY" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all-time">All Time</SelectItem>
                            {financialYears.map(fy => (
                                <SelectItem key={fy} value={fy}>
                                    FY {fy}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                     <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            id="date"
                            variant={"outline"}
                            className="w-full sm:w-auto justify-start text-left font-normal"
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {dateRange?.from ? (
                              dateRange.to ? (
                                <>
                                  {format(dateRange.from, "LLL dd, y")} -{" "}
                                  {format(dateRange.to, "LLL dd, y")}
                                </>
                              ) : (
                                format(dateRange.from, "LLL dd, y")
                              )
                            ) : (
                              <span>Pick a date range</span>
                            )}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="end">
                          <Calendar
                            initialFocus
                            mode="range"
                            defaultMonth={dateRange?.from}
                            selected={dateRange}
                            onSelect={(range) => { setDateRange(range); setFinancialYear(''); }}
                            numberOfMonths={2}
                          />
                        </PopoverContent>
                      </Popover>
                      {dateRange && <Button variant="ghost" size="icon" onClick={() => { setDateRange(undefined); setFinancialYear(''); }}><X className="h-4 w-4" /></Button>}

                    <Button onClick={handleDownloadPdf} disabled={isGenerating}>
                        {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                        Download
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                <div ref={reportRef}>
                    {reportView === 'customer' ? (
                         <CustomerHamaliReportTable 
                            events={customerHamaliEvents} 
                            customers={customers}
                            title={title}
                        />
                    ) : (
                        <WorkerHamaliReportTable 
                            events={workerHamaliEvents}
                            customers={customers}
                            title={title}
                        />
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
