
'use client';

import { useState, useRef, useMemo } from 'react';
import type { Customer, StorageRecord } from "@/lib/definitions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from '@/components/ui/button';
import { Printer, Download } from 'lucide-react';
import { InflowReportTable } from './inflow-report-table';
import { toDate } from '@/lib/utils';
import { useDateFilter } from '@/firebase/provider';
import { printElement } from '@/lib/print-util';

type InflowReportProps = {
    records: StorageRecord[];
    customers: Customer[];
}

export function InflowReport({ records, customers }: InflowReportProps) {
    const [selectedCustomerId, setSelectedCustomerId] = useState<string>('all');
    
    const reportRef = useRef<HTMLDivElement>(null);
    const { dateRange } = useDateFilter();

    const inflowRecords = useMemo(() => {
        let filteredRecords = records;

        if (selectedCustomerId && selectedCustomerId !== 'all') {
            filteredRecords = filteredRecords.filter(r => r.customerId === selectedCustomerId);
        }
        if (dateRange?.from) {
            filteredRecords = filteredRecords.filter(r => toDate(r.storageStartDate) >= dateRange.from!);
        }
        if (dateRange?.to) {
            const toDateObj = new Date(dateRange.to);
            toDateObj.setHours(23, 59, 59, 999); // Include the whole day
            filteredRecords = filteredRecords.filter(r => toDate(r.storageStartDate) <= toDateObj);
        }

        return filteredRecords.sort((a,b) => toDate(b.storageStartDate).getTime() - toDate(a.storageStartDate).getTime());
    }, [records, selectedCustomerId, dateRange]);


    const handleGenerate = () => {
        const element = reportRef.current;
        if (!element) return;
        const customer = customers.find(c => c.id === selectedCustomerId);
        const title = `Inflow Register ${customer ? `for ${customer.name}` : ''}`;
        printElement(element, title);
    };

    const customer = customers.find(c => c.id === selectedCustomerId);
    const title = `Inflow Register ${customer ? `for ${customer.name}` : ''}`;

    return (
        <Card>
            <CardHeader className="flex-col md:flex-row items-start md:items-center justify-between gap-4 print-hide">
                <div className="flex-1">
                    <CardTitle>Inflow Register</CardTitle>
                    <CardDescription>A log of all items received into storage.</CardDescription>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto flex-wrap">
                    <Select onValueChange={setSelectedCustomerId} value={selectedCustomerId}>
                        <SelectTrigger className="w-full sm:w-auto">
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
                     <Button variant="outline" onClick={handleGenerate}>
                        <Printer className="mr-2 h-4 w-4" /> Print
                    </Button>
                    <Button onClick={handleGenerate}>
                        <Download className="mr-2 h-4 w-4" />
                        Download PDF
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                <div ref={reportRef}>
                    <InflowReportTable 
                        records={inflowRecords} 
                        customers={customers}
                        title={title}
                        allRecords={records}
                    />
                </div>
            </CardContent>
        </Card>
    );
}
