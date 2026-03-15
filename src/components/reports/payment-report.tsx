
'use client';

import { useState, useRef, useMemo } from 'react';
import type { Customer, StorageRecord, UnloadingRecord, Payment } from "@/lib/definitions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from '@/components/ui/button';
import { Download, Loader2 } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { PaymentReportTable, type PaymentEvent } from './payment-report-table';
import { toDate } from '@/lib/utils';
import { useDateFilter } from '@/firebase/provider';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';

type PaymentReportProps = {
    records: StorageRecord[];
    unloadingRecords: UnloadingRecord[];
    customers: Customer[];
}

export function PaymentReport({ records, unloadingRecords, customers }: PaymentReportProps) {
    const [selectedCustomerId, setSelectedCustomerId] = useState<string>('all');
    const [isGenerating, setIsGenerating] = useState(false);
    
    const reportRef = useRef<HTMLDivElement>(null);
    const { dateRange } = useDateFilter();

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
        <Dialog>
            <Card>
                <CardHeader className="flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div className="flex-1">
                        <CardTitle>Payment Register</CardTitle>
                        <CardDescription>A log of all payments received.</CardDescription>
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
                    <PaymentReportTable 
                        events={paymentEvents} 
                        customers={customers}
                        title={title}
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
