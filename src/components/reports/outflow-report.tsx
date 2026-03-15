'use client';

import { useState, useRef, useMemo } from 'react';
import type { Customer, StorageRecord, Outflow } from "@/lib/definitions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from '@/components/ui/button';
import { Download, Loader2 } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { OutflowReportTable, type OutflowEvent } from './outflow-report-table';
import { toDate } from '@/lib/utils';
import { useDateFilter } from '@/firebase/provider';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';

type OutflowReportProps = {
    records: StorageRecord[];
    customers: Customer[];
}

export function OutflowReport({ records, customers }: OutflowReportProps) {
    const [selectedCustomerId, setSelectedCustomerId] = useState<string>('all');
    const [isGenerating, setIsGenerating] = useState(false);
    
    const reportRef = useRef<HTMLDivElement>(null);
    const { dateRange } = useDateFilter();

    const outflowEvents = useMemo(() => {
        const events: OutflowEvent[] = [];
        records.forEach(record => {
            if (record.outflows && Array.isArray(record.outflows)) {
                record.outflows.forEach(outflow => {
                    events.push({
                        ...outflow,
                        date: toDate(outflow.date),
                        customerId: record.customerId,
                        recordId: record.id,
                        commodityDescription: record.commodityDescription,
                        location: record.location,
                    });
                });
            }
        });

        let filteredEvents = events;

        if (selectedCustomerId && selectedCustomerId !== 'all') {
            filteredEvents = filteredEvents.filter(r => r.customerId === selectedCustomerId);
        }
        if (dateRange?.from) {
            filteredEvents = filteredEvents.filter(r => r.date >= dateRange.from!);
        }
        if (dateRange?.to) {
            const toDateObj = new Date(dateRange.to);
            toDateObj.setHours(23, 59, 59, 999); // Include the whole day
            filteredEvents = filteredEvents.filter(r => r.date <= toDateObj);
        }

        return filteredEvents.sort((a,b) => b.date.getTime() - a.date.getTime());
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
            pdf.save(`outflow-report-${Date.now()}.pdf`);
        } catch (error) {
            console.error('Error generating PDF:', error);
        } finally {
            setIsGenerating(false);
        }
    };
    
    const customer = customers.find(c => c.id === selectedCustomerId);
    const title = `Outflow Register ${customer ? `for ${customer.name}` : ''}`;

    return (
        <Dialog>
            <Card>
                <CardHeader className="flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div className="flex-1">
                        <CardTitle>Outflow Register</CardTitle>
                        <CardDescription>A log of all items withdrawn from storage.</CardDescription>
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
                        <DialogTrigger asChild>
                            <Button>View Report</Button>
                        </DialogTrigger>
                    </div>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground">Select a customer and date range, then click "View Report" to generate.</p>
                </CardContent>
            </Card>

            <DialogContent className="max-w-6xl p-0">
                 <div ref={reportRef} className="p-4 max-h-[80vh] overflow-y-auto">
                    <OutflowReportTable 
                        events={outflowEvents} 
                        customers={customers}
                        title={title}
                        allRecords={records}
                    />
                </div>
                <DialogFooter className="p-4 border-t">
                    <DialogClose asChild><Button variant="outline">Close</Button></DialogClose>
                    <Button onClick={handleDownloadPdf} disabled={isGenerating}>
                        {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                        Print PDF
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
