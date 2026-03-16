
'use client';

import { useState, useRef, useMemo } from 'react';
import type { Customer, UnloadingRecord } from "@/lib/definitions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from '@/components/ui/button';
import { FileText, Loader2, Download } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { UnloadingReportTable } from './unloading-report-table';
import { toDate } from '@/lib/utils';
import { useDateFilter } from '@/firebase/provider';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/dialog';

type UnloadingReportProps = {
    unloadingRecords: UnloadingRecord[];
    customers: Customer[];
}

export function UnloadingReport({ unloadingRecords, customers }: UnloadingReportProps) {
    const [selectedCustomerId, setSelectedCustomerId] = useState<string>('all');
    const [isGenerating, setIsGenerating] = useState(false);
    
    const reportRef = useRef<HTMLDivElement>(null);
    const { dateRange } = useDateFilter();

    const filteredRecords = useMemo(() => {
        let records = unloadingRecords;

        if (selectedCustomerId && selectedCustomerId !== 'all') {
            records = records.filter(r => r.customerId === selectedCustomerId);
        }

        if (dateRange?.from) {
            records = records.filter(r => toDate(r.unloadingDate) >= dateRange.from!);
        }
        if (dateRange?.to) {
            const toDateObj = new Date(dateRange.to);
            toDateObj.setHours(23, 59, 59, 999); // Include the whole day
            records = records.filter(r => toDate(r.unloadingDate) <= toDateObj);
        }

        return records.sort((a,b) => toDate(b.unloadingDate).getTime() - toDate(a.unloadingDate).getTime());
    }, [unloadingRecords, selectedCustomerId, dateRange]);


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
            
            pdf.save(`unloading-report-${Date.now()}.pdf`);
        } catch (error) {
            console.error('Error generating PDF:', error);
        } finally {
            setIsGenerating(false);
        }
    };
    
    const customer = customers.find(c => c.id === selectedCustomerId);
    const title = `Unloading Register ${customer ? `for ${customer.name}` : ''}`;

    return (
        <Card>
            <CardHeader className="flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex-1">
                    <CardTitle>Unloading Register</CardTitle>
                    <CardDescription>A log of all vehicle unloading activities.</CardDescription>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto flex-wrap">
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
                    <Dialog>
                        <DialogTrigger asChild>
                            <Button>
                                <FileText className="mr-2 h-4 w-4" />
                                Generate Report
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-6xl">
                            <DialogHeader>
                                <DialogTitle>{title}</DialogTitle>
                            </DialogHeader>
                            <div className="max-h-[70vh] overflow-y-auto">
                                <div ref={reportRef}>
                                    <UnloadingReportTable 
                                        records={filteredRecords} 
                                        customers={customers}
                                        title={title}
                                    />
                                </div>
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
                        Select filters and click "Generate Report" to view.
                    </p>
                </div>
            </CardContent>
        </Card>
    );
}
