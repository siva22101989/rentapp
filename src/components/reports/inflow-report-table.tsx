'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { format } from "date-fns";
import type { Customer, StorageRecord } from "@/lib/definitions";
import { toDate } from '@/lib/utils';
import { useMemo } from "react";
import { Badge } from "../ui/badge";
import { ActionsMenu } from "@/components/dashboard/actions-menu";

type ReportTableProps = {
    records: StorageRecord[];
    customers: Customer[];
    title: string;
}

export function InflowReportTable({ records, customers, title }: ReportTableProps) {
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
                        <TableHead className="h-auto py-2 px-2">Serial No</TableHead>
                        <TableHead className="h-auto py-2 px-2">Customer</TableHead>
                        <TableHead className="h-auto py-2 px-2">Commodity</TableHead>
                        <TableHead className="h-auto py-2 px-2">Inflow Type</TableHead>
                        <TableHead className="h-auto py-2 px-2">Lorry/Tractor No</TableHead>
                        <TableHead className="h-auto py-2 px-2">Lot No</TableHead>
                        <TableHead className="h-auto py-2 px-2 text-right">Bags</TableHead>
                        <TableHead className="h-auto py-2 px-2 text-right">Weight (Kgs)</TableHead>
                        <TableHead className="h-auto py-2 px-2 w-[50px] text-right print-hide">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {records.map((record, index) => (
                        <TableRow key={record.id}>
                            <TableCell className="p-2">{format(toDate(record.storageStartDate), 'dd MMM yyyy')}</TableCell>
                            <TableCell className="p-2">{record.id}</TableCell>
                            <TableCell className="p-2 font-medium">{getCustomerName(record.customerId)}</TableCell>
                            <TableCell className="p-2">{record.commodityDescription}</TableCell>
                            <TableCell className="p-2">
                                <Badge variant={record.inflowType === 'Direct' ? 'default' : 'secondary'} className={record.inflowType === 'Plot' ? 'bg-purple-100 text-purple-800' : ''}>
                                    {record.inflowType || 'Direct'}
                                </Badge>
                            </TableCell>
                            <TableCell className="p-2">{record.lorryTractorNo}</TableCell>
                            <TableCell className="p-2">{record.location}</TableCell>
                            <TableCell className="p-2 text-right font-mono">{record.bagsIn}</TableCell>
                            <TableCell className="p-2 text-right font-mono">{record.weight}</TableCell>
                            <TableCell className="p-2 text-right print-hide">
                                <ActionsMenu record={record} customers={customers} allRecords={records} />
                            </TableCell>
                        </TableRow>
                    ))}
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
                        <TableCell colSpan={7} className="p-2 text-right font-bold">Totals</TableCell>
                        <TableCell className="p-2 text-right font-mono font-bold">{totalBagsIn}</TableCell>
                        <TableCell className="p-2 text-right font-mono font-bold">{totalWeight.toFixed(2)}</TableCell>
                        <TableCell className="p-2 print-hide"></TableCell>
                    </TableRow>
                </TableFooter>
            </Table>
        </div>
    );
}
