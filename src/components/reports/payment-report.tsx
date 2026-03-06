'use client';

import { useState, useRef, useMemo } from 'react';
import type { Customer, StorageRecord, UnloadingRecord, Payment } from "@/lib/definitions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from '@/components/ui/button';
import { Download, Loader2, Calendar as CalendarIcon, X } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { PaymentReportTable, type PaymentEvent } from './payment-report-table';
import { toDate } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { DateRange } from 'react-day-picker';

type PaymentReportProps = {
    records: StorageRecord[];
    unloadingRecords: UnloadingRecord[];
    customers: Customer[];
}

export function PaymentReport({ records, unloadingRecords, customers }: PaymentReportProps) {
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
        if (!fy) {
            setDateRange(undefined);
            return;
        }

        const startYear = parseInt(fy.substring(0, 4), 10);
        const fromDate = new Date(startYear, 10, 1); // November 1st
        const toDate = new Date(startYear + 1, 9, 31); // October 31st
        
        setDateRange({ from: fromDate, to: toDate });
    };

    const paymentEvents = useMemo(() => {
        const events: PaymentEvent[] = [];

        // Payments from Storage Records
        records.forEach(sr => {
            (sr.payments || []).forEach(payment => {
                events.push({
                    date: toDate(payment.date),
                    customerId: sr.customerId,
                    description: `Payment for Storage Record`,
                    recordId: sr.id,
                    amount: payment.amount,
                    type: payment.type || 'other',
                });
            });
        });

        // Payments from Unloading Records
        unloadingRecords.forEach(ur => {
            (ur.payments || []).forEach(payment => {
                events.push({
                    date: toDate(payment.date),
                    customerId: ur.customerId,
                    description: 'Payment for Unloading',
                    recordId: ur.billNo || 'N/A',
                    amount: payment.amount,
                    type: 'unloading',
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
            pdf.save(`payment-report-${Date.now()}.pdf`);
        } catch (error) {
            console.error('Error generating PDF:', error);
        } finally {
            setIsGenerating(false);
        }
    };
    
    const customer = customers.find(c => c.id === selectedCustomerId);
    const title = `Payment Register ${customer ? `for ${customer.name}` : ''}`;

    return (
        <Card>
            <CardHeader className="flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex-1">
                    <CardTitle>Payment Register</CardTitle>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto flex-wrap">
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
                            <SelectItem value="">All Time</SelectItem>
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
                    <PaymentReportTable 
                        events={paymentEvents} 
                        customers={customers}
                        title={title}
                    />
                </div>
            </CardContent>
        </Card>
    );
}
