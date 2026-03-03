'use client';

import { useState, useRef, useMemo } from 'react';
import type { Customer, StorageRecord } from "@/lib/definitions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from '@/components/ui/button';
import { Download, Loader2, Calendar as CalendarIcon, X } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { InflowReportTable } from './inflow-report-table';
import { toDate } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { DateRange } from 'react-day-picker';

type InflowReportProps = {
    records: StorageRecord[];
    customers: Customer[];
}

export function InflowReport({ records, customers }: InflowReportProps) {
    const [selectedCustomerId, setSelectedCustomerId] = useState<string>('all');
    const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
    const [isGenerating, setIsGenerating] = useState(false);
    
    const reportRef = useRef<HTMLDivElement>(null);

    const inflowRecords = useMemo(() => {
        let filteredRecords = records;

        if (selectedCustomerId && selectedCustomerId !== 'all') {
            filteredRecords = filteredRecords.filter(r => r.customerId === selectedCustomerId);
        }
        if (dateRange?.from) {
            filteredRecords = filteredRecords.filter(r => toDate(r.storageStartDate) >= dateRange.from!);
        }
        if (dateRange?.to) {
            const toDateObj = new Date(dateRange.to);
            toDateObj.setHours(23, 59, 59, 999); // Include the whole day
            filteredRecords = filteredRecords.filter(r => toDate(r.storageStartDate) <= toDateObj);
        }

        return filteredRecords.sort((a,b) => toDate(b.storageStartDate).getTime() - toDate(a.storageStartDate).getTime());
    }, [records, selectedCustomerId, dateRange]);


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
            pdf.save(`inflow-report-${Date.now()}.pdf`);
        } catch (error) {
            console.error('Error generating PDF:', error);
        } finally {
            setIsGenerating(false);
        }
    };
    
    const customer = customers.find(c => c.id === selectedCustomerId);
    const title = `Inflow Register ${customer ? `for ${customer.name}` : ''}`;

    return (
        <Card>
            <CardHeader className="flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex-1">
                    <CardTitle>Inflow Register</CardTitle>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
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
                    <InflowReportTable 
                        records={inflowRecords} 
                        customers={customers}
                        title={title}
                        allRecords={records}
                    />
                </div>
            </CardContent>
        </Card>
    );
}
