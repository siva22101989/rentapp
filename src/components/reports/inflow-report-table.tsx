
'use client';

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

    return (
        <div className="bg-white p-4 rounded-lg">
             <div className="mb-4">
                <h2 className="text-xl font-bold">Srilakshmi Warehouse</h2>
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
                    {records.map((record, index) => {
                        return (
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
                    )})}
                    {records.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={10} className="p-2 text-center text-muted-foreground">
                                No inflow records found for the selected criteria.
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
                <TableFooter>
                    <TableRow>
                        <TableCell colSpan={3} className="p-2 text-right font-bold sm:hidden">Totals</TableCell>
                        <TableCell colSpan={4} className="p-2 text-right font-bold hidden sm:table-cell md:hidden">Totals</TableCell>
                        <TableCell colSpan={6} className="p-2 text-right font-bold hidden md:table-cell lg:hidden">Totals</TableCell>
                        <TableCell colSpan={7} className="p-2 text-right font-bold hidden lg:table-cell xl:hidden">Totals</TableCell>
                        <TableCell colSpan={8} className="p-2 text-right font-bold hidden xl:table-cell">Totals</TableCell>

                        <TableCell className="p-2 text-right font-mono font-bold hidden xl:table-cell">{totalBagsIn}</TableCell>
                        <TableCell className="p-2 text-right font-mono font-bold">{totalWeight.toFixed(2)}</TableCell>
                        <TableCell className="p-2 print-hide hidden xl:table-cell"></TableCell>
                    </TableRow>
                </TableFooter>
            </Table>
        </div>
    );
}
