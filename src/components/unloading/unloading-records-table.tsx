
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
import type { Customer, UnloadingRecord } from "@/lib/definitions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { UnloadingTableActionsMenu } from "./unloading-table-actions-menu";

type StatusInfo = {
    text: 'Unloading' | 'Partially Drying' | 'Drying Complete';
    variant: 'bg-blue-100 text-blue-800' | 'bg-yellow-100 text-yellow-800' | 'bg-green-100 text-green-800';
}

const getRecordStatus = (record: UnloadingRecord): StatusInfo => {
    const bagsSent = record.bagsSentToDrying || 0;
    if (bagsSent === 0) {
        return { text: 'Unloading', variant: 'bg-blue-100 text-blue-800' };
    }
    if (bagsSent < record.bagsUnloaded) {
        return { text: 'Partially Drying', variant: 'bg-yellow-100 text-yellow-800' };
    }
    return { text: 'Drying Complete', variant: 'bg-green-100 text-green-800' };
};
  
export function UnloadingRecordsTable({ unloadingRecords, customers }: { unloadingRecords: UnloadingRecord[], customers: Customer[] }) {

    const getCustomerName = (customerId: string) => {
        return customers.find(c => c.id === customerId)?.name ?? 'Unknown';
    };

    const recordsWithPending = unloadingRecords.map(record => {
        const totalPaid = (record.payments || []).reduce((acc, p) => acc + p.amount, 0);
        const hamaliPending = (record.totalHamali || 0) - totalPaid;
        return {
            ...record,
            hamaliPending: Math.max(0, hamaliPending)
        }
    }).sort((a, b) => {
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
                    <TableHead className="hidden lg:table-cell">Date</TableHead>
                    <TableHead>Bill No.</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead className="text-right hidden xl:table-cell">Total Bags</TableHead>
                    <TableHead className="text-right hidden xl:table-cell">Bags for Drying</TableHead>
                    <TableHead className="text-right">Bags Remaining</TableHead>
                    <TableHead className="text-right hidden lg:table-cell">Total Hamali</TableHead>
                    <TableHead className="text-right">Hamali Pending</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {recordsWithPending.map((record) => {
                    const unloadingDate = toDate(record.unloadingDate);
                    const statusInfo = getRecordStatus(record);
                    const bagsSent = record.bagsSentToDrying || 0;
                    const bagsRemaining = record.bagsUnloaded - bagsSent;
                    return (
                    <TableRow key={record.id}>
                        <TableCell className="hidden lg:table-cell">{unloadingDate ? format(unloadingDate, 'dd MMM yyyy') : 'N/A'}</TableCell>
                        <TableCell>{record.billNo}</TableCell>
                        <TableCell className="font-medium">{getCustomerName(record.customerId)}</TableCell>
                        <TableCell className="text-right hidden xl:table-cell">{record.bagsUnloaded}</TableCell>
                        <TableCell className="text-right hidden xl:table-cell">{bagsSent}</TableCell>
                        <TableCell className="text-right font-bold">{bagsRemaining}</TableCell>
                        <TableCell className="text-right font-mono hidden lg:table-cell">{formatCurrency(record.totalHamali || 0)}</TableCell>
                        <TableCell className="text-right font-mono text-destructive">{formatCurrency(record.hamaliPending)}</TableCell>
                        <TableCell>
                            <Badge variant="secondary" className={statusInfo.variant}>
                                {statusInfo.text}
                            </Badge>
                        </TableCell>
                        <TableCell>
                            <UnloadingTableActionsMenu record={record} />
                        </TableCell>
                    </TableRow>
                    )
                })}
                 {unloadingRecords.length === 0 && (
                    <TableRow>
                        <TableCell colSpan={10} className="text-center text-muted-foreground">
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
