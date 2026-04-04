
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
    allRecords: StorageRecord[];
}

export function InflowReportTable({ records, customers, title, allRecords }: ReportTableProps) {
    const generatedDate = useMemo(() => format(new Date(), 'dd MMM yyyy, hh:mm a'), []);

    const getCustomerName = (customerId: string) => {
        return customers.find(c => c.id === customerId)?.name ?? 'Unknown';
    }

    const totalBagsIn = records.reduce((acc, record) => acc + (record.bagsIn || 0), 0);
    const totalWeight = records.reduce((acc, record) => acc + (record.weight || 0), 0);
    
    const RECORDS_PER_PAGE = 25; // Define how many records per "page"

    return (
        <div className="bg-white p-4 rounded-lg">
             <div className="mb-4">
                <h2 className="text-xl font-bold">GrainDost</h2>
                <p className="text-muted-foreground">{title}</p>
                <p className="text-xs text-muted-foreground">Generated on: {generatedDate}</p>
            </div>
            <Table className="text-xs">
                <TableHeader>
                    <TableRow>
                        <TableHead className="h-auto py-2 px-2">Date</TableHead>
                        <TableHead className="h-auto py-2 px-2">Bill No</TableHead>
                        <TableHead className="h-auto py-2 px-2">Customer</TableHead>
                        <TableHead className="h-auto py-2 px-2 hidden md:table-cell">Commodity</TableHead>
                        <TableHead className="h-auto py-2 px-2 hidden lg:table-cell">Inflow Type</TableHead>
                        <TableHead className="h-auto py-2 px-2 hidden lg:table-cell">Lorry/Tractor No</TableHead>
                        <TableHead className="h-auto py-2 px-2 hidden md:table-cell">Lot No</TableHead>
                        <TableHead className="h-auto py-2 px-2 text-right">Bags</TableHead>
                        <TableHead className="h-auto py-2 px-2 text-right hidden xl:table-cell">Weight (Kgs)</TableHead>
                        <TableHead className="h-auto py-2 px-2 w-[50px] text-right print-hide hidden xl:table-cell">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {records.length > 0 ? (
                        (() => {
                            const rows: React.ReactNode[] = [];
                            let pageBagsIn = 0;
                            let pageWeight = 0;

                            records.forEach((record, index) => {
                                pageBagsIn += record.bagsIn || 0;
                                pageWeight += record.weight || 0;

                                rows.push(
                                    <TableRow key={record.id}>
                                        <TableCell className="p-2">{format(toDate(record.storageStartDate), 'dd MMM yyyy')}</TableCell>
                                        <TableCell className="p-2">{record.id}</TableCell>
                                        <TableCell className="p-2 font-medium">{getCustomerName(record.customerId)}</TableCell>
                                        <TableCell className="p-2 hidden md:table-cell">{record.commodityDescription}</TableCell>
                                        <TableCell className="p-2 hidden lg:table-cell">
                                            <Badge variant={record.inflowType === 'Direct' ? 'default' : 'secondary'} className={record.inflowType === 'Plot' ? 'bg-purple-100 text-purple-800' : ''}>
                                                {record.inflowType || 'Direct'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="p-2 hidden lg:table-cell">{record.lorryTractorNo}</TableCell>
                                        <TableCell className="p-2 hidden md:table-cell">{record.location}</TableCell>
                                        <TableCell className="p-2 text-right font-mono">{record.bagsIn}</TableCell>
                                        <TableCell className="p-2 text-right font-mono hidden xl:table-cell">{record.weight}</TableCell>
                                        <TableCell className="p-2 text-right print-hide hidden xl:table-cell">
                                            <ActionsMenu record={record} customers={customers} allRecords={allRecords} />
                                        </TableCell>
                                    </TableRow>
                                );

                                if ((index + 1) % RECORDS_PER_PAGE === 0 && index < records.length - 1) {
                                    rows.push(
                                        <TableRow key={`subtotal-${index}`} className="bg-muted/50 hover:bg-muted/50 font-bold">
                                            <TableCell colSpan={7} className="p-2 text-right">Page Total</TableCell>
                                            <TableCell className="p-2 text-right font-mono">{pageBagsIn}</TableCell>
                                            <TableCell className="p-2 text-right font-mono hidden xl:table-cell">{pageWeight.toFixed(2)}</TableCell>
                                            <TableCell className="p-2 print-hide hidden xl:table-cell"></TableCell>
                                        </TableRow>
                                    );
                                    pageBagsIn = 0;
                                    pageWeight = 0;
                                }
                            });
                            return rows;
                        })()
                    ) : (
                        <TableRow>
                            <TableCell colSpan={10} className="p-2 text-center text-muted-foreground">
                                No inflow records found for the selected criteria.
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
                <TableFooter>
                    <TableRow className="border-t-2 border-primary">
                        <TableCell 
                            colSpan={7}
                            className="p-2 text-right font-bold text-lg"
                        >
                            Grand Total
                        </TableCell>
                        <TableCell className="p-2 text-right font-mono font-bold text-lg">{totalBagsIn}</TableCell>
                        <TableCell className="p-2 text-right font-mono font-bold text-lg hidden xl:table-cell">{totalWeight.toFixed(2)}</TableCell>
                        <TableCell className="p-2 print-hide hidden xl:table-cell"></TableCell>
                    </TableRow>
                </TableFooter>
            </Table>
        </div>
    );
}
