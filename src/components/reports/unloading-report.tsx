
'use client';

import { useState, useMemo } from 'react';
import type { Customer, UnloadingRecord, Commodity } from "@/lib/definitions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UnloadingReportTable } from './unloading-report-table';
import { toDate } from '@/lib/utils';
import { useDateFilter } from '@/firebase/provider';
import { useAppUser } from '@/firebase/auth/use-user';
import { useCollection } from '@/firebase/firestore/use-collection';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { collection } from 'firebase/firestore';
import { useFirestore } from '@/firebase/provider';

type UnloadingReportProps = {
    unloadingRecords: UnloadingRecord[];
    customers: Customer[];
    commodities: Commodity[];
}

export function UnloadingReport({ unloadingRecords, customers, commodities }: UnloadingReportProps) {
    const [selectedCustomerId, setSelectedCustomerId] = useState<string>('all');
    
    const { dateRange } = useDateFilter();

    const filteredRecords = useMemo(() => {
        let records = unloadingRecords;

        if (selectedCustomerId && selectedCustomerId !== 'all') {
            records = records.filter(r => r.customerId === selectedCustomerId);
        }

        if (dateRange?.from) {
            records = records.filter(r => toDate(r.unloadingDate) >= dateRange.from!);
        }
        if (dateRange?.to) {
            const toDateObj = new Date(dateRange.to);
            toDateObj.setHours(23, 59, 59, 999); // Include the whole day
            records = records.filter(r => toDate(r.unloadingDate) <= toDateObj);
        }

        return records.sort((a,b) => toDate(b.unloadingDate).getTime() - toDate(a.unloadingDate).getTime());
    }, [unloadingRecords, selectedCustomerId, dateRange]);

    const customer = customers.find(c => c.id === selectedCustomerId);
    const title = `Unloading Register ${customer ? `for ${customer.name}` : ''}`;

    return (
        <Card>
            <CardHeader className="flex-col md:flex-row items-start md:items-center justify-between gap-4 print-hide">
                <div className="flex-1">
                    <CardTitle>Unloading Register</CardTitle>
                    <CardDescription>A log of all vehicle unloading activities.</CardDescription>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto flex-wrap">
                    <Select onValueChange={setSelectedCustomerId} value={selectedCustomerId}>
                        <SelectTrigger className="w-full sm:w-[200px]">
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
                    <UnloadingReportTable 
                        records={filteredRecords} 
                        customers={customers}
                        title={title}
                        commodities={commodities}
                    />
                </div>
            </CardContent>
        </Card>
    );
}
