'use client';

import { useState, useRef } from 'react';
import type { Customer, StorageRecord, UnloadingRecord, Expense, WarehouseInfo, Borrowing, Lending, OtherIncome, Commodity, Lot, DryingRecord } from "@/lib/definitions";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ReportClient } from '@/components/reports/report-client';
import { HamaliReport } from './hamali-report';
import { InflowReport } from './inflow-report';
import { OutflowReport } from './outflow-report';
import { UnloadingReport } from './unloading-report';
import { DailySummaryReport } from './daily-summary-report';
import { ProfitAndLossReport } from './profit-and-loss-report';
import { Button } from '../ui/button';
import { Printer, FileDown, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { PendingPaymentsTable } from '@/components/payments/pending-payments-table';
import { PaymentReport } from './payment-report';

const reportTypes = [
    { value: 'daily-summary', label: 'Daily Summary Report' },
    { value: 'profit-and-loss', label: 'Profit & Loss Report' },
    { value: 'payment-register', label: 'Payment Register' },
    { value: 'pending-dues', label: 'Pending Dues Register' },
    { value: 'customer-statement', label: 'Customer Statement of Account' },
    { value: 'hamali-register', label: 'Hamali Register' },
    { value: 'inflow-register', label: 'Inflow Register' },
    { value: 'outflow-register', label: 'Outflow Register' },
    { value: 'unloading-register', label: 'Unloading Register' },
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
}: ReportGeneratorProps) {
    const [selectedReport, setSelectedReport] = useState<string>(initialReport || 'daily-summary');
    const [isDownloading, setIsDownloading] = useState(false);
    const reportRef = useRef<HTMLDivElement>(null);
    const { toast } = useToast();
    
    const handleDownload = async () => {
        const printableArea = reportRef.current;
        if (!printableArea) return;

        setIsDownloading(true);
        try {
            const { default: jsPDF } = await import('jspdf');
            const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
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
                width: 190,
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
            case 'payment-register':
                return <PaymentReport records={records} unloadingRecords={unloadingRecords} customers={customers} />;
            case 'pending-dues':
                return <PendingPaymentsTable 
                            records={records} 
                            customers={customers} 
                            unloadingRecords={unloadingRecords}
                            title="Pending Dues Register"
                        />;
            case 'customer-statement':
                return <ReportClient 
                            records={records} 
                            customers={customers} 
                            unloadingRecords={unloadingRecords} 
                            initialCustomerId={initialCustomerId}
                        />;
            case 'hamali-register':
                return <HamaliReport records={records} customers={customers} unloadingRecords={unloadingRecords} expenses={expenses} warehouseInfo={warehouseInfo} />;
            case 'inflow-register':
                return <InflowReport records={records} customers={customers} />;
            case 'outflow-register':
                return <OutflowReport records={records} customers={customers} commodities={commodities} lots={[]} />;
            case 'unloading-register':
                return <UnloadingReport unloadingRecords={unloadingRecords} customers={customers} commodities={commodities} />;
            default:
                return (
                    <Card>
                        <CardContent className="p-8 text-center text-muted-foreground">
                            Please select a report from the dropdown above.
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
                        <SelectTrigger id="report-type-select" className="mt-1 w-full md:w-auto text-sm h-9">
                            <SelectValue placeholder="Select a report type..." />
                        </SelectTrigger>
                        <SelectContent>
                            {reportTypes.map(report => (
                                <SelectItem key={report.value} value={report.value} className="text-sm">
                                    {report.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="self-end flex items-center gap-2">
                     <Button onClick={() => window.print()} variant="outline" size="sm">
                        <Printer className="mr-2 h-4 w-4" />
                        Print Report
                    </Button>
                     <Button onClick={handleDownload} disabled={isDownloading} size="sm">
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
