'use client';

import { useState, useRef, useMemo } from 'react';
import type { Customer, StorageRecord, UnloadingRecord, Expense, WarehouseInfo, Borrowing, Lending, OtherIncome, Commodity, Lot, DryingRecord, CustomerPayment } from "@/lib/definitions";
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
import { PaymentReport } from './payment-report';
import { PendingDuesReportTable } from './pending-dues-report-table';
import { toDate } from '@/lib/utils';

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
    lots: Lot[];
    customerPayments?: CustomerPayment[];
    initialReport?: string;
    initialCustomerId?: string;
    dryingRecords: DryingRecord[];
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
    lots,
    customerPayments = [],
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
                            customerPayments={customerPayments}
                        />;
            case 'payment-register':
                return <PaymentReport records={records} unloadingRecords={unloadingRecords} customers={customers} />;
            case 'pending-dues': {
                const summaryMap: Record<string, any> = {};
                records.forEach(r => {
                    if (!summaryMap[r.customerId]) summaryMap[r.customerId] = { hLiability: 0, rLiability: 0, totalPaid: 0 };
                    summaryMap[r.customerId].hLiability += r.hamaliPayable || 0;
                    summaryMap[r.customerId].rLiability += (r.totalRentBilled || 0) + (r.khataAmount || 0);
                    summaryMap[r.customerId].totalPaid += (r.payments || []).reduce((acc, p) => acc + p.amount, 0);
                });
                unloadingRecords.forEach(r => {
                    if (!summaryMap[r.customerId]) summaryMap[r.customerId] = { hLiability: 0, rLiability: 0, totalPaid: 0 };
                    const remaining = Math.max(0, r.bagsUnloaded - (r.bagsSentToDrying || 0));
                    summaryMap[r.customerId].hLiability += remaining * (r.hamaliPerBag || 0);
                    summaryMap[r.customerId].totalPaid += (r.payments || []).reduce((acc, p) => acc + p.amount, 0);
                });
                customerPayments.forEach(cp => {
                    if (!summaryMap[cp.customerId]) summaryMap[cp.customerId] = { hLiability: 0, rLiability: 0, totalPaid: 0 };
                    summaryMap[cp.customerId].totalPaid += (cp.amount || 0);
                });
                const summaries = Object.entries(summaryMap).map(([id, d]) => {
                    const balance = Math.max(0, (d.hLiability + d.rLiability) - d.totalPaid);
                    if (balance < 0.5) return null;
                    return {
                        customerId: id,
                        customerName: customers.find(c => c.id === id)?.name || 'Unknown',
                        totalBilled: d.hLiability + d.rLiability,
                        amountPaid: d.totalPaid,
                        balanceDue: balance,
                        hamaliPending: Math.max(0, d.hLiability - d.totalPaid),
                        rentPending: Math.max(0, balance - Math.max(0, d.hLiability - d.totalPaid))
                    };
                }).filter(s => s !== null);

                return <PendingDuesReportTable 
                            summaries={summaries as any} 
                            title="Pending Dues Register"
                            customers={customers}
                            storageRecords={records}
                            unloadingRecords={unloadingRecords}
                            customerPayments={customerPayments}
                            isReport={true}
                        />;
            }
            case 'customer-statement':
                return <ReportClient 
                            records={records} 
                            customers={customers} 
                            unloadingRecords={unloadingRecords} 
                            initialCustomerId={initialCustomerId}
                            allRecords={records}
                            commodities={commodities}
                            lots={lots}
                            customerPayments={customerPayments}
                        />;
            case 'hamali-register':
                return <HamaliReport records={records} customers={customers} unloadingRecords={unloadingRecords} expenses={expenses} warehouseInfo={warehouseInfo} />;
            case 'inflow-register':
                return <InflowReport records={records} customers={customers} />;
            case 'outflow-register':
                return <OutflowReport records={records} customers={customers} commodities={commodities} lots={lots} />;
            case 'unloading-register':
                return <UnloadingReport unloadingRecords={unloadingRecords} customers={customers} commodities={commodities} lots={lots} storageRecords={records} />;
            default:
                return null;
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