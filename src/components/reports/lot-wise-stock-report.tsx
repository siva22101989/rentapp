'use client';

import React, { useMemo } from 'react';
import type { Customer, StorageRecord } from "@/lib/definitions";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from 'date-fns';
import { toDate } from '@/lib/utils';

type LotWiseStockReportProps = {
    records: StorageRecord[];
    customers: Customer[];
}

type GroupedLots = {
    [key: string]: {
        items: {
            pattiNo: string;
            customerName: string;
            commodity: string;
            bags: number;
            date: Date;
        }[];
        totalBags: number;
    }
}

export function LotWiseStockReport({ records, customers }: LotWiseStockReportProps) {
    const generatedDate = useMemo(() => format(new Date(), 'dd MMM yyyy, hh:mm a'), []);
    
    const groupedLots = useMemo(() => {
        const activeRecords = records.filter(r => !r.storageEndDate && r.bagsStored > 0);
        const customerMap = new Map(customers.map(c => [c.id, c.name]));
        
        const lots: GroupedLots = {};

        activeRecords.forEach(record => {
            const lotKey = record.location || 'Unassigned';
            if (!lots[lotKey]) {
                lots[lotKey] = { items: [], totalBags: 0 };
            }
            lots[lotKey].items.push({
                pattiNo: record.id,
                customerName: customerMap.get(record.customerId) || 'Unknown',
                commodity: record.commodityDescription,
                bags: record.bagsStored,
                date: toDate(record.storageStartDate)
            });
            lots[lotKey].totalBags += record.bagsStored;
        });

        return lots;
    }, [records, customers]);

    const lotNames = Object.keys(groupedLots).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    const grandTotalBags = useMemo(() => Object.values(groupedLots).reduce((acc, curr) => acc + curr.totalBags, 0), [groupedLots]);

    return (
        <div className="bg-white p-4 rounded-lg">
            <div className="mb-6 text-center">
                <h2 className="text-2xl font-bold">Lot-wise Stock Report</h2>
                <p className="text-muted-foreground">Breakdown of active inventory by storage location and customer.</p>
                <p className="text-xs text-muted-foreground">Generated: {generatedDate}</p>
            </div>
            
            {lotNames.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
                    No active stock found in any storage location.
                </div>
            ) : (
                <div className="space-y-8">
                    {lotNames.map(lotName => (
                        <div key={lotName} className="border rounded-lg overflow-hidden shadow-sm">
                            <div className="bg-secondary/30 px-4 py-2 border-b flex justify-between items-center">
                                <h3 className="font-bold text-lg">Godown / Lot: <span className="text-primary">{lotName}</span></h3>
                                <div className="text-sm font-medium">Total Bags: <span className="font-mono bg-background px-2 py-0.5 rounded border ml-1">{groupedLots[lotName].totalBags}</span></div>
                            </div>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Patti No</TableHead>
                                        <TableHead>Customer Name</TableHead>
                                        <TableHead>Commodity</TableHead>
                                        <TableHead className="hidden md:table-cell">Inflow Date</TableHead>
                                        <TableHead className="text-right">Bags in Stock</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {groupedLots[lotName].items.map((item, idx) => (
                                        <TableRow key={`${lotName}-${item.pattiNo}-${idx}`}>
                                            <TableCell className="font-medium">{item.pattiNo}</TableCell>
                                            <TableCell>{item.customerName}</TableCell>
                                            <TableCell>{item.commodity}</TableCell>
                                            <TableCell className="hidden md:table-cell text-muted-foreground">{format(item.date, 'dd MMM yyyy')}</TableCell>
                                            <TableCell className="text-right font-mono font-bold">{item.bags}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    ))}
                    
                    <div className="mt-8 p-4 bg-primary/5 border border-primary/20 rounded-lg flex justify-between items-center">
                        <div className="text-lg font-bold">Grand Total Warehouse Stock</div>
                        <div className="text-2xl font-bold text-primary font-mono">{grandTotalBags} Bags</div>
                    </div>
                </div>
            )}
        </div>
    );
}
