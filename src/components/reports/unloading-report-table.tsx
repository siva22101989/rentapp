'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { format } from "date-fns";
import type { Customer, UnloadingRecord } from "@/lib/definitions";
import { toDate } from '@/lib/utils';
import { useMemo } from "react";

type ReportTableProps = {
    records: UnloadingRecord[];
    customers: Customer[];
    title: string;
}

export function UnloadingReportTable({ records, customers, title }: ReportTableProps) {
    const generatedDate = useMemo(() => format(new Date(), 'dd MMM yyyy, hh:mm a'), []);

    const getCustomerName = (customerId: string) => {
        return customers.find(c => c.id === customerId)?.name ?? 'Unknown';
    }

    const totalBagsUnloaded = records.reduce((acc, record) => acc + (record.bagsUnloaded || 0), 0);

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
                        <TableHead>Bill No</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Commodity</TableHead>
                        <TableHead>Lorry/Tractor No</TableHead>
                        <TableHead className="text-right">Bags Unloaded</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {records.map((record, index) => (
                        <TableRow key={record.id}>
                            <TableCell>{format(toDate(record.unloadingDate), 'dd MMM yyyy')}</TableCell>
                            <TableCell>{record.billNo}</TableCell>
                            <TableCell className="font-medium">{getCustomerName(record.customerId)}</TableCell>
                            <TableCell>{record.commodityDescription}</TableCell>
                            <TableCell>{record.lorryTractorNo}</TableCell>
                            <TableCell className="text-right font-mono">{record.bagsUnloaded}</TableCell>
                        </TableRow>
                    ))}
                    {records.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={6} className="text-center text-muted-foreground">
                                No unloading records found for the selected criteria.
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
                <TableFooter>
                    <TableRow>
                        <TableCell colSpan={5} className="text-right font-bold">Total Bags Unloaded</TableCell>
                        <TableCell className="text-right font-mono font-bold">{totalBagsUnloaded}</TableCell>
                    </TableRow>
                </TableFooter>
            </Table>
        </div>
    );
}
