
'use client';

import { useState, useMemo } from 'react';
import type { Customer, StorageRecord, UnloadingRecord, Expense } from "@/lib/definitions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CustomerHamaliReportTable } from './customer-hamali-report-table';
import { WorkerHamaliReportTable } from './worker-hamali-report-table';
import { toDate } from '@/lib/utils';
import { useDateFilter } from '@/firebase/provider';
import { useAppUser } from '@/firebase/auth/use-user';
import { useCollection } from '@/firebase/firestore/use-collection';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { collection } from 'firebase/firestore';
import { useFirestore } from '@/firebase/provider';

export type CustomerHamaliEvent = {
    date: Date;
    customerId: string;
    description: string;
    recordId: string;
    amount: number;
    type: 'charge' | 'payment';
    bags?: number;
}
export type WorkerHamaliEvent = {
    date: Date;
    description: string;
    recordId: string;
    customerId?: string;
    payable: number;
    paid: number;
    bags?: number;
}

export function HamaliReport({ records, customers, unloadingRecords, expenses }: { records: StorageRecord[], customers: Customer[], unloadingRecords: UnloadingRecord[], expenses: Expense[] }) {
    const [reportView, setReportView] = useState<'customer' | 'worker'>('customer');
    const [selectedCustomerId, setSelectedCustomerId] = useState<string>('all');
    
    const { dateRange } = useDateFilter();

    const customerHamaliEvents = useMemo(() => {
        const events: CustomerHamaliEvent[] = [];

        records.forEach(sr => {
            if (sr.hamaliPayable > 0) {
                 events.push({
                    date: toDate(sr.storageStartDate),
                    customerId: sr.customerId,
                    description: sr.inflowType === 'Plot' ? 'Plot to Storage Hamali' : 'Direct Inflow Hamali',
                    recordId: sr.id,
                    amount: sr.hamaliPayable,
                    type: 'charge',
                    bags: sr.bagsIn,
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
                        description: 'Unloading Hamali (pending finalize)',
                        recordId: ur.billNo || ur.id.substring(0, 5),
                        amount: remainingHamali,
                        type: 'charge',
                        bags: bagsRemaining
                    });
                }
            }
        });

        records.forEach(sr => {
            (sr.payments || []).filter(p => p.type === 'hamali').forEach(payment => {
                events.push({
                    date: toDate(payment.date),
                    customerId: sr.customerId,
                    description: 'Payment (Storage)',
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
                    description: 'Payment (Unloading)',
                    recordId: ur.billNo || ur.id.substring(0,5),
                    amount: payment.amount,
                    type: 'payment',
                });
            });
        });
        
        let filteredEvents = events;
        if (selectedCustomerId && selectedCustomerId !== 'all') {
            filteredEvents = filteredEvents.filter(e => e.customerId === selectedCustomerId);
        }
        if (dateRange?.from) {
            filteredEvents = filteredEvents.filter(e => e.date >= dateRange.from!);
        }
        if (dateRange?.to) {
            const toDateObj = new Date(dateRange.to);
            toDateObj.setHours(23, 59, 59, 999);
            filteredEvents = filteredEvents.filter(e => e.date <= toDateObj);
        }

        return filteredEvents.sort((a,b) => a.date.getTime() - b.date.getTime());
    }, [records, unloadingRecords, selectedCustomerId, dateRange]);

    const workerHamaliEvents = useMemo(() => {
        const events: WorkerHamaliEvent[] = [];

        records.forEach(sr => {
            if (sr.workerHamaliPayable && sr.workerHamaliPayable > 0) {
                events.push({
                    date: toDate(sr.storageStartDate),
                    description: sr.inflowType === 'Plot' ? 'Plot to Storage Hamali' : 'Direct Inflow Hamali',
                    recordId: sr.id,
                    customerId: sr.customerId,
                    payable: sr.workerHamaliPayable,
                    paid: 0,
                    bags: sr.bagsIn,
                });
            }
        });

        unloadingRecords.forEach(ur => {
            const bagsRemaining = ur.bagsUnloaded - (ur.bagsSentToDrying || 0);
            if (bagsRemaining > 0 && ur.workerHamaliPayable) {
                const hamaliPerBag = ur.hamaliPerBag || 0; 
                const remainingPayable = bagsRemaining * hamaliPerBag;
                if (remainingPayable > 0) {
                    events.push({
                        date: toDate(ur.unloadingDate),
                        description: 'Unloading Hamali (Pending Finalize)',
                        recordId: ur.billNo || ur.id.substring(0, 5),
                        customerId: ur.customerId,
                        payable: remainingPayable,
                        paid: 0,
                        bags: bagsRemaining,
                    });
                }
            }
        });

        expenses.filter(e => e.category === 'Hamali').forEach(exp => {
            events.push({
                date: toDate(exp.date),
                description: exp.description,
                recordId: exp.id.substring(0,5),
                payable: 0,
                paid: exp.amount,
            });
        });

        let filtered = events;
        if (selectedCustomerId && selectedCustomerId !== 'all') {
            filtered = filtered.filter(e => e.customerId === selectedCustomerId);
        }
        if (dateRange?.from) {
            filtered = filtered.filter(e => e.date >= dateRange.from!);
        }
        if (dateRange?.to) {
            const toDateObj = new Date(dateRange.to);
            toDateObj.setHours(23, 59, 59, 999);
            filtered = filtered.filter(e => e.date <= toDateObj);
        }

        return filtered.sort((a,b) => a.date.getTime() - b.date.getTime());
    }, [records, unloadingRecords, expenses, selectedCustomerId, dateRange]);


    const customer = customers.find(c => c.id === selectedCustomerId);
    const title = `Hamali ${reportView === 'customer' ? 'Customer' : 'Worker'} Ledger ${customer ? `for ${customer.name}` : ''}`;

    return (
        <Card>
            <CardHeader className="flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex-1">
                    <CardTitle>Hamali Register</CardTitle>
                    <CardDescription>View ledgers for customer charges or worker payments.</CardDescription>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto flex-wrap">
                    <Select onValueChange={(v) => setReportView(v as 'customer' | 'worker')} value={reportView}>
                        <SelectTrigger className='w-full sm:w-auto'>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="customer">Customer Ledger</SelectItem>
                            <SelectItem value="worker">Worker Ledger</SelectItem>
                        </SelectContent>
                    </Select>
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
                    {reportView === 'customer' ? (
                        <CustomerHamaliReportTable 
                            events={customerHamaliEvents} 
                            customers={customers}
                            title={title}
                        />
                    ) : (
                        <WorkerHamaliReportTable 
                            events={workerHamaliEvents}
                            customers={customers}
                            title={title}
                        />
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
