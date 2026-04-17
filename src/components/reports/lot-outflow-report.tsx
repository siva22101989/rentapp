'use client';

import React, { useMemo } from 'react';
import type { Customer, StorageRecord, Outflow } from "@/lib/definitions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useDateFilter } from '@/firebase/provider';
import { toDate } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";

type OutflowEvent = Outflow & {
    customerId: string;
    recordId: string;
    commodityDescription: string;
    location?: string;
    date: Date;
};

type GroupedLots = {
    [key: string]: {
        events: OutflowEvent[];
        totalBags: number;
    }
}

function LotOutflowReportTable({ groupedLots, customers, title }: { groupedLots: GroupedLots, customers: Customer[], title: string }) {
    const generatedDate = useMemo(() => format(new Date(), 'dd MMM yyyy, hh:mm a'), []);
    
    const getCustomerName = (customerId: string) => {
        return customers.find(c => c.id === customerId)?.name ?? 'Unknown';
    }

    const lotNames = Object.keys(groupedLots).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    
    if (lotNames.length === 0) {
        return (
             <div className="bg-white p-4 rounded-lg">
                <div className="mb-4 text-center">
                    <h2 className="text-xl font-bold">GrainDost</h2>
                    <p className="text-lg font-semibold">{title}</p>
                    <p className="text-xs text-muted-foreground">Generated on: {generatedDate}</p>
                </div>
                <div className="text-center py-8 text-muted-foreground">
                    No outflows found for the selected criteria.
                </div>
            </div>
        )
    }

    return (
        <div className="bg-white p-4 rounded-lg">
            <div className="mb-4 text-center">
                <h2 className="text-xl font-bold">GrainDost</h2>
                <p className="text-lg font-semibold">{title}</p>
                <p className="text-xs text-muted-foreground">Generated on: {generatedDate}</p>
            </div>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-[150px]">Lot No.</TableHead>
                        <TableHead>Outflow Date</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Commodity</TableHead>
                        <TableHead>Patti No.</TableHead>
                        <TableHead className="text-right">Bags Withdrawn</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {lotNames.map(lotName => (
                        <React.Fragment key={lotName}>
                            <TableRow className="bg-secondary hover:bg-secondary">
                                <TableCell colSpan={5} className="font-bold">{lotName || 'Unassigned'}</TableCell>
                                <TableCell className="text-right font-bold font-mono">{groupedLots[lotName].totalBags}</TableCell>
                            </TableRow>
                            {groupedLots[lotName].events.map((event, index) => (
                                <TableRow key={`${event.recordId}-${index}`}>
                                    <TableCell></TableCell>
                                    <TableCell>{format(event.date, 'dd MMM yyyy')}</TableCell>
                                    <TableCell>{getCustomerName(event.customerId)}</TableCell>
                                    <TableCell>{event.commodityDescription}</TableCell>
                                    <TableCell>{event.recordId}</TableCell>
                                    <TableCell className="text-right font-mono">{event.bagsWithdrawn}</TableCell>
                                </TableRow>
                            ))}
                        </React.Fragment>
                    ))}
                </TableBody>
            </Table>
        </div>
    )
}

type LotOutflowReportProps = {
    records: StorageRecord[];
    customers: Customer[];
}

export function LotOutflowReport({ records, customers }: LotOutflowReportProps) {
    const { dateRange } = useDateFilter();

    const groupedLots = useMemo(() => {
        const outflowEvents: OutflowEvent[] = [];
        records.forEach(record => {
            if (record.outflows && Array.isArray(record.outflows)) {
                record.outflows.forEach(outflow => {
                    const outflowDate = toDate(outflow.date);
                    // Date filtering
                    if (dateRange?.from && outflowDate < dateRange.from) return;
                    if (dateRange?.to) {
                        const to = new Date(dateRange.to);
                        to.setHours(23, 59, 59, 999);
                        if (outflowDate > to) return;
                    }

                    outflowEvents.push({
                        ...outflow,
                        date: outflowDate,
                        customerId: record.customerId,
                        recordId: record.id,
                        commodityDescription: record.commodityDescription,
                        location: record.location,
                    });
                });
            }
        });

        const lots: GroupedLots = {};

        outflowEvents.forEach(event => {
            const lotKey = event.location || 'Unassigned';
            if (!lots[lotKey]) {
                lots[lotKey] = { events: [], totalBags: 0 };
            }
            lots[lotKey].events.push(event);
            lots[lotKey].totalBags += event.bagsWithdrawn;
        });

        // Sort events within each lot by date
        for (const lotKey in lots) {
            lots[lotKey].events.sort((a, b) => b.date.getTime() - a.date.getTime());
        }

        return lots;
    }, [records, dateRange]);

    const title = `Lot-wise Outflow Report`;
    const description = "A summary of all items withdrawn from each lot.";

    return (
        <Card>
            <CardHeader className="flex-col md:flex-row items-start md:items-center justify-between gap-4 print-hide">
                <div className="flex-1">
                    <CardTitle>{title}</CardTitle>
                    <CardDescription>{description}</CardDescription>
                </div>
            </CardHeader>
            <CardContent>
                <div>
                    <LotOutflowReportTable
                        groupedLots={groupedLots}
                        customers={customers}
                        title={title}
                    />
                </div>
            </CardContent>
        </Card>
    );
}
