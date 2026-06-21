'use client';

import { useState, useMemo } from 'react';
import type { Customer, StorageRecord, Outflow, Commodity, Lot, WarehouseInfo } from "@/lib/definitions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { OutflowReportTable, type OutflowEvent } from './outflow-report-table';
import { toDate } from '@/lib/utils';
import { useDateFilter } from '@/firebase/provider';
import { useFirestore, useDoc, useAppUser } from '@/firebase';
import { doc } from 'firebase/firestore';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';

type OutflowReportProps = {
    records: StorageRecord[];
    customers: Customer[];
    commodities: Commodity[];
    lots: Lot[];
}

export function OutflowReport({ records, customers, commodities, lots }: OutflowReportProps) {
    const [selectedCustomerId, setSelectedCustomerId] = useState<string>('all');
    const firestore = useFirestore();
    const appUser = useAppUser();
    const { dateRange, financialYear } = useDateFilter();

    const warehouseInfoRef = useMemoFirebase(
      () => (firestore && appUser?.warehouseId ? doc(firestore, 'warehouses', appUser.warehouseId) : null),
      [firestore, appUser]
    );
    const { data: warehouseInfo } = useDoc<WarehouseInfo>(warehouseInfoRef);

    const consolidatedOutflowEvents = useMemo(() => {
        const eventsMap: Record<string, OutflowEvent> = {};
        
        records.forEach(record => {
            if (Array.isArray(record.outflows)) {
                record.outflows.forEach((outflow, index) => {
                    const outflowDate = toDate(outflow.date);
                    
                    if (financialYear !== 'all-time' && dateRange) {
                        if (dateRange.from && outflowDate < dateRange.from) return;
                        if (dateRange.to) {
                            const toDateObj = new Date(dateRange.to);
                            toDateObj.setHours(23, 59, 59, 999);
                            if (outflowDate > toDateObj) return;
                        }
                    }

                    if (selectedCustomerId !== 'all' && record.customerId !== selectedCustomerId) return;

                    // Strictly numerical grouping by Patti/Bill No
                    const pattiNoRaw = String(outflow.pattiNo || '').replace(/\D/g, '');
                    const fallbackId = String(record.id).replace(/\D/g, '');
                    const displayId = pattiNoRaw || fallbackId;

                    // Group unique transactions by Customer + Bill No
                    const groupKey = `${record.customerId}-${displayId}`;
                    
                    if (eventsMap[groupKey]) {
                        eventsMap[groupKey].bagsWithdrawn += Number(outflow.bagsWithdrawn) || 0;
                        eventsMap[groupKey].rentBilled += Number(outflow.rentBilled) || 0;
                        
                        // Track if the bill spans multiple lots
                        if (record.location && !eventsMap[groupKey].location?.includes(record.location)) {
                            eventsMap[groupKey].location = eventsMap[groupKey].location === 'Multiple' 
                                ? 'Multiple' 
                                : `Multiple (${eventsMap[groupKey].location}, ${record.location})`;
                        }
                    } else {
                        eventsMap[groupKey] = {
                            ...outflow,
                            pattiNo: displayId, 
                            date: outflowDate,
                            customerId: record.customerId,
                            recordId: record.id,
                            commodityDescription: record.commodityDescription,
                            location: record.location || 'N/A',
                            outflowIndex: index,
                            bagsWithdrawn: Number(outflow.bagsWithdrawn) || 0,
                            rentBilled: Number(outflow.rentBilled) || 0,
                        };
                    }
                });
            }
        });

        // Convert grouped map back to array and sort by date descending
        return Object.values(eventsMap).sort((a,b) => b.date.getTime() - a.date.getTime());
    }, [records, selectedCustomerId, dateRange, financialYear]);
    
    const customer = customers.find(c => c.id === selectedCustomerId);
    const title = `Outflow Register ${customer ? `for ${customer.name}` : ''}`;

    return (
        <Card className="border-primary/20 shadow-md">
            <CardHeader className="flex-col md:flex-row items-start md:items-center justify-between gap-4 print-hide border-b bg-slate-50/50 p-4">
                <div className="flex-1">
                    <CardTitle className="text-lg font-black uppercase tracking-tight">Outflow Register</CardTitle>
                    <CardDescription className="text-xs font-medium">Audit-ready withdrawal log. Bulk Patti transactions are consolidated for clarity.</CardDescription>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto flex-wrap">
                    <Select onValueChange={setSelectedCustomerId} value={selectedCustomerId}>
                        <SelectTrigger className="w-full sm:w-[200px] h-9 text-sm font-bold">
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
            <CardContent className="pt-4">
                <OutflowReportTable 
                    events={consolidatedOutflowEvents} 
                    customers={customers}
                    allRecords={records}
                    commodities={commodities}
                    lots={lots}
                    warehouseInfo={warehouseInfo}
                    title={title}
                />
            </CardContent>
        </Card>
    );
}
