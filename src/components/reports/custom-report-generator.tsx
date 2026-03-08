'use client';

import { useState } from 'react';
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

    const renderReport = () => {
        switch (selectedReport) {
            case 'daily-summary':
                return <DailySummaryReport records={records} customers={customers} unloadingRecords={unloadingRecords} expenses={expenses} />;
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
                return <StorageTable />;
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
            <Card>
                <CardHeader>
                    <CardTitle>Custom Report Generator</CardTitle>
                    <CardDescription>Select the report type and format to generate a detailed analysis.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="max-w-sm">
                        <Select onValueChange={setSelectedReport} value={selectedReport}>
                            <SelectTrigger>
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
                </CardContent>
            </Card>
            <div className="mt-6">
                {renderReport()}
            </div>
        </div>
    );
}
