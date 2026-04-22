
'use client';

import { useState, useMemo } from 'react';
import type { Customer, StorageRecord } from "@/lib/definitions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { InflowReportTable } from './inflow-report-table';
import { toDate } from '@/lib/utils';
import { useDateFilter } from '@/firebase/provider';
import { useAppUser } from '@/firebase/auth/use-user';
import { useCollection } from '@/firebase/firestore/use-collection';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { collection } from 'firebase/firestore';
import { useFirestore } from '@/firebase/provider';

type InflowReportProps = {
    records: StorageRecord[];
    customers: Customer[];
}

export function InflowReport({ records, customers }: InflowReportProps) {
    const [selectedCustomerId, setSelectedCustomerId] = useState<string>('all');
    
    const { dateRange, financialYear } = useDateFilter();

    const inflowRecords = useMemo(() => {
        let filteredRecords = records;

        if (selectedCustomerId && selectedCustomerId !== 'all') {
            filteredRecords = filteredRecords.filter(r => r.customerId === selectedCustomerId);
        }
        
        if (financialYear !== 'all-time' && dateRange) {
            if (dateRange.from) {
                filteredRecords = filteredRecords.filter(r => toDate(r.storageStartDate) >= dateRange.from!);
            }
            if (dateRange.to) {
                const toDateObj = new Date(dateRange.to);
                toDateObj.setHours(23, 59, 59, 999); // Include the whole day
                filteredRecords = filteredRecords.filter(r => toDate(r.storageStartDate) <= toDateObj);
            }
        }

        return filteredRecords.sort((a,b) => toDate(b.storageStartDate).getTime() - toDate(a.storageStartDate).getTime());
    }, [records, selectedCustomerId, dateRange, financialYear]);

    const customer = customers.find(c => c.id === selectedCustomerId);
    const description = "A log of all items received into storage.";
    const title = `Inflow Register ${customer ? `for ${customer.name}` : ''}`;

    return (
        <Card className="report-card">
            <CardHeader className="flex-col md:flex-row items-start md:items-center justify-between gap-4 print-hide">
                <div className="flex-1">
                    <CardTitle>Inflow Register</CardTitle>
                    <CardDescription>{description}</CardDescription>
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
                </div>
            </CardHeader>
            <CardContent>
                <div>
                    <InflowReportTable 
                        records={inflowRecords} 
                        customers={customers}
                        title={title}
                        description={description}
                        allRecords={records}
                    />
                </div>
            </CardContent>
        </Card>
    );
}
