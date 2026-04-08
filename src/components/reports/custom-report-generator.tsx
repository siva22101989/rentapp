
'use client';

import { useState, useRef, useEffect } from 'react';
import type { Customer, StorageRecord, UnloadingRecord, Expense, WarehouseInfo, Borrowing, Lending, OtherIncome } from "@/lib/definitions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CustomersTable } from '@/components/customers/customers-table';
import { ReportClient } from '@/components/reports/report-client';
import { StorageTable } from '@/components/dashboard/storage-table';
import { PendingPaymentsTable } from '@/components/payments/pending-payments-table';
import { HamaliReport } from './hamali-report';
import { InflowReport } from './inflow-report';
import { OutflowReport } from './outflow-report';
import { LotInventoryReport } from './lot-inventory-report';
import { UnloadingReport } from './unloading-report';
import { PaymentReport } from './payment-report';
import { DailySummaryReport } from './daily-summary-report';
import { ProfitAndLossReport } from './profit-and-loss-report';
import { Button } from '../ui/button';
import { Printer, FileDown, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";

const reportTypes = [
    { value: 'daily-summary', label: 'Daily Summary Report' },
    { value: 'profit-and-loss', label: 'Profit & Loss Report' },
    { value: 'customer-statement', label: 'Customer Dues Statement (Detailed)' },
    { value: 'hamali-register', label: 'Hamali Register' },
    { value: 'inflow-register', label: 'Inflow Register (Date Range)' },
    { value: 'outflow-register', label: 'Outflow Register (Date Range)' },
    { value: 'unloading-register', label: 'Unloading Register (Date Range)' },
    { value: 'payment-register', label: 'Payment Register (Date Range)' },
    { value: 'lot-inventory', label: 'Lot Inventory (Patti mapping)' },
    { value: 'active-inventory', label: 'Active Inventory (Stock)' },
    { value: 'pending-dues', label: 'Pending Dues List' },
    { value: 'all-customers', label: 'All Customers List' },
];

type ReportGeneratorProps = {
    records: StorageRecord[];
    customers: Customer[];
    unloadingRecords: UnloadingRecord[];
    expenses: Expense[];
    warehouseInfo: WarehouseInfo | null;
    borrowings: Borrowing[];
    lendings: Lending[];
    otherIncomes: OtherIncome[];
    initialReport?: string;
    initialCustomerId?: string;
}

export function CustomReportGenerator({ 
    records, 
    customers, 
    unloadingRecords, 
    expenses, 
    warehouseInfo, 
    borrowings, 
    lendings, 
    otherIncomes, 
    initialReport, 
    initialCustomerId 
}: ReportGeneratorProps) {
    const [selectedReport, setSelectedReport] = useState<string>(initialReport || 'daily-summary');
    const [isDownloading, setIsDownloading] = useState(false);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const reportRef = useRef<HTMLDivElement>(null);
    const { toast } = useToast();
    
    useEffect(() => {
        if (isPreviewOpen) {
          document.body.classList.add('print-dialog-is-open');
        } else {
          document.body.classList.remove('print-dialog-is-open');
        }
        return () => {
          document.body.classList.remove('print-dialog-is-open');
        };
    }, [isPreviewOpen]);

    const handlePrint = () => {
        window.print();
    };

    const handleDownload = async () => {
        const printableArea = reportRef.current;
        if (!printableArea) {
            console.error("Report area not found!");
            return;
        }

        setIsDownloading(true);
        document.body.classList.add('pdf-generating');
        
        try {
            const { default: jsPDF } = await import('jspdf');
            const { default: html2canvas } = await import('html2canvas');
            
            const canvas = await html2canvas(printableArea, { 
                scale: 2,
                useCORS: true,
                onclone: (document) => {
                    const printStyles = document.createElement('style');
                    printStyles.innerHTML = `
                        .pdf-generating .print-hide { display: none !important; }
                        .pdf-generating .badge-print, .pdf-generating [data-badge] {
                            background-color: transparent !important;
                            color: #000 !important;
                            border: 1px solid #ccc !important;
                            box-shadow: none !important;
                            -webkit-print-color-adjust: exact !important;
                            print-color-adjust: exact !important;
                        }
                    `;
                    document.head.appendChild(printStyles);
                }
            });

            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            const canvasWidth = canvas.width;
            const canvasHeight = canvas.height;
            const ratio = canvasWidth / pdfWidth;
            const imgHeight = canvasHeight / ratio;
            
            let heightLeft = imgHeight;
            let position = 0;

            pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
            heightLeft -= pdfHeight;

            while (heightLeft > 0) {
                position -= pdfHeight;
                pdf.addPage();
                pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
                heightLeft -= pdfHeight;
            }

            pdf.save(`${selectedReport}-report.pdf`);
        } catch (error) {
            console.error("Error generating PDF:", error);
            toast({ title: "Download Error", description: "Failed to generate PDF.", variant: "destructive"});
        } finally {
            document.body.classList.remove('pdf-generating');
            setIsDownloading(false);
            setIsPreviewOpen(false);
        }
    };

    const renderReport = () => {
        switch (selectedReport) {
            case 'daily-summary':
                return <DailySummaryReport records={records} customers={customers} unloadingRecords={unloadingRecords} expenses={expenses} otherIncomes={otherIncomes} />;
            case 'profit-and-loss':
                return <ProfitAndLossReport 
                    allRecords={records}
                    allExpenses={expenses}
                    allUnloadingRecords={unloadingRecords}
                    otherIncomes={otherIncomes}
                    warehouseInfo={warehouseInfo}
                    borrowings={borrowings}
                    lendings={lendings}
                />;
            case 'all-customers':
                return <CustomersTable customers={customers} />;
            case 'customer-statement':
                return <ReportClient 
                            records={records} 
                            customers={customers} 
                            unloadingRecords={unloadingRecords} 
                            initialCustomerId={initialCustomerId}
                        />;
            case 'active-inventory':
                return <Card><CardHeader><CardTitle>Active Inventory Summary</CardTitle></CardHeader><CardContent><StorageTable /></CardContent></Card>;
            case 'pending-dues':
                return <PendingPaymentsTable records={records} customers={customers} unloadingRecords={unloadingRecords} />;
            case 'hamali-register':
                return <HamaliReport records={records} customers={customers} unloadingRecords={unloadingRecords} expenses={expenses} />;
            case 'inflow-register':
                return <InflowReport records={records} customers={customers} />;
            case 'outflow-register':
                return <OutflowReport records={records} customers={customers} />;
            case 'unloading-register':
                return <UnloadingReport unloadingRecords={unloadingRecords} customers={customers} />;
            case 'payment-register':
                return <PaymentReport records={records} unloadingRecords={unloadingRecords} customers={customers} />;
            case 'lot-inventory':
                return <LotInventoryReport records={records} customers={customers} />;
            default:
                return (
                    <Card>
                        <CardContent className="p-8 text-center text-muted-foreground">
                            This report is not yet available.
                        </CardContent>
                    </Card>
                );
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 print-hide">
                <div>
                    <label htmlFor="report-type-select" className="text-sm font-medium text-muted-foreground">Select Report Type</label>
                    <Select onValueChange={setSelectedReport} value={selectedReport}>
                        <SelectTrigger id="report-type-select" className="mt-1 w-full md:w-auto">
                            <SelectValue placeholder="Select a report type..." />
                        </SelectTrigger>
                        <SelectContent>
                            {reportTypes.map(report => (
                                <SelectItem key={report.value} value={report.value}>
                                    {report.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="self-end flex items-center gap-2">
                     <Button onClick={handlePrint} variant="outline">
                        <Printer className="mr-2 h-4 w-4" />
                        Print Report
                    </Button>
                     <Button onClick={() => setIsPreviewOpen(true)}>
                        <FileDown className="mr-2 h-4 w-4" />
                        Download PDF
                    </Button>
                </div>
            </div>
            <div className="mt-6 printable-area">
                {renderReport()}
            </div>

            <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
                <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle>Report Preview</DialogTitle>
                        <DialogDescription>
                            Review your report below. When ready, click Download PDF.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex-1 overflow-y-auto p-2 border bg-secondary/30 rounded-md">
                        <div ref={reportRef}>
                           {renderReport()}
                        </div>
                    </div>
                    <DialogFooter className="print-hide">
                        <DialogClose asChild>
                            <Button variant="outline">Close</Button>
                        </DialogClose>
                        <Button onClick={handleDownload} disabled={isDownloading}>
                            {isDownloading ? (
                                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Downloading...</>
                            ) : (
                                <><FileDown className="mr-2 h-4 w-4" /> Download PDF</>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
