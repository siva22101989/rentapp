'use client';

import { useState, useRef, useMemo } from 'react';
import type { Customer, StorageRecord, UnloadingRecord, Payment } from "@/lib/definitions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';
import { PaymentReportTable, type PaymentEvent } from './payment-report-table';
import { toDate } from '@/lib/utils';
import { useDateFilter } from '@/firebase/provider';
import { printElement } from '@/lib/print-util';

type PaymentReportProps = {
    records: StorageRecord[];
    unloadingRecords: UnloadingRecord[];
    customers: Customer[];
}

export function PaymentReport({ records, unloadingRecords, customers }: PaymentReportProps) {
    const [selectedCustomerId, setSelectedCustomerId] = useState<string>('all');
    
    const reportRef = useRef<HTMLDivElement>(null);
    const { dateRange } = useDateFilter();

    const paymentEvents = useMemo(() => {
        const events: PaymentEvent[] = [];

        // Payments from Storage Records
        records.forEach(sr => {
            (sr.payments || []).forEach(payment => {
                events.push({
                    date: toDate(payment.date),
                    customerId: sr.customerId,
                    description: `Payment for Storage Record`,
                    recordId: sr.id,
                    amount: payment.amount,
                    type: payment.type || 'other',
                });
            });
        });

        // Payments from Unloading Records
        unloadingRecords.forEach(ur => {
            (ur.payments || []).forEach(payment => {
                events.push({
                    date: toDate(payment.date),
                    customerId: ur.customerId,
                    description: 'Payment for Unloading',
                    recordId: ur.billNo || 'N/A',
                    amount: payment.amount,
                    type: 'unloading',
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


    const handleGenerate = () => {
        const element = reportRef.current;
        if (!element) return;
        const customer = customers.find(c => c.id === selectedCustomerId);
        const title = `Payment Register ${customer ? `for ${customer.name}` : ''}`;
        printElement(element, title);
    };

    const customer = customers.find(c => c.id === selectedCustomerId);
    const title = `Payment Register ${customer ? `for ${customer.name}` : ''}`;

    return (
        <Card>
            <CardHeader className="flex-col md:flex-row items-start md:items-center justify-between gap-4 print-hide">
                <div className="flex-1">
                    <CardTitle>Payment Register</CardTitle>
                    <CardDescription>A log of all payments received.</CardDescription>
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
                    <Button onClick={handleGenerate}>
                        <Printer className="mr-2 h-4 w-4" /> Print / Save PDF
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                <div ref={reportRef}>
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
