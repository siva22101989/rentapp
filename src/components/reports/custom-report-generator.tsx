'use client';

import { useState, useRef } from 'react';
import type { Customer, StorageRecord, UnloadingRecord, Expense, WarehouseInfo, Borrowing, Lending, OtherIncome, Commodity, Lot, DryingRecord } from "@/lib/definitions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CustomersTable } from '@/components/customers/customers-table';
import { ReportClient } from '@/components/reports/report-client';
import { StorageTable } from '@/components/dashboard/storage-table';
import { HamaliReport } from './hamali-report';
import { InflowReport } from './inflow-report';
import { OutflowReport } from './outflow-report';
import { UnloadingReport } from './unloading-report';
import { PaymentReport } from './payment-report';
import { DailySummaryReport } from './daily-summary-report';
import { ProfitAndLossReport } from './profit-and-loss-report';
import { Button } from '../ui/button';
import { Printer, FileDown, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { DryingHistoryTable } from '@/components/drying/drying-history-table';
import { LotStockOutflowReport } from './lot-stock-outflow-report';

const reportTypes = [
    { value: 'daily-summary', label: 'Daily Summary Report' },
    { value: 'profit-and-loss', label: 'Profit & Loss Report' },
    { value: 'lot-stock-outflow', label: 'Lot-wise Stock & Outflow Report' },
    { value: 'customer-statement', label: 'Customer Dues Statement (Detailed)' },
    { value: 'hamali-register', label: 'Hamali Register' },
    { value: 'drying-history', label: 'Drying History Report' },
    { value: 'inflow-register', label: 'Inflow Register (Date Range)' },
    { value: 'outflow-register', label: 'Outflow Register (Date Range)' },
    { value: 'unloading-register', label: 'Unloading Register (Date Range)' },
    { value: 'payment-register', label: 'Payment Register (Date Range)' },
    { value: 'active-inventory', label: 'Active Inventory (Stock)' },
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
    commodities: Commodity[];
    initialReport?: string;
    initialCustomerId?: string;
    dryingRecords: DryingRecord[];
    lots: Lot[];
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
    commodities,
    initialReport, 
    initialCustomerId,
    dryingRecords,
    lots
}: ReportGeneratorProps) {
    const [selectedReport, setSelectedReport] = useState<string>(initialReport || 'daily-summary');
    const [isDownloading, setIsDownloading] = useState(false);
    const reportRef = useRef<HTMLDivElement>(null);
    const { toast } = useToast();
    
    const handleDownload = async () => {
        const printableArea = reportRef.current;
        if (!printableArea) {
            console.error("Report area not found!");
            return;
        }

        setIsDownloading(true);
        
        try {
            const { default: jsPDF } = await import('jspdf');
            
            const pdf = new jsPDF({
                orientation: 'p',
                unit: 'mm',
                format: 'a4',
            });
            
            await pdf.html(printableArea, {
                html2canvas: {
                    scale: 2,
                    useCORS: true,
                    backgroundColor: '#ffffff',
                    height: printableArea.scrollHeight,
                    windowHeight: printableArea.scrollHeight
                },
                margin: [10, 10, 10, 10],
                autoPaging: 'text',
                width: 190, // A4 width (210mm) - 2*10mm margin
                windowWidth: printableArea.scrollWidth
            });

            pdf.save(`${selectedReport}-report.pdf`);

        } catch (error) {
            console.error("Error generating PDF:", error);
            toast({ title: "Download Error", description: "Failed to generate PDF.", variant: "destructive"});
        } finally {
            setIsDownloading(false);
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
            case 'lot-stock-outflow':
                return <LotStockOutflowReport records={records} customers={customers} />;
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
                return <Card><CardHeader className="print-hide"><CardTitle>Active Inventory Summary</CardTitle></CardHeader><CardContent><StorageTable /></CardContent></Card>;
            case 'hamali-register':
                return <HamaliReport records={records} customers={customers} unloadingRecords={unloadingRecords} expenses={expenses} warehouseInfo={warehouseInfo} />;
            case 'drying-history':
                return <DryingHistoryTable 
                            dryingRecords={dryingRecords} 
                            customers={customers} 
                            unloadingRecords={unloadingRecords} 
                            lots={lots} 
                            storageRecords={records} 
                        />;
            case 'inflow-register':
                return <InflowReport records={records} customers={customers} />;
            case 'outflow-register':
                return <OutflowReport records={records} customers={customers} />;
            case 'unloading-register':
                return <UnloadingReport unloadingRecords={unloadingRecords} customers={customers} commodities={commodities} />;
            case 'payment-register':
                return <PaymentReport records={records} unloadingRecords={unloadingRecords} customers={customers} />;
            default:
                return (
                    <Card>
                        <CardContent className="p-8 text-center text-muted-foreground">
                            This report is no longer available.
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
                     <Button onClick={() => window.print()} variant="outline">
                        <Printer className="mr-2 h-4 w-4" />
                        Print Report
                    </Button>
                     <Button onClick={handleDownload} disabled={isDownloading}>
                        {isDownloading ? (
                            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Downloading...</>
                        ) : (
                            <><FileDown className="mr-2 h-4 w-4" /> Download PDF</>
                        )}
                    </Button>
                </div>
            </div>
            <div className="mt-6 printable-area" ref={reportRef}>
                {renderReport()}
            </div>
        </div>
    );
}