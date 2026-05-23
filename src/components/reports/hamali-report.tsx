'use client';

import { useState, useMemo, useEffect } from 'react';
import type { Customer, StorageRecord, UnloadingRecord, Expense, WarehouseInfo } from "@/lib/definitions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toDate } from '@/lib/utils';
import { useDateFilter } from '@/firebase';
import { CustomerHamaliReportTable } from './customer-hamali-report-table';
import { WorkerHamaliReportTable } from './worker-hamali-report-table';

export type CustomerHamaliEvent = {
    date: Date;
    customerId: string;
    description: string;
    recordId: string;
    amount: number;
    type: 'charge' | 'payment';
    bags?: number;
    rate?: number;
}

export type WorkerHamaliEvent = {
    date: Date;
    description: string;
    recordId: string;
    customerId?: string;
    customerName?: string;
    payable: number;
    charge: number;
    paid: number;
    bags?: number;
}

export function HamaliReport({ records, customers, unloadingRecords, expenses, warehouseInfo }: { records: StorageRecord[], customers: Customer[], unloadingRecords: UnloadingRecord[], expenses: Expense[], warehouseInfo: WarehouseInfo | null }) {
    const [reportView, setReportView] = useState<'customer' | 'worker'>('customer');
    const [selectedCustomerId, setSelectedCustomerId] = useState<string>('all');
    
    const { dateRange, financialYear } = useDateFilter();

    useEffect(() => {
        if (reportView === 'worker') {
            setSelectedCustomerId('all');
        }
    }, [reportView]);

    const customerMap = useMemo(() => new Map(customers.map(c => [c.id, c.name])), [customers]);

    const customerHamaliEvents = useMemo(() => {
        const events: CustomerHamaliEvent[] = [];

        records.forEach(sr => {
            if (sr.hamaliPayable > 0) {
                 events.push({
                    date: toDate(sr.storageStartDate),
                    customerId: sr.customerId,
                    description: sr.inflowType === 'Plot' ? 'Drying Plot Handling' : 'Direct Inflow Handling',
                    recordId: sr.id,
                    amount: sr.hamaliPayable,
                    type: 'charge',
                    bags: sr.bagsIn,
                    rate: sr.hamaliRate || (sr.bagsIn > 0 ? sr.hamaliPayable / sr.bagsIn : 0)
                });
            }
        });
        
        unloadingRecords.forEach(ur => {
            const bagsRemaining = ur.bagsUnloaded - (ur.bagsSentToDrying || 0);
            if (bagsRemaining > 0) {
                const remainingHamali = bagsRemaining * ur.hamaliPerBag;
                 if (remainingHamali > 0) {
                    events.push({
                        date: toDate(ur.unloadingDate),
                        customerId: ur.customerId,
                        description: 'Unloading Handling',
                        recordId: ur.billNo || ur.id,
                        amount: remainingHamali,
                        type: 'charge',
                        bags: bagsRemaining,
                        rate: ur.hamaliPerBag
                    });
                }
            }
        });

        records.forEach(sr => {
            (sr.payments || []).filter(p => p.type === 'hamali' || p.type === 'unloading').forEach(payment => {
                events.push({
                    date: toDate(payment.date),
                    customerId: sr.customerId,
                    description: payment.type === 'unloading' ? 'Cash Receipt (Unloading)' : 'Cash Receipt (Hamali)',
                    recordId: sr.id,
                    amount: payment.amount,
                    type: 'payment',
                });
            });
        });

        unloadingRecords.forEach(ur => {
            (ur.payments || []).forEach(payment => {
                events.push({
                    date: toDate(payment.date),
                    customerId: ur.customerId,
                    description: 'Cash Receipt',
                    recordId: ur.billNo || ur.id,
                    amount: payment.amount,
                    type: 'payment',
                });
            });
        });
        
        let filteredEvents = events;
        if (selectedCustomerId && selectedCustomerId !== 'all') {
            filteredEvents = filteredEvents.filter(e => e.customerId === selectedCustomerId);
        }
        
        if (financialYear !== 'all-time' && dateRange) {
            if (dateRange.from) {
                filteredEvents = filteredEvents.filter(e => e.date >= dateRange.from!);
            }
            if (dateRange.to) {
                const toDateObj = new Date(dateRange.to);
                toDateObj.setHours(23, 59, 59, 999);
                filteredEvents = filteredEvents.filter(e => e.date <= toDateObj);
            }
        }

        return filteredEvents.sort((a,b) => a.date.getTime() - b.date.getTime());
    }, [records, unloadingRecords, selectedCustomerId, dateRange, financialYear]);

    const workerHamaliEvents = useMemo(() => {
        const events: WorkerHamaliEvent[] = [];

        records.forEach(sr => {
            const payable = sr.workerHamaliPayable ?? sr.hamaliPayable;
            if (payable > 0 || sr.hamaliPayable > 0) {
                events.push({
                    date: toDate(sr.storageStartDate),
                    description: `${customerMap.get(sr.customerId) || 'Unknown'} - ${sr.inflowType === 'Plot' ? 'Drying' : 'Direct'}`,
                    recordId: sr.id,
                    customerId: sr.customerId,
                    customerName: customerMap.get(sr.customerId),
                    payable: payable,
                    charge: sr.hamaliPayable,
                    paid: 0,
                    bags: sr.bagsIn,
                });
            }
        });

        unloadingRecords.forEach(ur => {
            const bagsRemaining = ur.bagsUnloaded - (ur.bagsSentToDrying || 0);
            if (bagsRemaining > 0 && ur.totalHamali > 0) {
                const proportion = ur.bagsUnloaded > 0 ? bagsRemaining / ur.bagsUnloaded : 0;
                const workerPayable = (ur.workerHamaliPayable ?? ur.totalHamali) * proportion;

                events.push({
                    date: toDate(ur.unloadingDate),
                    description: `${customerMap.get(ur.customerId) || 'Unknown'} - Unloading`,
                    recordId: ur.billNo || ur.id,
                    customerId: ur.customerId,
                    customerName: customerMap.get(ur.customerId),
                    charge: ur.totalHamali * proportion,
                    payable: workerPayable,
                    paid: 0,
                    bags: bagsRemaining,
                });
            }
        });

        expenses.filter(e => e.category === 'Hamali Paid').forEach(exp => {
            events.push({
                date: toDate(exp.date),
                description: exp.description || "Worker Payment Distribution",
                recordId: exp.refNo || exp.id.substring(0, 5),
                payable: 0,
                paid: exp.amount,
                charge: 0,
            });
        });

        let filtered = events;
        if (financialYear !== 'all-time' && dateRange) {
            if (dateRange.from) {
                filtered = filtered.filter(e => e.date >= dateRange.from!);
            }
            if (dateRange.to) {
                const toDateObj = new Date(dateRange.to);
                toDateObj.setHours(23, 59, 59, 999);
                filtered = filtered.filter(e => e.date <= toDateObj);
            }
        }

        return filtered.sort((a,b) => a.date.getTime() - b.date.getTime());
    }, [records, unloadingRecords, expenses, dateRange, financialYear, customerMap]);

    const title = reportView === 'customer' ? 'Customer Ledger' : 'Hamali Ledger';

    return (
        <Card className="border-primary/20 shadow-md">
            <CardHeader className="flex-col md:flex-row items-start md:items-center justify-between gap-4 print-hide">
                <div className="flex-1">
                    <CardTitle className="text-xl font-bold uppercase tracking-tight">{title}</CardTitle>
                    <CardDescription className="text-xs font-medium">Audit-ready ledgers for customer handling and worker payments.</CardDescription>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                    <Select onValueChange={(v) => setReportView(v as 'customer' | 'worker')} value={reportView}>
                        <SelectTrigger className='w-full sm:w-[200px] h-9 text-sm'>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="customer">Customer Ledger</SelectItem>
                            <SelectItem value="worker">Hamali Ledger</SelectItem>
                        </SelectContent>
                    </Select>
                    {reportView === 'customer' && (
                        <Select onValueChange={setSelectedCustomerId} value={selectedCustomerId}>
                            <SelectTrigger className="w-full sm:w-[200px] h-9 text-sm">
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
                    )}
                </div>
            </CardHeader>
            <CardContent>
                <div className="mt-2">
                   {reportView === 'customer' ? (
                       <CustomerHamaliReportTable events={customerHamaliEvents} customers={customers} title={title} warehouseInfo={warehouseInfo} />
                   ) : (
                       <WorkerHamaliReportTable events={workerHamaliEvents} title={title} warehouseInfo={warehouseInfo} />
                   )}
                </div>
            </CardContent>
        </Card>
    );
}
