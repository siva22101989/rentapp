'use client';

import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { format } from "date-fns";
import type { Customer, StorageRecord } from "@/lib/definitions";
import { toDate } from '@/lib/utils';
import { useMemo } from "react";
import { Badge } from "../ui/badge";
import { ActionsMenu } from "../dashboard/actions-menu";


type ReportTableProps = {
    records: StorageRecord[];
    customers: Customer[];
    title: string;
    description: string;
    allRecords: StorageRecord[];
}

export function InflowReportTable({ records, customers, title, description, allRecords }: ReportTableProps) {
    const generatedDate = useMemo(() => format(new Date(), 'dd MMM yyyy, hh:mm a'), []);

    const getCustomerName = (customerId: string) => {
        return customers.find(c => c.id === customerId)?.name ?? 'Unknown';
    }

    const totalBagsIn = records.reduce((acc, record) => acc + (record.bagsIn || 0), 0);

    return (
        <div className="bg-white p-4 rounded-lg">
             <div className="mb-4 text-center report-component-header">
                <h2 className="text-xl font-bold">GrainDost</h2>
                <p className="text-lg font-semibold">{title}</p>
                <p className="text-sm text-muted-foreground">{description}</p>
                <p className="text-xs text-muted-foreground">Generated on: {generatedDate}</p>
            </div>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="h-auto p-2">Date</TableHead>
                        <TableHead className="h-auto p-2">Bill No</TableHead>
                        <TableHead className="h-auto p-2 min-w-[180px]">Customer</TableHead>
                        <TableHead className="h-auto p-2">Commodity</TableHead>
                        <TableHead className="h-auto p-2">Inflow Type</TableHead>
                        <TableHead className="h-auto p-2">Lot No</TableHead>
                        <TableHead className="h-auto p-2 text-right">Bags</TableHead>
                        <TableHead className="h-auto p-2 w-[50px] text-right print-hide">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {records.length > 0 ? (
                        records.map((record) => (
                            <TableRow key={record.id}>
                                <TableCell className="p-2">{format(toDate(record.storageStartDate), 'dd MMM yyyy')}</TableCell>
                                <TableCell className="p-2">{record.id}</TableCell>
                                <TableCell className="p-2 font-medium whitespace-nowrap">{getCustomerName(record.customerId)}</TableCell>
                                <TableCell className="p-2">{record.commodityDescription}</TableCell>
                                <TableCell className="p-2">
                                    <Badge variant={record.inflowType === 'Direct' ? 'default' : 'secondary'} className={record.inflowType === 'Plot' ? 'bg-purple-100 text-purple-800' : ''}>
                                        {record.inflowType || 'Direct'}
                                    </Badge>
                                </TableCell>
                                <TableCell className="p-2">{record.location}</TableCell>
                                <TableCell className="p-2 text-right font-mono">{record.bagsIn}</TableCell>
                                <TableCell className="p-2 text-right print-hide">
                                    <ActionsMenu record={record} customers={customers} allRecords={allRecords} />
                                </TableCell>
                            </TableRow>
                        ))
                    ) : (
                        <TableRow>
                            <TableCell colSpan={8} className="p-2 text-center text-muted-foreground">
                                No inflow records found for the selected criteria.
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
                <TableFooter>
                    <TableRow className="border-t-2 border-primary bg-secondary">
                        <TableCell 
                            colSpan={6}
                            className="p-2 text-right font-bold text-lg"
                        >
                            Grand Total
                        </TableCell>
                        <TableCell className="p-2 text-right font-mono font-bold text-lg">{totalBagsIn}</TableCell>
                        <TableCell className="p-2 print-hide"></TableCell>
                    </TableRow>
                </TableFooter>
            </Table>
        </div>
    );
}
