
'use client';

import { useState, useMemo, useEffect } from 'react';
import type { Customer, StorageRecord, UnloadingRecord, Expense, WarehouseInfo } from "@/lib/definitions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toDate } from '@/lib/utils';
import { useDateFilter } from '@/firebase';
import { CustomerHamaliReportTable } from './customer-hamali-report-table';
import { WorkerHamaliReportTable } from './worker-hamali-report-table';
import { HamaliProfitReportTable } from './hamali-profit-report-table';

export type CustomerHamaliEvent = {
    date: Date;
    customerId: string;
    description: string;
    recordId: string;
    amount: number;
    type: 'charge' | 'payment';
    bags?: number;
    rate?: number;
    difference?: number;
}
export type WorkerHamaliEvent = {
    date: Date;
    description: string;
    recordId: string;
    customerId?: string;
    payable: number;
    charge: number;
    paid: number;
    bags?: number;
    workerRate?: number;
    customerRate?: number;
}

export function HamaliReport({ records, customers, unloadingRecords, expenses, warehouseInfo }: { records: StorageRecord[], customers: Customer[], unloadingRecords: UnloadingRecord[], expenses: Expense[], warehouseInfo: WarehouseInfo | null }) {
    const [reportView, setReportView] = useState<'customer' | 'worker' | 'difference'>('customer');
    const [selectedCustomerId, setSelectedCustomerId] = useState<string>('all');
    const { dateRange, financialYear } = useDateFilter();

    useEffect(() => {
        if (reportView === 'worker' || reportView === 'difference') {
            setSelectedCustomerId('all');
        }
    }, [reportView]);

    const customerHamaliEvents = useMemo(() => {
        const events: CustomerHamaliEvent[] = [];

        records.forEach(sr => {
            if (sr.hamaliPayable > 0) {
                 events.push({
                    date: toDate(sr.storageStartDate),
                    customerId: sr.customerId,
                    description: sr.inflowType === 'Plot' ? 'Plot to Storage' : 'Direct Inflow',
                    recordId: sr.id,
                    amount: sr.hamaliPayable,
                    type: 'charge',
                    bags: sr.bagsIn,
                    rate: sr.hamaliRate || (sr.bagsIn > 0 ? sr.hamaliPayable / sr.bagsIn : 0),
                    difference: sr.hamaliPayable - (sr.workerHamaliPayable ?? sr.hamaliPayable),
                });
            }
        });
        
        unloadingRecords.forEach(ur => {
            const bagsRemaining = ur.bagsUnloaded - (ur.bagsSentToDrying || 0);
            if (bagsRemaining > 0) {
                const remainingHamali = bagsRemaining * ur.hamaliPerBag;
                 if (remainingHamali > 0) {
                    const workerPayableForRemaining = (ur.workerHamaliPayable && ur.bagsUnloaded > 0) 
                        ? (ur.workerHamaliPayable / ur.bagsUnloaded) * bagsRemaining 
                        : remainingHamali;
                    
                    events.push({
                        date: toDate(ur.unloadingDate),
                        customerId: ur.customerId,
                        description: 'Unloading (Pending Finalize)',
                        recordId: ur.billNo || ur.id.substring(0, 5),
                        amount: remainingHamali,
                        type: 'charge',
                        bags: bagsRemaining,
                        rate: ur.hamaliPerBag,
                        difference: remainingHamali - workerPayableForRemaining,
                    });
                }
            }
        });

        records.forEach(sr => {
            (sr.payments || []).filter(p => p.type === 'hamali').forEach(payment => {
                events.push({
                    date: toDate(payment.date),
                    customerId: sr.customerId,
                    description: 'Payment Received',
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
                    description: 'Payment Received',
                    recordId: ur.billNo || 'N/A',
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
            if (dateRange.from) filteredEvents = filteredEvents.filter(e => e.date >= dateRange.from!);
            if (dateRange.to) {
                const toDateObj = new Date(dateRange.to);
                toDateObj.setHours(23, 59, 59, 999);
                filteredEvents = filteredEvents.filter(e => e.date <= toDateObj);
            }
        }

        return filteredEvents.sort((a,b) => b.date.getTime() - a.date.getTime());
    }, [records, unloadingRecords, selectedCustomerId, dateRange, financialYear]);

    const workerAndProfitEvents = useMemo(() => {
        const events: WorkerHamaliEvent[] = [];

        records.forEach(sr => {
            if (sr.hamaliPayable > 0 || (sr.workerHamaliPayable || 0) > 0) {
                const bags = sr.bagsIn || 0;
                const custTotal = sr.hamaliPayable;
                const workTotal = sr.workerHamaliPayable ?? sr.hamaliPayable;
                events.push({
                    date: toDate(sr.storageStartDate),
                    description: sr.inflowType === 'Plot' ? 'Plot to Storage' : 'Direct Inflow',
                    recordId: sr.id,
                    customerId: sr.customerId,
                    charge: custTotal,
                    payable: workTotal,
                    paid: 0,
                    bags: bags,
                    customerRate: bags > 0 ? custTotal / bags : 0,
                    workerRate: bags > 0 ? workTotal / bags : 0,
                });
            }
        });

        unloadingRecords.forEach(ur => {
            const bagsRemaining = ur.bagsUnloaded - (ur.bagsSentToDrying || 0);
            if (bagsRemaining > 0 && (ur.totalHamali > 0 || (ur.workerHamaliPayable || 0) > 0)) {
                const proportion = ur.bagsUnloaded > 0 ? bagsRemaining / ur.bagsUnloaded : 0;
                const custTotal = ur.totalHamali * proportion;
                const workTotal = (ur.workerHamaliPayable ?? ur.totalHamali) * proportion;

                events.push({
                    date: toDate(ur.unloadingDate),
                    description: 'Unloading (Pending Finalize)',
                    recordId: ur.billNo || ur.id.substring(0, 5),
                    customerId: ur.customerId,
                    charge: custTotal,
                    payable: workTotal,
                    paid: 0,
                    bags: bagsRemaining,
                    customerRate: ur.hamaliPerBag,
                    workerRate: ur.bagsUnloaded > 0 ? (ur.workerHamaliPayable ?? ur.totalHamali) / ur.bagsUnloaded : 0,
                });
            }
        });

        expenses.filter(e => e.category === 'Hamali Paid').forEach(exp => {
            events.push({
                date: toDate(exp.date),
                description: "Worker Payment",
                recordId: exp.id,
                payable: 0,
                paid: exp.amount,
                charge: 0,
            });
        });

        let filtered = events;
        if (financialYear !== 'all-time' && dateRange) {
            if (dateRange.from) filtered = filtered.filter(e => e.date >= dateRange.from!);
            if (dateRange.to) {
                const toDateObj = new Date(dateRange.to);
                toDateObj.setHours(23, 59, 59, 999);
                filtered = filtered.filter(e => e.date <= toDateObj);
            }
        }

        return filtered.sort((a,b) => b.date.getTime() - a.date.getTime());
    }, [records, unloadingRecords, expenses, dateRange, financialYear]);


    const customer = customers.find(c => c.id === selectedCustomerId);
    const title = useMemo(() => {
        let viewTitle = '';
        switch(reportView) {
            case 'customer': viewTitle = 'Customer Ledger'; break;
            case 'worker': viewTitle = 'Worker Ledger'; break;
            case 'difference': viewTitle = 'Profit/Loss Ledger'; break;
        }
        return `Hamali ${viewTitle} ${customer && reportView === 'customer' ? `for ${customer.name}` : ''}`;
    }, [reportView, customer]);

    return (
        <Card>
            <CardHeader className="flex-col md:flex-row items-start md:items-center justify-between gap-4 print-hide">
                <div className="flex-1">
                    <CardTitle>Hamali Register</CardTitle>
                    <CardDescription>Detailed tracking of charges to customers vs payments to workers.</CardDescription>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto flex-wrap">
                    <Select onValueChange={(v) => setReportView(v as any)} value={reportView}>
                        <SelectTrigger className='w-full sm:w-auto'><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="customer">Customer Ledger</SelectItem>
                            <SelectItem value="worker">Worker Ledger</SelectItem>
                            <SelectItem value="difference">Profit/Loss Ledger</SelectItem>
                        </SelectContent>
                    </Select>
                    <Select onValueChange={setSelectedCustomerId} value={selectedCustomerId} disabled={reportView !== 'customer'}>
                        <SelectTrigger className="w-full sm:w-auto"><SelectValue placeholder="All Customers" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Customers</SelectItem>
                            {customers.map(c => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
                        </SelectContent>
                    </Select>
                </div>
            </CardHeader>
            <CardContent>
                {reportView === 'customer' && <CustomerHamaliReportTable events={customerHamaliEvents} customers={customers} title={title} warehouseInfo={warehouseInfo} />}
                {reportView === 'worker' && <WorkerHamaliReportTable events={workerAndProfitEvents} customers={customers} title={title} />}
                {reportView === 'difference' && <HamaliProfitReportTable events={workerAndProfitEvents} customers={customers} title={title} />}
            </CardContent>
        </Card>
    );
}
