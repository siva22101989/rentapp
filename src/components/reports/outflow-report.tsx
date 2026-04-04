
'use client';

import { useState, useMemo } from 'react';
import type { Customer, StorageRecord, Outflow } from "@/lib/definitions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { OutflowReportTable, type OutflowEvent } from './outflow-report-table';
import { toDate } from '@/lib/utils';
import { useDateFilter } from '@/firebase/provider';
import { useAppUser } from '@/firebase/auth/use-user';
import { useCollection } from '@/firebase/firestore/use-collection';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { collection } from 'firebase/firestore';
import { useFirestore } from '@/firebase/provider';

type OutflowReportProps = {
    records: StorageRecord[];
    customers: Customer[];
}

export function OutflowReport({ records, customers }: OutflowReportProps) {
    const [selectedCustomerId, setSelectedCustomerId] = useState<string>('all');
    
    const { dateRange } = useDateFilter();

    const outflowEvents = useMemo(() => {
        const events: OutflowEvent[] = [];
        records.forEach(record => {
            if (record.outflows && Array.isArray(record.outflows)) {
                record.outflows.forEach(outflow => {
                    events.push({
                        ...outflow,
                        date: toDate(outflow.date),
                        customerId: record.customerId,
                        recordId: record.id,
                        commodityDescription: record.commodityDescription,
                        location: record.location,
                    });
                });
            }
        });

        let filteredEvents = events;

        if (selectedCustomerId && selectedCustomerId !== 'all') {
            filteredEvents = filteredEvents.filter(r => r.customerId === selectedCustomerId);
        }
        if (dateRange?.from) {
            filteredEvents = filteredEvents.filter(r => r.date >= dateRange.from!);
        }
        if (dateRange?.to) {
            const toDateObj = new Date(dateRange.to);
            toDateObj.setHours(23, 59, 59, 999); // Include the whole day
            filteredEvents = filteredEvents.filter(r => r.date <= toDateObj);
        }

        return filteredEvents.sort((a,b) => b.date.getTime() - a.date.getTime());
    }, [records, selectedCustomerId, dateRange]);
    
    const customer = customers.find(c => c.id === selectedCustomerId);
    const title = `Outflow Register ${customer ? `for ${customer.name}` : ''}`;

    return (
        <Card>
            <CardHeader className="flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex-1">
                    <CardTitle>Outflow Register</CardTitle>
                    <CardDescription>A log of all items withdrawn from storage.</CardDescription>
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
                    <OutflowReportTable 
                        events={outflowEvents} 
                        customers={customers}
                        title={title}
                        allRecords={records}
                    />
                </div>
            </CardContent>
        </Card>
    );
}
