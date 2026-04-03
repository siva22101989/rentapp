
'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { format } from "date-fns";
import type { Customer, StorageRecord } from "@/lib/definitions";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from '@/lib/utils';
import { useMemo } from "react";

type PendingRecord = StorageRecord & {
    totalBilled: number;
    amountPaid: number;
    balanceDue: number;
    hamaliPending: number;
    rentPending: number;
};

type ReportTableProps = {
    records: PendingRecord[];
    customers: Customer[];
    title: string;
};

export function PendingDuesReportTable({ records, customers, title }: ReportTableProps) {
    const generatedDate = useMemo(() => format(new Date(), 'dd MMM yyyy, hh:mm a'), []);

    const getCustomerName = (customerId: string) => {
        return customers.find(c => c.id === customerId)?.name ?? 'Unknown';
    };

    const totalDue = records.reduce((sum, r) => sum + r.balanceDue, 0);

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
                        <TableHead>Record ID</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead className="hidden sm:table-cell">Status</TableHead>
                        <TableHead className="text-right hidden lg:table-cell">Bags In</TableHead>
                        <TableHead className="text-right hidden lg:table-cell">Bags Out</TableHead>
                        <TableHead className="text-right hidden xl:table-cell">Total Billed</TableHead>
                        <TableHead className="text-right hidden md:table-cell">Hamali Pending</TableHead>
                        <TableHead className="text-right hidden md:table-cell">Rent Pending</TableHead>
                        <TableHead className="text-right">Total Due</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {records.map((record) => (
                        <TableRow key={record.id}>
                            <TableCell className="font-medium">{record.id}</TableCell>
                            <TableCell>{getCustomerName(record.customerId)}</TableCell>
                            <TableCell className="hidden sm:table-cell">
                                <Badge variant={record.storageEndDate ? "secondary" : "default"} className={record.storageEndDate ? 'bg-zinc-100 text-zinc-800' : 'bg-green-100 text-green-800'}>
                                    {record.storageEndDate ? 'Completed' : 'Active'}
                                </Badge>
                            </TableCell>
                            <TableCell className="text-right font-mono hidden lg:table-cell">{record.bagsIn || 0}</TableCell>
                            <TableCell className="text-right font-mono hidden lg:table-cell">{record.bagsOut || 0}</TableCell>
                            <TableCell className="text-right font-mono hidden xl:table-cell">{formatCurrency(record.totalBilled)}</TableCell>
                            <TableCell className="text-right font-mono text-orange-600 hidden md:table-cell">{formatCurrency(record.hamaliPending)}</TableCell>
                            <TableCell className="text-right font-mono text-blue-600 hidden md:table-cell">{formatCurrency(record.rentPending)}</TableCell>
                            <TableCell className="text-right font-mono text-destructive">{formatCurrency(record.balanceDue)}</TableCell>
                        </TableRow>
                    ))}
                     {records.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={9} className="text-center text-muted-foreground">
                                No pending dues found.
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
                <TableFooter>
                    <TableRow>
                        <TableCell colSpan={3} className="text-right font-bold hidden sm:table-cell">Total Pending Dues</TableCell>
                        <TableCell colSpan={2} className="text-right font-bold sm:hidden">Total Due</TableCell>
                        <TableCell className="hidden lg:table-cell" />
                        <TableCell className="hidden lg:table-cell" />
                        <TableCell className="hidden xl:table-cell" />
                        <TableCell className="hidden md:table-cell" />
                        <TableCell className="hidden md:table-cell" />
                        <TableCell className="text-right font-bold text-destructive font-mono">{formatCurrency(totalDue)}</TableCell>
                    </TableRow>
                </TableFooter>
            </Table>
        </div>
    );
}
