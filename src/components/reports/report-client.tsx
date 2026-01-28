'use client';

import { useState, useRef } from 'react';
import type { Customer, StorageRecord, UnloadingRecord } from "@/lib/definitions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from '@/components/ui/button';
import { Download, Loader2, UserSearch } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { CustomerStatement } from './customer-statement';

export function ReportClient({ records, customers, unloadingRecords }: { records: StorageRecord[], customers: Customer[], unloadingRecords: UnloadingRecord[] }) {
    const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
    const [isGenerating, setIsGenerating] = useState(false);
    
    const statementReportRef = useRef<HTMLDivElement>(null);

    const statementCustomer = customers.find(c => c.id === selectedCustomerId);
    const statementRecords = records.filter(r => r.customerId === selectedCustomerId);
    const statementUnloadingRecords = unloadingRecords.filter(r => r.customerId === selectedCustomerId);

    const handleDownloadPdf = async () => {
        const element = statementReportRef.current;
        if (!element) return;

        setIsGenerating(true);

        try {
            const canvas = await html2canvas(element, { scale: 2, useCORS: true, backgroundColor: '#ffffff', windowWidth: element.scrollWidth, windowHeight: element.scrollHeight });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4'); // Portrait orientation
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            const imgWidth = canvas.width;
            const imgHeight = canvas.height;
            const ratio = imgWidth / imgHeight;
            
            let widthInPdf = pdfWidth - 20; // 10mm margin on each side
            let heightInPdf = widthInPdf / ratio;

            if (heightInPdf > pdfHeight - 20) { // If it's too tall, scale down
                heightInPdf = pdfHeight - 20;
                widthInPdf = heightInPdf * ratio;
            }

            const x = (pdfWidth - widthInPdf) / 2;
            const y = 10; // 10mm top margin

            pdf.addImage(imgData, 'PNG', x, y, widthInPdf, heightInPdf);
            pdf.save(`statement-${selectedCustomerId}-${Date.now()}.pdf`);
        } catch (error) {
            console.error('Error generating PDF:', error);
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <Card>
            <CardHeader className="flex-col md:flex-row items-center justify-between gap-4">
                <CardTitle className="flex-1">
                    Customer Statement of Account
                </CardTitle>
                <div className="flex items-center gap-4 w-full md:w-auto">
                     <Select onValueChange={setSelectedCustomerId} value={selectedCustomerId}>
                        <SelectTrigger className="w-full md:w-[280px]">
                            <SelectValue placeholder="Select a customer..." />
                        </SelectTrigger>
                        <SelectContent>
                            {customers.map(customer => (
                                <SelectItem key={customer.id} value={customer.id}>
                                    {customer.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Button onClick={handleDownloadPdf} disabled={isGenerating || !selectedCustomerId}>
                        {isGenerating ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Downloading...
                            </>
                        ) : (
                            <>
                                <Download className="mr-2 h-4 w-4" />
                                Download PDF
                            </>
                        )}
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                {statementCustomer ? (
                    <div ref={statementReportRef}>
                        <CustomerStatement customer={statementCustomer} records={statementRecords} unloadingRecords={statementUnloadingRecords} />
                    </div>
                ) : (
                    <div className="text-center text-muted-foreground py-16">
                        <UserSearch className="mx-auto h-12 w-12" />
                        <p className="mt-4">
                            Please select a customer to generate their statement.
                        </p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
