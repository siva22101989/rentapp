'use client';

import { useState, useRef, useMemo } from 'react';
import type { Customer, StorageRecord, UnloadingRecord, Expense, WarehouseInfo, Borrowing, Lending, OtherIncome, Commodity, Lot, DryingRecord, CustomerPayment } from "@/lib/definitions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import { CommodityStockReport, CustomerCommodityStockReport, LotWiseInventoryReport } from './stock-summary-reports';
import { YearlyAuditReport } from './yearly-audit-report';

const reportTypes = [
    { value: 'yearly-audit', label: 'Annual Master Audit Report' },
    { value: 'daily-summary', label: 'Daily Summary Report' },
    { value: 'commodity-summary', label: 'Commodity-wise Stock List' },
    { value: 'customer-commodity-summary', label: 'Customer-wise Commodity Stock' },
    { value: 'lot-inventory-summary', label: 'Lot-wise Inventory Register' },
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
    const [selectedReport, setSelectedReport] = useState<string>(initialReport || 'yearly-audit');
    const [isDownloading, setIsDownloading] = useState(false);
    const reportRef = useRef<HTMLDivElement>(null);
    const { toast } = useToast();

    const handleDownload = async () => {
        const printableArea = reportRef.current;
        if (!printableArea) return;

        setIsDownloading(true);
        try {
            const { default: jsPDF } = await import('jspdf');
            const pdf = new jsPDF({ 
                orientation: 'l', 
                unit: 'mm', 
                format: 'a4' 
            });

            const pdfWidth = 277;
            const virtualWidth = 1440;

            await pdf.html(printableArea, {
                html2canvas: {
                    scale: 1,
                    useCORS: true,
                    backgroundColor: '#ffffff',
                    height: printableArea.scrollHeight,
                    windowHeight: printableArea.scrollHeight
                },
                margin: [10, 10, 10, 10],
                autoPaging: 'text',
                width: pdfWidth,
                windowWidth: virtualWidth
            });
            pdf.save(`${selectedReport}-landscape-report.pdf`);
        } catch (error) {
            console.error("Error generating PDF:", error);
            toast({ title: "Download Error", description: "Failed to generate PDF.", variant: "destructive"});
        } finally {
            setIsDownloading(false);
        }
    };

    const renderReport = () => {
        switch (selectedReport) {
            case 'yearly-audit':
                return <YearlyAuditReport 
                            records={records} 
                            unloadingRecords={unloadingRecords} 
                            expenses={expenses} 
                            otherIncomes={otherIncomes} 
                            customerPayments={customerPayments}
                            borrowings={borrowings}
                            lendings={lendings}
                            warehouseInfo={warehouseInfo}
                            title="Annual Master Audit Report" 
                        />;
            case 'daily-summary':
                return <DailySummaryReport records={records} customers={customers} unloadingRecords={unloadingRecords} expenses={expenses} otherIncomes={otherIncomes} customerPayments={customerPayments} />;
            case 'commodity-summary':
                return <CommodityStockReport records={records} customers={customers} warehouseInfo={warehouseInfo} title="Commodity-wise Stock Summary" />;
            case 'customer-commodity-summary':
                return <CustomerCommodityStockReport records={records} customers={customers} warehouseInfo={warehouseInfo} title="Customer-wise Commodity Stock" />;
            case 'lot-inventory-summary':
                return <LotWiseInventoryReport records={records} customers={customers} warehouseInfo={warehouseInfo} title="Lot-wise Inventory Register" />;
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
                return <PaymentReport records={records} unloadingRecords={unloadingRecords} customers={customers} customerPayments={customerPayments} />;
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
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 print-hide bg-white p-4 rounded-xl border shadow-sm">
                <div className="flex-1 space-y-3">
                    <div className="space-y-1">
                        <label htmlFor="report-type-select" className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Audit Report Type</label>
                        <Select onValueChange={setSelectedReport} value={selectedReport}>
                            <SelectTrigger id="report-type-select" className="w-full md:w-[320px] h-10 font-bold border-2">
                                <SelectValue placeholder="Select a report type..." />
                            </SelectTrigger>
                            <SelectContent>
                                {reportTypes.map(report => (
                                    <SelectItem key={report.value} value={report.value} className="text-sm font-medium">
                                        {report.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Button onClick={() => window.print()} variant="outline" className="h-10 font-bold uppercase text-[11px] tracking-widest border-2">
                        <Printer className="mr-2 h-4 w-4" />
                        Print Landscape
                    </Button>
                    <Button onClick={handleDownload} disabled={isDownloading} className="h-10 font-black uppercase text-[11px] tracking-[0.1em] shadow-lg">
                        {isDownloading ? (
                            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> ...</>
                        ) : (
                            <><FileDown className="mr-2 h-4 w-4" /> Save Landscape PDF</>
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
