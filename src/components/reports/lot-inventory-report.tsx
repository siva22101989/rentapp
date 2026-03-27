'use client';

import React, { useState, useRef, useMemo } from 'react';
import type { Customer, StorageRecord } from "@/lib/definitions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';
import { toDate } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from 'date-fns';
import { printElement } from '@/lib/print-util';

type LotInventoryReportProps = {
    records: StorageRecord[];
    customers: Customer[];
}

type GroupedLots = {
    [key: string]: {
        records: StorageRecord[];
        totalBags: number;
    }
}

function LotInventoryTable({ groupedLots, customers, title }: { groupedLots: GroupedLots, customers: Customer[], title: string }) {
    const generatedDate = useMemo(() => format(new Date(), 'dd MMM yyyy, hh:mm a'), []);
    
    const getCustomerName = (customerId: string) => {
        return customers.find(c => c.id === customerId)?.name ?? 'Unknown';
    }

    const lotNames = Object.keys(groupedLots).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    
    if (lotNames.length === 0) {
        return (
             <div className="bg-white p-4 rounded-lg">
                <div className="mb-4">
                    <h2 className="text-xl font-bold">Srilakshmi Warehouse</h2>
                    <p className="text-muted-foreground">{title}</p>
                    <p className="text-xs text-muted-foreground">Generated on: {generatedDate}</p>
                </div>
                <div className="text-center py-8 text-muted-foreground">
                    No active stock found in any lots.
                </div>
            </div>
        )
    }

    return (
        <div className="bg-white p-4 rounded-lg">
            <div className="mb-4">
                <h2 className="text-xl font-bold">Srilakshmi Warehouse</h2>
                <p className="text-muted-foreground">{title}</p>
                <p className="text-xs text-muted-foreground">Generated on: {generatedDate}</p>
            </div>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-[150px]">Lot No.</TableHead>
                        <TableHead>Patti No.</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Commodity</TableHead>
                        <TableHead>Inflow Date</TableHead>
                        <TableHead className="text-right">Bags</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {lotNames.map(lotName => (
                        <React.Fragment key={lotName}>
                            <TableRow className="bg-secondary hover:bg-secondary">
                                <TableCell colSpan={5} className="font-bold">{lotName || 'Unassigned'}</TableCell>
                                <TableCell className="text-right font-bold font-mono">{groupedLots[lotName].totalBags}</TableCell>
                            </TableRow>
                            {groupedLots[lotName].records.map(record => (
                                <TableRow key={record.id}>
                                    <TableCell></TableCell>
                                    <TableCell>{record.id}</TableCell>
                                    <TableCell>{getCustomerName(record.customerId)}</TableCell>
                                    <TableCell>{record.commodityDescription}</TableCell>
                                    <TableCell>{format(toDate(record.storageStartDate), 'dd MMM yyyy')}</TableCell>
                                    <TableCell className="text-right font-mono">{record.bagsStored}</TableCell>
                                </TableRow>
                            ))}
                        </React.Fragment>
                    ))}
                </TableBody>
            </Table>
        </div>
    )
}


export function LotInventoryReport({ records, customers }: LotInventoryReportProps) {
    const reportRef = useRef<HTMLDivElement>(null);

    const groupedLots = useMemo(() => {
        const activeRecords = records.filter(r => r.storageEndDate === null && r.bagsStored > 0);
        
        const lots: GroupedLots = activeRecords.reduce((acc, record) => {
            const lotKey = record.location || 'Unassigned';
            if (!acc[lotKey]) {
                acc[lotKey] = { records: [], totalBags: 0 };
            }
            acc[lotKey].records.push(record);
            acc[lotKey].totalBags += record.bagsStored;
            return acc;
        }, {} as GroupedLots);

        // Sort records within each lot by customer name
        for (const lotKey in lots) {
            const customerMap = new Map(customers.map(c => [c.id, c.name]));
            lots[lotKey].records.sort((a, b) => {
                const nameA = customerMap.get(a.customerId) || '';
                const nameB = customerMap.get(b.customerId) || '';
                return nameA.localeCompare(nameB);
            });
        }

        return lots;
    }, [records, customers]);

    const handleGenerate = () => {
        const element = reportRef.current;
        if (!element) return;
        printElement(element, "Lot Inventory Report");
    };

    const title = `Lot-wise Inventory Report`;

    return (
        <Card>
            <CardHeader className="flex-col md:flex-row items-start md:items-center justify-between gap-4 print-hide">
                <div className="flex-1">
                    <CardTitle>Lot Inventory Report</CardTitle>
                    <CardDescription>A summary of active stock present in each lot.</CardDescription>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                    <Button onClick={handleGenerate}>
                        <Printer className="mr-2 h-4 w-4" /> Print / Save PDF
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                <div ref={reportRef}>
                    <LotInventoryTable 
                        groupedLots={groupedLots} 
                        customers={customers}
                        title={title}
                    />
                </div>
            </CardContent>
        </Card>
    );
}
