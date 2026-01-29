'use client';

import { useState } from 'react';
import type { Customer, StorageRecord, UnloadingRecord, Expense, DryingRecord } from "@/lib/definitions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CustomersTable } from '@/components/customers/customers-table';
import { ReportClient } from '@/components/reports/report-client';
import { StorageTable } from '@/components/dashboard/storage-table';
import { PendingPaymentsTable } from '@/components/payments/pending-payments-table';
import { HamaliReport } from './hamali-report';

const reportTypes = [
    { value: 'all-customers', label: 'All Customers List' },
    { value: 'customer-statement', label: 'Customer Dues Statement (Detailed)' },
    { value: 'active-inventory', label: 'Active Inventory (Stock)' },
    { value: 'pending-dues', label: 'Pending Dues List' },
    { value: 'hamali-register', label: 'Hamali Register' },
    { value: 'inflow-register', label: 'Inflow Register (Date Range)' },
    { value: 'outflow-register', label: 'Outflow Register (Date Range)' },
    { value: 'payment-register', label: 'Payment Register (Date Range)' },
    { value: 'lot-inventory', label: 'Lot Inventory (Patti mapping)' },
    { value: 'recent-transactions', label: 'Recent Transactions (Last 1000)' },
];

type ReportGeneratorProps = {
    records: StorageRecord[];
    customers: Customer[];
    unloadingRecords: UnloadingRecord[];
    expenses: Expense[];
    dryingRecords: DryingRecord[];
}

export function CustomReportGenerator({ records, customers, unloadingRecords, expenses, dryingRecords }: ReportGeneratorProps) {
    const [selectedReport, setSelectedReport] = useState<string>('hamali-register');

    const renderReport = () => {
        switch (selectedReport) {
            case 'all-customers':
                return <CustomersTable customers={customers} />;
            case 'customer-statement':
                return <ReportClient records={records} customers={customers} unloadingRecords={unloadingRecords} />;
            case 'active-inventory':
                return <StorageTable />;
            case 'pending-dues':
                return <PendingPaymentsTable records={records} customers={customers} />;
            case 'hamali-register':
                return <HamaliReport records={records} customers={customers} unloadingRecords={unloadingRecords} dryingRecords={dryingRecords} />;
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
