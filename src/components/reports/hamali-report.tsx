'use client';

import { useState, useMemo, useEffect } from 'react';
import type { Customer, StorageRecord, UnloadingRecord, Expense, WarehouseInfo } from "@/lib/definitions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
<<<<<<< HEAD
import { CustomerHamaliReportTable } from './customer-hamali-report-table';
import { WorkerHamaliReportTable } from './worker-hamali-report-table';
import { HamaliProfitReportTable } from './hamali-profit-report-table';
=======
>>>>>>> 891ceda461039c8e5b0e37800a830637d3182fb9
import { toDate } from '@/lib/utils';
import { useDateFilter } from '@/firebase/provider';
import { HamaliLedgerTable } from './hamali-ledger-table';

export type CustomerHamaliEvent = {
    date: Date;
    customerId: string;
    description: string;
    recordId: string;
    amount: number;
    type: 'charge' | 'payment';
    bags?: number;
    difference?: number;
}
export type WorkerHamaliEvent = {
    date: Date;
    description: string;
    recordId: string;
    customerId?: string;
    payable: number;
<<<<<<< HEAD
    customerCharge?: number;
=======
    charge?: number;
>>>>>>> 891ceda461039c8e5b0e37800a830637d3182fb9
    paid: number;
    bags?: number;
}

<<<<<<< HEAD
export function HamaliReport({ records, customers, unloadingRecords, expenses }: { records: StorageRecord[], customers: Customer[], unloadingRecords: UnloadingRecord[], expenses: Expense[] }) {
    const [reportView, setReportView] = useState<'customer' | 'worker' | 'profit'>('customer');
=======
export function HamaliReport({ records, customers, unloadingRecords, expenses, warehouseInfo }: { records: StorageRecord[], customers: Customer[], unloadingRecords: UnloadingRecord[], expenses: Expense[], warehouseInfo: WarehouseInfo | null }) {
    const [reportView, setReportView] = useState<'customer' | 'worker' | 'difference'>('customer');
>>>>>>> 891ceda461039c8e5b0e37800a830637d3182fb9
    const [selectedCustomerId, setSelectedCustomerId] = useState<string>('all');
    
    const { dateRange, financialYear } = useDateFilter();

    useEffect(() => {
<<<<<<< HEAD
        if (reportView === 'worker' || reportView === 'profit') {
=======
        if (reportView === 'worker' || reportView === 'difference') {
>>>>>>> 891ceda461039c8e5b0e37800a830637d3182fb9
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
                    description: sr.inflowType === 'Plot' ? 'Plot to Storage Hamali' : 'Direct Inflow Hamali',
                    recordId: sr.id,
                    amount: sr.hamaliPayable,
                    type: 'charge',
                    bags: sr.bagsIn,
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
                        description: 'Unloading Hamali (pending finalize)',
                        recordId: ur.billNo || ur.id.substring(0, 5),
                        amount: remainingHamali,
                        type: 'charge',
                        bags: bagsRemaining,
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
                    description: 'Payment',
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
                    description: 'Payment',
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
            if (dateRange.from) {
                filteredEvents = filteredEvents.filter(e => e.date >= dateRange.from!);
            }
            if (dateRange.to) {
                const toDateObj = new Date(dateRange.to);
                toDateObj.setHours(23, 59, 59, 999);
                filteredEvents = filteredEvents.filter(e => e.date <= toDateObj);
            }
        }

        const sortedEvents = filteredEvents.sort((a,b) => b.date.getTime() - a.date.getTime());

        let paymentCounter = 1;
        return sortedEvents.map(event => {
            if (event.type === 'payment') {
                return { ...event, recordId: String(paymentCounter++) };
            }
            return event;
        });
    }, [records, unloadingRecords, selectedCustomerId, dateRange, financialYear]);

    const workerAndProfitEvents = useMemo(() => {
        const events: WorkerHamaliEvent[] = [];

        records.forEach(sr => {
            if (sr.workerHamaliPayable && sr.workerHamaliPayable > 0) {
                events.push({
                    date: toDate(sr.storageStartDate),
                    description: sr.inflowType === 'Plot' ? 'Plot to Storage Hamali' : 'Direct Inflow Hamali',
                    recordId: sr.id,
                    customerId: sr.customerId,
                    payable: sr.workerHamaliPayable,
                    charge: sr.hamaliPayable,
                    paid: 0,
                    bags: sr.bagsIn,
                    customerCharge: sr.hamaliPayable,
                });
            }
        });

        unloadingRecords.forEach(ur => {
            const bagsRemaining = ur.bagsUnloaded - (ur.bagsSentToDrying || 0);
<<<<<<< HEAD
            if (bagsRemaining > 0 && ur.totalHamali > 0) {
                const proportion = bagsRemaining / ur.bagsUnloaded;
                const customerCharge = ur.totalHamali * proportion;
                const workerPayable = (ur.workerHamaliPayable ?? ur.totalHamali) * proportion;

                events.push({
                    date: toDate(ur.unloadingDate),
                    description: 'Unloading Hamali (pending finalize)',
                    recordId: ur.billNo || ur.id.substring(0, 5),
                    customerId: ur.customerId,
                    payable: workerPayable,
                    paid: 0,
                    bags: bagsRemaining,
                    customerCharge: customerCharge,
                });
=======
            if (bagsRemaining > 0 && ur.workerHamaliPayable) {
                const hamaliPerBag = ur.hamaliPerBag || 0; 
                const remainingAmount = bagsRemaining * hamaliPerBag;
                if (remainingAmount > 0) {
                    events.push({
                        date: toDate(ur.unloadingDate),
                        description: 'Unloading Hamali (Pending Finalize)',
                        recordId: ur.billNo || ur.id.substring(0, 5),
                        customerId: ur.customerId,
                        payable: remainingAmount,
                        charge: remainingAmount,
                        paid: 0,
                        bags: bagsRemaining,
                    });
                }
>>>>>>> 891ceda461039c8e5b0e37800a830637d3182fb9
            }
        });

        expenses.filter(e => e.category === 'Hamali Paid').forEach(exp => {
            events.push({
                date: toDate(exp.date),
                description: "Payment",
                recordId: exp.id,
                payable: 0,
                paid: exp.amount,
                customerCharge: 0,
            });
        });

        let filtered = events;
        if (selectedCustomerId && selectedCustomerId !== 'all') {
            filtered = filtered.filter(e => e.customerId === selectedCustomerId);
        }
        
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

        const sortedEvents = filtered.sort((a,b) => b.date.getTime() - a.date.getTime());

        let paymentCounter = 1;
        return sortedEvents.map(event => {
            if (event.paid > 0) {
                return { ...event, recordId: String(paymentCounter++) };
            }
            return event;
        });

    }, [records, unloadingRecords, expenses, selectedCustomerId, dateRange, financialYear]);


    const customer = customers.find(c => c.id === selectedCustomerId);
<<<<<<< HEAD
    const title = `Hamali ${
        reportView === 'customer' 
        ? 'Customer' 
        : reportView === 'worker'
        ? 'Worker'
        : 'Profit'
    } Ledger ${customer ? `for ${customer.name}` : ''}`;
=======
    const title = useMemo(() => {
        let viewTitle = '';
        switch(reportView) {
            case 'customer':
                viewTitle = 'Customer Ledger';
                break;
            case 'worker':
                viewTitle = 'Worker Ledger';
                break;
            case 'difference':
                viewTitle = 'Difference Ledger';
                break;
        }
        return `Hamali ${viewTitle} ${customer && reportView === 'customer' ? `for ${customer.name}` : ''}`;
    }, [reportView, customer]);
>>>>>>> 891ceda461039c8e5b0e37800a830637d3182fb9

    return (
        <Card>
            <CardHeader className="flex-col md:flex-row items-start md:items-center justify-between gap-4 print-hide">
                <div className="flex-1">
                    <CardTitle>Hamali Register</CardTitle>
                    <CardDescription>View ledgers for customer charges or worker payments.</CardDescription>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto flex-wrap">
<<<<<<< HEAD
                    <Select onValueChange={(v) => setReportView(v as 'customer' | 'worker' | 'profit')} value={reportView}>
=======
                    <Select onValueChange={(v) => setReportView(v as 'customer' | 'worker' | 'difference')} value={reportView}>
>>>>>>> 891ceda461039c8e5b0e37800a830637d3182fb9
                        <SelectTrigger className='w-full sm:w-auto'>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="customer">Customer Ledger</SelectItem>
                            <SelectItem value="worker">Worker Ledger</SelectItem>
<<<<<<< HEAD
                            <SelectItem value="profit">Profit Ledger</SelectItem>
=======
                            <SelectItem value="difference">Difference Ledger</SelectItem>
>>>>>>> 891ceda461039c8e5b0e37800a830637d3182fb9
                        </SelectContent>
                    </Select>
                    <Select onValueChange={setSelectedCustomerId} value={selectedCustomerId} disabled={reportView !== 'customer'}>
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
<<<<<<< HEAD
                    {reportView === 'customer' ? (
                        <CustomerHamaliReportTable 
                            events={customerHamaliEvents} 
                            customers={customers}
                            title={title}
                        />
                    ) : reportView === 'worker' ? (
                        <WorkerHamaliReportTable 
                            events={workerAndProfitEvents}
                            customers={customers}
                            title={title}
                        />
                    ) : (
                         <HamaliProfitReportTable 
                            events={workerAndProfitEvents}
                            customers={customers}
                            title={title}
                        />
                    )}
=======
                   <HamaliLedgerTable
                        customerEvents={customerHamaliEvents}
                        workerEvents={workerHamaliEvents}
                        customers={customers}
                        title={title}
                        view={reportView}
                        warehouseInfo={warehouseInfo}
                    />
>>>>>>> 891ceda461039c8e5b0e37800a830637d3182fb9
                </div>
            </CardContent>
        </Card>
    );
}
