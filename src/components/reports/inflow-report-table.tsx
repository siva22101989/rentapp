'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { format } from "date-fns";
import type { Customer, StorageRecord } from "@/lib/definitions";
import { toDate } from '@/lib/utils';
import { useMemo } from "react";
import { Badge } from "../ui/badge";

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
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Serial No</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Commodity</TableHead>
                        <TableHead>Inflow Type</TableHead>
                        <TableHead>Lorry/Tractor No</TableHead>
                        <TableHead>Lot No</TableHead>
                        <TableHead className="text-right">Bags</TableHead>
                        <TableHead className="text-right">Weight (Kgs)</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {records.map((record, index) => (
                        <TableRow key={record.id}>
                            <TableCell>{format(toDate(record.storageStartDate), 'dd MMM yyyy')}</TableCell>
                            <TableCell>{record.id}</TableCell>
                            <TableCell className="font-medium">{getCustomerName(record.customerId)}</TableCell>
                            <TableCell>{record.commodityDescription}</TableCell>
                            <TableCell>
                                <Badge variant={record.inflowType === 'Direct' ? 'default' : 'secondary'} className={record.inflowType === 'Plot' ? 'bg-purple-100 text-purple-800' : ''}>
                                    {record.inflowType || 'Direct'}
                                </Badge>
                            </TableCell>
                            <TableCell>{record.lorryTractorNo}</TableCell>
                            <TableCell>{record.location}</TableCell>
                            <TableCell className="text-right font-mono">{record.bagsIn}</TableCell>
                            <TableCell className="text-right font-mono">{record.weight}</TableCell>
                        </TableRow>
                    ))}
                    {records.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={9} className="text-center text-muted-foreground">
                                No inflow records found for the selected criteria.
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
                <TableFooter>
                    <TableRow>
                        <TableCell colSpan={7} className="text-right font-bold">Totals</TableCell>
                        <TableCell className="text-right font-mono font-bold">{totalBagsIn}</TableCell>
                        <TableCell className="text-right font-mono font-bold">{totalWeight.toFixed(2)}</TableCell>
                    </TableRow>
                </TableFooter>
            </Table>
        </div>
    );
}
