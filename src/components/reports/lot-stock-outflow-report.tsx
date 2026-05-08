
'use server';
/**
 * @fileOverview A report that groups stock by storage location (Lot) and shows customer-wise stock and outflow details.
 */

'use client';

import React, { useMemo } from 'react';
import type { Customer, StorageRecord } from "@/lib/definitions";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { format } from "date-fns";
import { toDate } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type ReportProps = {
    records: StorageRecord[];
    customers: Customer[];
}

export function LotStockOutflowReport({ records, customers }: ReportProps) {
    const generatedDate = useMemo(() => format(new Date(), 'dd MMM yyyy, hh:mm a'), []);
    
    const getCustomerName = (id: string) => {
        return customers.find(c => c.id === id)?.name || 'Unknown Customer';
    };

    const groupedData = useMemo(() => {
        // Filter for records that are in a lot and have either stock or had stock
        const filtered = records.filter(r => (r.bagsIn > 0 || r.bagsStored > 0) && r.location);
        
        const groups: Record<string, { 
            records: any[], 
            totalIn: number, 
            totalOut: number, 
            totalBalance: number 
        }> = {};

        filtered.forEach(r => {
            const lot = r.location || 'Unassigned';
            if (!groups[lot]) {
                groups[lot] = { records: [], totalIn: 0, totalOut: 0, totalBalance: 0 };
            }
            
            const bagsOut = (r.outflows || []).reduce((acc, o) => acc + o.bagsWithdrawn, 0);
            const balance = r.bagsStored;

            groups[lot].records.push({
                ...r,
                bagsOutCalculated: bagsOut,
                customerName: getCustomerName(r.customerId)
            });

            groups[lot].totalIn += r.bagsIn || 0;
            groups[lot].totalOut += bagsOut;
            groups[lot].totalBalance += balance;
        });

        // Sort lots alphabetically (numeric aware)
        return Object.entries(groups).sort((a, b) => 
            a[0].localeCompare(b[0], undefined, { numeric: true })
        );
    }, [records, customers]);

    return (
        <div className="space-y-8">
            <div className="text-center mb-6">
                <h2 className="text-2xl font-bold">Lot-wise Stock & Outflow Report</h2>
                <p className="text-muted-foreground text-sm tracking-wide uppercase">Detailed Customer Stock Breakdown</p>
                <p className="text-xs text-muted-foreground mt-1">Generated on: {generatedDate}</p>
            </div>

            {groupedData.length === 0 ? (
                <div className="text-center py-20 text-muted-foreground border-2 border-dashed rounded-xl">
                    No active stock or outflow records found in any lots.
                </div>
            ) : (
                groupedData.map(([lotName, data]) => (
                    <Card key={lotName} className="overflow-hidden border-primary/20 shadow-sm">
                        <CardHeader className="bg-primary/5 py-3">
                            <CardTitle className="text-primary flex items-center gap-2">
                                <span className="bg-primary text-primary-foreground px-2 py-0.5 rounded text-xs uppercase tracking-tight font-bold">Storage Location</span>
                                {lotName}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <Table className="text-xs">
                                <TableHeader className="bg-muted/30">
                                    <TableRow>
                                        <TableHead className="w-[80px] h-auto py-2">Patti No</TableHead>
                                        <TableHead className="min-w-[150px] h-auto py-2">Customer Name</TableHead>
                                        <TableHead className="h-auto py-2">Commodity</TableHead>
                                        <TableHead className="h-auto py-2">Inflow Date</TableHead>
                                        <TableHead className="text-right h-auto py-2">Inflow Bags</TableHead>
                                        <TableHead className="text-right text-orange-600 h-auto py-2">Total Outflow</TableHead>
                                        <TableHead className="text-right font-bold text-primary h-auto py-2">Balance Bags</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {data.records.sort((a,b) => toDate(b.storageStartDate).getTime() - toDate(a.storageStartDate).getTime()).map((r) => (
                                        <TableRow key={r.id} className="hover:bg-muted/20 border-b border-muted/50">
                                            <TableCell className="font-mono py-2">{r.id}</TableCell>
                                            <TableCell className="font-medium py-2">{r.customerName}</TableCell>
                                            <TableCell className="py-2">{r.commodityDescription}</TableCell>
                                            <TableCell className="py-2">{format(toDate(r.storageStartDate), 'dd/MM/yyyy')}</TableCell>
                                            <TableCell className="text-right font-mono py-2">{r.bagsIn}</TableCell>
                                            <TableCell className="text-right font-mono text-orange-600 py-2">{r.bagsOutCalculated}</TableCell>
                                            <TableCell className="text-right font-mono font-bold text-primary py-2">{r.bagsStored}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                                <TableFooter className="bg-muted/50 border-t-2 border-primary/20">
                                    <TableRow className="hover:bg-muted/50">
                                        <TableCell colSpan={4} className="text-right font-bold text-sm py-2">TOTALS FOR {lotName}</TableCell>
                                        <TableCell className="text-right font-mono font-bold text-sm py-2">{data.totalIn}</TableCell>
                                        <TableCell className="text-right font-mono font-bold text-sm text-orange-600 py-2">{data.totalOut}</TableCell>
                                        <TableCell className="text-right font-mono font-bold text-sm text-primary py-2">{data.totalBalance}</TableCell>
                                    </TableRow>
                                </TableFooter>
                            </Table>
                        </CardContent>
                    </Card>
                ))
            )}
            
            <div className="text-xs text-muted-foreground pt-4 border-t border-dashed text-center italic">
                End of Lot-wise Stock & Outflow Report
            </div>
        </div>
    );
}
