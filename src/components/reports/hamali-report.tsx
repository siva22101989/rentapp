
'use client';

import { useState, useRef, useMemo } from 'react';
import type { Customer, StorageRecord, UnloadingRecord, DryingRecord, Expense } from "@/lib/definitions";
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

export function HamaliReport({ records, customers, unloadingRecords, dryingRecords, expenses }: { records: StorageRecord[], customers: Customer[], unloadingRecords: UnloadingRecord[], dryingRecords: DryingRecord[], expenses: Expense[] }) {
    const [reportView, setReportView] = useState<'customer' | 'worker'>('customer');
    const [selectedCustomerId, setSelectedCustomerId] = useState<string>('all');
    const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
    const [isGenerating, setIsGenerating] = useState(false);
    
    const reportRef = useRef<HTMLDivElement>(null);

    const customerHamaliEvents = useMemo(() => {
        const events: CustomerHamaliEvent[] = [];

        // --- CHARGES ---
        // 1. From Unloading Records
        unloadingRecords.forEach(ur => {
            events.push({
                date: toDate(ur.unloadingDate),
                customerId: ur.customerId,
                description: 'Unloading Hamali',
                recordId: ur.billNo || ur.id.substring(0, 5),
                amount: ur.totalHamali,
                type: 'charge',
                bags: ur.bagsUnloaded
            });
        });

        // 2. From Drying Records (for additional charges beyond unloading)
        dryingRecords.forEach(dr => {
            const unloadingRecord = unloadingRecords.find(ur => ur.id === dr.unloadingRecordId);
            const refId = unloadingRecord?.billNo || dr.unloadingRecordId.substring(0,5);
            (dr.hamaliCharges || []).forEach(charge => {
                // Exclude the base "Unloading Hamali" as it's already covered from the source record.
                if (!charge.description.toLowerCase().includes('unloading')) {
                    events.push({
                        date: toDate(charge.date),
                        customerId: dr.customerId,
                        description: charge.description,
                        recordId: refId,
                        amount: charge.amount,
                        type: 'charge',
                        bags: dr.bagsForDrying,
                    });
                }
            });
        });
        
        // 3. From Direct Inflow Storage Records
        records.forEach(sr => {
            if ((sr.inflowType === 'Direct' || !sr.inflowType) && sr.hamaliPayable > 0) {
                 events.push({
                    date: toDate(sr.storageStartDate),
                    customerId: sr.customerId,
                    description: 'Direct Inflow Hamali',
                    recordId: sr.id,
                    amount: sr.hamaliPayable,
                    type: 'charge',
                    bags: sr.bagsIn,
                });
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
    }, [records, unloadingRecords, dryingRecords, selectedCustomerId, dateRange]);

    const workerHamaliEvents = useMemo(() => {
        const events: WorkerHamaliEvent[] = [];

        // 1. Payable from Drying Records (includes pro-rated unloading + drying worker hamali)
        dryingRecords.forEach(dr => {
            const unloadingRecord = unloadingRecords.find(ur => ur.id === dr.unloadingRecordId);
            const refId = unloadingRecord?.billNo || dr.unloadingRecordId.substring(0,5);

            if (dr.totalDryingWorkerHamali !== undefined && dr.totalDryingWorkerHamali > 0) {
                 events.push({
                    date: toDate(dr.packingDate || dr.dryingStartDate),
                    description: 'Drying Process Hamali',
                    recordId: refId,
                    customerId: dr.customerId,
                    payable: dr.totalDryingWorkerHamali,
                    paid: 0,
                    bags: dr.bagsForDrying,
                });
            }
        });
        
        // 2. Payable from Direct Inflow Storage Records
        records.forEach(sr => {
            if ((sr.inflowType === 'Direct' || !sr.inflowType) && sr.hamaliPayable > 0) {
                events.push({
                    date: toDate(sr.storageStartDate),
                    description: 'Direct Inflow Hamali',
                    recordId: sr.id,
                    customerId: sr.customerId,
                    payable: sr.hamaliPayable,
                    paid: 0,
                    bags: sr.bagsIn,
                });
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
    }, [records, unloadingRecords, dryingRecords, expenses, selectedCustomerId, dateRange]);


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
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                    <Select onValueChange={(v) => setReportView(v as 'customer' | 'worker')} value={reportView}>
                        <SelectTrigger className='w-full sm:w-[180px]'>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="customer">Customer Ledger</SelectItem>
                            <SelectItem value="worker">Worker Ledger</SelectItem>
                        </SelectContent>
                    </Select>
                    <Select onValueChange={setSelectedCustomerId} value={selectedCustomerId}>
                        <SelectTrigger className="w-full sm:w-[200px]">
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
                     <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            id="date"
                            variant={"outline"}
                            className="w-full sm:w-[260px] justify-start text-left font-normal"
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
                            onSelect={setDateRange}
                            numberOfMonths={2}
                          />
                        </PopoverContent>
                      </Popover>
                      {dateRange && <Button variant="ghost" size="icon" onClick={() => setDateRange(undefined)}><X className="h-4 w-4" /></Button>}

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
