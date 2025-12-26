
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
import type { Customer, DryingRecord, UnloadingRecord, DryingStatus } from "@/lib/definitions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { DryingActionsMenu } from "./drying-actions-menu";

const getStatusBadgeVariant = (status: DryingStatus) => {
    switch (status) {
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
  
type TableProps = {
  dryingRecords: DryingRecord[];
  customers: Customer[];
  unloadingRecords: UnloadingRecord[];
}

export function DryingHistoryTable({ dryingRecords, customers, unloadingRecords }: TableProps) {

    const getCustomerName = (customerId: string) => {
        return customers.find(c => c.id === customerId)?.name ?? 'Unknown';
    };
    
    const getUnloadingBillNo = (unloadingRecordId: string) => {
      return unloadingRecords.find(ur => ur.id === unloadingRecordId)?.billNo ?? 'N/A';
    }

    return (
      <Card>
        <CardHeader>
            <CardTitle>Drying Records</CardTitle>
            <CardDescription>A log of all drying activities and their current status.</CardDescription>
        </CardHeader>
        <CardContent>
            <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Start Date</TableHead>
                    <TableHead>Unloading Bill</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Bags for Drying</TableHead>
                    <TableHead>Bags Packed</TableHead>
                    <TableHead className="text-right">Total Hamali</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[50px] text-right"></TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {dryingRecords.map((record) => {
                    const dryingStartDate = toDate(record.dryingStartDate);
                    return (
                    <TableRow key={record.id}>
                        <TableCell>{dryingStartDate ? format(dryingStartDate, 'dd MMM yyyy') : 'N/A'}</TableCell>
                        <TableCell>{getUnloadingBillNo(record.unloadingRecordId)}</TableCell>
                        <TableCell className="font-medium">{getCustomerName(record.customerId)}</TableCell>
                        <TableCell>{record.bagsForDrying}</TableCell>
                        <TableCell>{record.bagsPacked ?? 'N/A'}</TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(record.totalDryingHamali || 0)}</TableCell>
                        <TableCell>
                            <Badge variant="secondary" className={getStatusBadgeVariant(record.status)}>
                                {record.status}
                            </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                            <DryingActionsMenu record={record} unloadingRecord={unloadingRecords.find(ur => ur.id === record.unloadingRecordId)} />
                        </TableCell>
                    </TableRow>
                    )
                })}
                 {dryingRecords.length === 0 && (
                    <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground">
                            No drying records found.
                        </TableCell>
                    </TableRow>
                )}
            </TableBody>
            </Table>
        </CardContent>
      </Card>
    );
}
