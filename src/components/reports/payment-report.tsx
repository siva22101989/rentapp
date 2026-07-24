'use client';

import { useState, useMemo } from 'react';
import type { Customer, StorageRecord, UnloadingRecord, PaymentType, CustomerPayment } from "@/lib/definitions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PaymentReportTable, type PaymentEvent } from './payment-report-table';
import { toDate } from '@/lib/utils';
import { useDateFilter } from '@/firebase/provider';

type PaymentReportProps = {
    records: StorageRecord[];
    unloadingRecords: UnloadingRecord[];
    customers: Customer[];
    customerPayments?: CustomerPayment[];
}

export function PaymentReport({ records, unloadingRecords, customers, customerPayments = [] }: PaymentReportProps) {
    const [selectedCustomerId, setSelectedCustomerId] = useState<string>('all');
    
    const { dateRange, financialYear } = useDateFilter();

    const paymentEvents = useMemo(() => {
        const events: PaymentEvent[] = [];

        // 1. Storage Bill Payments
        records.forEach(sr => {
            (sr.payments || []).forEach((payment, pIndex) => {
                events.push({
                    date: toDate(payment.date),
                    customerId: sr.customerId,
                    description: `Payment for Storage Record`,
                    recordId: sr.id,
                    amount: payment.amount,
                    type: (payment.type || 'other') as PaymentType,
                    recordType: 'storage',
                    paymentIndex: pIndex
                });
            });
        });

        // 2. Unloading Bill Payments
        unloadingRecords.forEach(ur => {
            (ur.payments || []).forEach((payment, pIndex) => {
                events.push({
                    date: toDate(payment.date),
                    customerId: ur.customerId,
                    description: 'Payment for Unloading',
                    recordId: ur.billNo || ur.id,
                    amount: payment.amount,
                    type: 'unloading',
                    recordType: 'unloading',
                    paymentIndex: pIndex
                });
            });
        });
        
        // 3. Bulk Account Payments
        (customerPayments || []).forEach((cp) => {
            events.push({
                date: toDate(cp.date),
                customerId: cp.customerId,
                description: cp.isDiscount ? 'Bulk Account Waiver' : 'Bulk Account Payment',
                recordId: cp.refNo || 'BULK',
                amount: cp.amount,
                type: cp.isDiscount ? 'discount' : (cp.type as any),
                recordType: 'bulk',
                paymentIndex: 0
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
    }, [records, unloadingRecords, customerPayments, selectedCustomerId, dateRange, financialYear]);


    const customer = customers.find(c => c.id === selectedCustomerId);
    const title = `Payment Register ${customer ? `for ${customer.name}` : ''}`;

    return (
        <Card className="border-primary/20 shadow-md">
            <CardHeader className="flex-col md:flex-row items-start md:items-center justify-between gap-4 print-hide border-b bg-slate-50/50 p-4">
                <div className="flex-1">
                    <CardTitle className="text-lg font-black uppercase tracking-tight">Payment Register</CardTitle>
                    <CardDescription className="text-[12px] font-medium">Detailed log of all cash receipts and account adjustments.</CardDescription>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto flex-wrap">
                    <Select onValueChange={setSelectedCustomerId} value={selectedCustomerId}>
                        <SelectTrigger className="w-full sm:w-[240px] h-9 text-sm font-bold">
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
                <div>
                    <PaymentReportTable 
                        events={paymentEvents} 
                        customers={customers}
                        title={title}
                    />
                </div>
            </CardContent>
        </Card>
    );
}