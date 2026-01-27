
'use client';

import { useState, useRef } from 'react';
import type { Customer, StorageRecord } from "@/lib/definitions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from '@/components/ui/button';
import { Download, Loader2, UserSearch } from 'lucide-react';
import { ReportTable } from './report-table';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { CustomerStatement } from './customer-statement';

export function ReportClient({ records, customers }: { records: StorageRecord[], customers: Customer[] }) {
    const [selectedCustomerId, setSelectedCustomerId] = useState<string>('all');
    const [statementCustomerId, setStatementCustomerId] = useState<string>('');
    const [activeTab, setActiveTab] = useState('inflow');
    const [isGenerating, setIsGenerating] = useState(false);
    
    const inflowReportRef = useRef<HTMLDivElement>(null);
    const outflowReportRef = useRef<HTMLDivElement>(null);
    const statementReportRef = useRef<HTMLDivElement>(null);

    const filteredRecords = selectedCustomerId === 'all'
        ? records
        : records.filter(record => record.customerId === selectedCustomerId);

    const inflowRecords = filteredRecords;
    const outflowRecords = filteredRecords.filter(record => record.storageEndDate);

    const statementCustomer = customers.find(c => c.id === statementCustomerId);
    const statementRecords = records.filter(r => r.customerId === statementCustomerId);

    const handleDownloadPdf = async () => {
        let element: HTMLDivElement | null = null;
        let orientation: 'l' | 'p' = 'l'; // landscape for most
        
        if (activeTab === 'inflow') {
            element = inflowReportRef.current;
        } else if (activeTab === 'outflow') {
            element = outflowReportRef.current;
        } else if (activeTab === 'statement') {
            element = statementReportRef.current;
            orientation = 'p'; // portrait for statement
        }

        if (!element) return;

        setIsGenerating(true);

        try {
            const canvas = await html2canvas(element, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF(orientation, 'mm', 'a4');
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
            pdf.save(`${activeTab}-report-${selectedCustomerId}-${Date.now()}.pdf`);
        } catch (error) {
            console.error('Error generating PDF:', error);
        } finally {
            setIsGenerating(false);
        }
    };


    const selectedCustomerName = selectedCustomerId === 'all' ? 'All Customers' : customers.find(c => c.id === selectedCustomerId)?.name;

    return (
        <Tabs defaultValue="inflow" onValueChange={setActiveTab}>
            <Card>
                <CardHeader className="flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div className='flex-1'>
                        <TabsList>
                            <TabsTrigger value="inflow">Inflow Report</TabsTrigger>
                            <TabsTrigger value="outflow">Outflow Report</TabsTrigger>
                            <TabsTrigger value="statement">Customer Statement</TabsTrigger>
                        </TabsList>
                    </div>
                    <div className="flex items-center gap-4 w-full md:w-auto">
                        {activeTab !== 'statement' && (
                             <Select onValueChange={setSelectedCustomerId} defaultValue="all">
                                <SelectTrigger className="w-full md:w-[280px]">
                                    <SelectValue placeholder="Filter by customer..." />
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
                        )}
                        <Button onClick={handleDownloadPdf} disabled={isGenerating}>
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
                    <TabsContent value="inflow">
                        <div ref={inflowReportRef} className="printable-area">
                            <ReportTable records={inflowRecords} customers={customers} title={`Inflow Report for ${selectedCustomerName}`} />
                        </div>
                    </TabsContent>
                     <TabsContent value="outflow">
                        <div ref={outflowReportRef} className="printable-area">
                            <ReportTable records={outflowRecords} customers={customers} title={`Outflow Report for ${selectedCustomerName}`} />
                        </div>
                    </TabsContent>
                    <TabsContent value="statement">
                        <div className="flex flex-col gap-4">
                             <Select onValueChange={setStatementCustomerId} value={statementCustomerId}>
                                <SelectTrigger className="w-full md:w-[380px] mx-auto">
                                    <SelectValue placeholder="Select a customer to generate their statement..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {customers.map(customer => (
                                        <SelectItem key={customer.id} value={customer.id}>
                                            {customer.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            {statementCustomer && statementRecords.length > 0 ? (
                                <div ref={statementReportRef}>
                                    <CustomerStatement customer={statementCustomer} records={statementRecords} />
                                </div>
                            ) : (
                                <div className="text-center text-muted-foreground py-16">
                                    <UserSearch className="mx-auto h-12 w-12" />
                                    <p className="mt-4">
                                        {statementCustomerId ? "No records found for this customer." : "Please select a customer to view their statement."}
                                    </p>
                                </div>
                            )}
                        </div>
                    </TabsContent>
                </CardContent>
            </Card>
        </Tabs>
    );
}
