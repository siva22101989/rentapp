
'use client';

import React, { useMemo } from 'react';
import type { Customer, StorageRecord } from "@/lib/definitions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toDate } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { format } from 'date-fns';

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
    const grandTotalBags = useMemo(() => lotNames.reduce((sum, name) => sum + groupedLots[name].totalBags, 0), [lotNames, groupedLots]);
    
    if (lotNames.length === 0) {
        return (
             <div className="bg-white p-4 rounded-lg">
                <div className="mb-4 text-center">
                    <h2 className="text-xl font-bold uppercase">SRI LAKSHMI WAREHOUSE</h2>
                    <p className="text-muted-foreground font-semibold">{title}</p>
                    <p className="text-xs text-muted-foreground">Generated on: {generatedDate}</p>
                </div>
                <div className="text-center py-10 text-muted-foreground border-2 border-dashed rounded-lg text-[13px]">
                    No active stock found in any lots.
                </div>
            </div>
        )
    }

    return (
        <div className="bg-white p-4 rounded-lg">
            <div className="mb-6 text-center">
                <h2 className="text-2xl font-bold uppercase">SRI LAKSHMI WAREHOUSE</h2>
                <p className="text-muted-foreground font-semibold uppercase tracking-wider">{title}</p>
                <p className="text-xs text-muted-foreground">Generated on: {generatedDate}</p>
            </div>
            <Table className="text-[13px]">
                <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                        <TableHead className="w-[120px] uppercase text-[10px] font-bold">Lot No.</TableHead>
                        <TableHead className="uppercase text-[10px] font-bold">Storage ID</TableHead>
                        <TableHead className="uppercase text-[10px] font-bold">Customer Name</TableHead>
                        <TableHead className="hidden md:table-cell uppercase text-[10px] font-bold">Commodity</TableHead>
                        <TableHead className="hidden lg:table-cell uppercase text-[10px] font-bold">Inflow Date</TableHead>
                        <TableHead className="text-right uppercase text-[10px] font-bold">Bags in Stock</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {lotNames.map(lotName => (
                        <React.Fragment key={lotName}>
                            <TableRow className="bg-primary/5 hover:bg-primary/10 border-t border-primary/10 h-8">
                                <TableCell className="font-bold text-primary">{lotName || 'Unassigned'}</TableCell>
                                <TableCell colSpan={4} className="font-semibold text-muted-foreground italic text-[11px]">Subtotal for Lot {lotName}</TableCell>
                                <TableCell className="text-right font-bold font-mono text-primary">{groupedLots[lotName].totalBags}</TableCell>
                            </TableRow>
                            {groupedLots[lotName].records.sort((a,b) => toDate(b.storageStartDate).getTime() - toDate(a.storageStartDate).getTime()).map(record => (
                                <TableRow key={record.id} className="hover:bg-muted/10 h-7 border-b border-slate-50">
                                    <TableCell></TableCell>
                                    <TableCell className="font-mono text-slate-400">{record.id}</TableCell>
                                    <TableCell className="font-medium whitespace-nowrap">{getCustomerName(record.customerId)}</TableCell>
                                    <TableCell className="hidden md:table-cell">{record.commodityDescription}</TableCell>
                                    <TableCell className="hidden lg:table-cell">{format(toDate(record.storageStartDate), 'dd/MM/yy')}</TableCell>
                                    <TableCell className="text-right font-mono font-medium">{record.bagsStored}</TableCell>
                                </TableRow>
                            ))}
                        </React.Fragment>
                    ))}
                </TableBody>
                <TableFooter>
                    <TableRow className="bg-slate-900 text-white hover:bg-slate-900 border-t-2 border-slate-900">
                        <TableCell colSpan={5} className="text-right font-bold uppercase text-[11px]">Total Warehouse Active Stock</TableCell>
                        <TableCell className="text-right font-bold font-mono text-xl">{grandTotalBags}</TableCell>
                    </TableRow>
                </TableFooter>
            </Table>
        </div>
    )
}

export function LotInventoryReport({ records, customers }: LotInventoryReportProps) {

    const groupedLots = useMemo(() => {
        // Strict filter for active stock only
        const activeRecords = records.filter(r => !r.storageEndDate && r.bagsStored > 0);
        
        const lots: GroupedLots = activeRecords.reduce((acc, record) => {
            const lotKey = record.location || 'Unassigned';
            if (!acc[lotKey]) {
                acc[lotKey] = { records: [], totalBags: 0 };
            }
            acc[lotKey].records.push(record);
            acc[lotKey].totalBags += record.bagsStored;
            return acc;
        }, {} as GroupedLots);

        return lots;
    }, [records]);

    const title = `Lot-wise Active Stock Report`;

    return (
        <Card className="border-primary/20 shadow-md">
            <CardHeader className="print-hide">
                <CardTitle>{title}</CardTitle>
                <CardDescription>A live summary of all inventory currently held in Godown, grouped by location.</CardDescription>
            </CardHeader>
            <CardContent>
                <LotInventoryTable 
                    groupedLots={groupedLots} 
                    customers={customers}
                    title={title}
                />
            </CardContent>
        </Card>
    );
}
