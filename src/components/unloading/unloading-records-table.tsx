'use client';

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
  } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from 'date-fns';
import { formatCurrency, toDate } from "@/lib/utils";
import type { Customer, UnloadingRecord, UnloadingStatus } from "@/lib/definitions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { UnloadingActionsMenu } from "./unloading-actions-menu";

const getStatusBadgeVariant = (status: UnloadingStatus) => {
    switch (status) {
        case 'Unloading':
            return 'bg-blue-100 text-blue-800';
        case 'Drying':
            return 'bg-yellow-100 text-yellow-800';
        case 'Packing':
            return 'bg-purple-100 text-purple-800';
        case 'Billed':
            return 'bg-green-100 text-green-800';
        default:
            return 'bg-zinc-100 text-zinc-800';
    }
}
  
export function UnloadingRecordsTable({ unloadingRecords, customers }: { unloadingRecords: UnloadingRecord[], customers: Customer[] }) {

    const getCustomerName = (customerId: string) => {
        return customers.find(c => c.id === customerId)?.name ?? 'Unknown';
    };

    const sortedRecords = [...unloadingRecords].sort((a, b) => {
        const dateA = toDate(a.unloadingDate);
        const dateB = toDate(b.unloadingDate);
        return dateB.getTime() - dateA.getTime();
    });

    return (
      <Card>
        <CardHeader>
            <CardTitle>Unloading History</CardTitle>
            <CardDescription>A log of all unloading activities and their current status.</CardDescription>
        </CardHeader>
        <CardContent>
            <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Bill No.</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Commodity</TableHead>
                    <TableHead className="text-right">Bags</TableHead>
                    <TableHead className="text-right">Total Hamali</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[50px] text-right"></TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {sortedRecords.map((record) => {
                    const unloadingDate = toDate(record.unloadingDate);
                    return (
                    <TableRow key={record.id}>
                        <TableCell>{unloadingDate ? format(unloadingDate, 'dd MMM yyyy') : 'N/A'}</TableCell>
                        <TableCell>{record.billNo}</TableCell>
                        <TableCell className="font-medium">{getCustomerName(record.customerId)}</TableCell>
                        <TableCell>{record.commodityDescription}</TableCell>
                        <TableCell className="text-right">{record.bagsUnloaded}</TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(record.totalHamali || 0)}</TableCell>
                        <TableCell>
                            <Badge variant="secondary" className={getStatusBadgeVariant(record.status)}>
                                {record.status}
                            </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                            <UnloadingActionsMenu record={record} />
                        </TableCell>
                    </TableRow>
                    )
                })}
                 {unloadingRecords.length === 0 && (
                    <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground">
                            No unloading records found.
                        </TableCell>
                    </TableRow>
                )}
            </TableBody>
            </Table>
        </CardContent>
      </Card>
    );
}
