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
                 const workerPayable = sr.workerHamaliPayable ?? sr.hamaliPayable;
                 events.push({
                    date: toDate(sr.storageStartDate),
                    customerId: sr.customerId,
                    description: sr.inflowType === 'Plot' ? 'Plot to Storage Hamali' : 'Direct Inflow Hamali',
                    recordId: sr.id,
                    amount: sr.hamaliPayable,
                    type: 'charge',
                    bags: sr.bagsIn,
                    difference: sr.hamaliPayable - workerPayable,
                });
            }
        });
        
        unloadingRecords.forEach(ur => {
            const bagsRemaining = ur.bagsUnloaded - (ur.bagsSentToDrying || 0);
            if (bagsRemaining > 0) {
                const remainingHamali = bagsRemaining * ur.hamaliPerBag;
                 if (remainingHamali > 0) {
                    const workerPayableForRemaining = (ur.workerHamaliPayable !== undefined && ur.bagsUnloaded > 0) 
                        ? (ur.workerHamaliPayable / ur.bagsUnloaded) * bagsRemaining 
                        : remainingHamali;
                    
                    events.push({
                        date: toDate(ur.unloadingDate),
                        customerId: ur.customerId,
                        description: 'Unloading Hamali (pending finalize)',
                        recordId: ur.billNo || ur.id.substring(0, 5).replace(/\D/g, ''),
                        amount: remainingHamali,
                        type: 'charge',
                        bags: bagsRemaining,
                        difference: remainingHamali - workerPayableForRemaining,
                    });
                }
            }
        });

        records.forEach(sr => {
            (sr.payments || []).filter(p => p.type === 'hamali' || p.type === 'unloading').forEach(payment => {
                events.push({
                    date: toDate(payment.date),
                    customerId: sr.customerId,
                    description: payment.type === 'unloading' ? 'Unloading Payment' : 'Hamali Payment',
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
                    recordId: ur.billNo || ur.id.substring(0, 5).replace(/\D/g, ''),
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

        return filteredEvents.sort((a,b) => b.date.getTime() - a.date.getTime());
    }, [records, unloadingRecords, selectedCustomerId, dateRange, financialYear]);

    const workerAndProfitEvents = useMemo(() => {
        const events: WorkerHamaliEvent[] = [];

        records.forEach(sr => {
            if (sr.hamaliPayable > 0 || (sr.workerHamaliPayable && sr.workerHamaliPayable > 0)) {
                events.push({
                    date: toDate(sr.storageStartDate),
                    description: sr.inflowType === 'Plot' ? 'Plot to Storage Hamali' : 'Direct Inflow Hamali',
                    recordId: sr.id,
                    customerId: sr.customerId,
                    payable: sr.workerHamaliPayable ?? sr.hamaliPayable,
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
                
                const customerChargeForRemaining = ur.totalHamali * proportion;
                const workerPayableForRemaining = (ur.workerHamaliPayable ?? ur.totalHamali) * proportion;

                events.push({
                    date: toDate(ur.unloadingDate),
                    description: 'Unloading Hamali (pending finalize)',
                    recordId: ur.billNo || ur.id.substring(0, 5).replace(/\D/g, ''),
                    customerId: ur.customerId,
                    charge: customerChargeForRemaining,
                    payable: workerPayableForRemaining,
                    paid: 0,
                    bags: bagsRemaining,
                });
            }
        });

        expenses.filter(e => e.category === 'Hamali Paid').forEach(exp => {
            events.push({
                date: toDate(exp.date),
                description: "Worker Payment",
                recordId: exp.refNo || exp.id.substring(0, 5).replace(/\D/g, ''),
                payable: 0,
                paid: exp.amount,
                charge: 0,
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

        return filtered.sort((a,b) => b.date.getTime() - a.date.getTime());
    }, [records, unloadingRecords, expenses, selectedCustomerId, dateRange, financialYear]);


    const customer = customers.find(c => c.id === selectedCustomerId);
    const title = useMemo(() => {
        let viewTitle = '';
        switch(reportView) {
            case 'customer':
                viewTitle = 'Customer Ledger';
                break;
            case 'worker':
                viewTitle = 'Hamali Ledger';
                break;
            case 'difference':
                viewTitle = 'Difference (Profit/Loss) Ledger';
                break;
        }
        return `Hamali ${viewTitle} ${customer && reportView === 'customer' ? `for ${customer.name}` : ''}`;
    }, [reportView, customer]);

    const renderReport = () => {
        switch(reportView) {
            case 'customer':
                return <CustomerHamaliReportTable events={customerHamaliEvents} customers={customers} allRecords={records} title={title} />;
            case 'worker':
                return <WorkerHamaliReportTable events={workerAndProfitEvents} title={title} />;
            case 'difference':
                return <HamaliProfitReportTable events={workerAndProfitEvents} customers={customers} title={title} />;
            default:
                return null;
        }
    }

    return (
        <Card>
            <CardHeader className="flex-col md:flex-row items-start md:items-center justify-between gap-4 print-hide">
                <div className="flex-1">
                    <CardTitle>Hamali Register</CardTitle>
                    <CardDescription>View ledgers for customer charges, worker payments, or your business profit/loss on labor.</CardDescription>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto flex-wrap">
                    <Select onValueChange={(v) => setReportView(v as 'customer' | 'worker' | 'difference')} value={reportView}>
                        <SelectTrigger className='w-full sm:w-[200px]'>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="customer">Customer Ledger</SelectItem>
                            <SelectItem value="worker">Hamali Ledger</SelectItem>
                            <SelectItem value="difference">Difference (Profit/Loss)</SelectItem>
                        </SelectContent>
                    </Select>
                    <Select onValueChange={setSelectedCustomerId} value={selectedCustomerId} disabled={reportView !== 'customer'}>
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
                <div className="mt-2">
                   {renderReport()}
                </div>
            </CardContent>
        </Card>
    );
}