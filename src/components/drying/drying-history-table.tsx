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
import type { Customer, DryingRecord, UnloadingRecord, DryingStatus, Lot, StorageRecord, Commodity } from "@/lib/definitions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { DryingActionsMenu } from "@/components/drying/drying-actions-menu";
import { useMemo } from "react";

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
  lots: Lot[];
  storageRecords: StorageRecord[];
  commodities: Commodity[];
}

export function DryingHistoryTable({ dryingRecords, customers, unloadingRecords, lots, storageRecords, commodities }: TableProps) {

    const getCustomerName = (customerId: string) => {
        return customers.find(c => c.id === customerId)?.name ?? 'Unknown';
    };
    
    const getUnloadingBillNo = (unloadingRecordId: string) => {
      return unloadingRecords.find(ur => ur.id === unloadingRecordId)?.billNo ?? 'N/A';
    }

    const validDryingRecords = useMemo(() => {
        const customerIdSet = new Set(customers.map(c => c.id));
        const unloadingRecordIdSet = new Set(unloadingRecords.map(ur => ur.id));

        return dryingRecords
            .filter(record => 
                record.customerId && 
                customerIdSet.has(record.customerId) &&
                record.unloadingRecordId &&
                unloadingRecordIdSet.has(record.unloadingRecordId)
            )
            .sort((a,b) => toDate(b.dryingStartDate).getTime() - toDate(a.dryingStartDate).getTime());
    }, [dryingRecords, customers, unloadingRecords]);

    return (
      <Card>
        <CardHeader>
            <CardTitle>Drying Process History</CardTitle>
            <CardDescription>Track ongoing and completed drying activities.</CardDescription>
        </CardHeader>
        <CardContent>
            <Table>
            <TableHeader>
                <TableRow>
                    <TableHead className="hidden md:table-cell">Start Date</TableHead>
                    <TableHead>Unloading Bill</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead className="hidden lg:table-cell">Bags for Drying</TableHead>
                    <TableHead>Bags Packed</TableHead>
                    <TableHead className="text-right hidden lg:table-cell">Total Hamali</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[50px] text-right"></TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {validDryingRecords
                    .map((record) => {
                    const dryingStartDate = toDate(record.dryingStartDate);
                    return (
                    <TableRow key={record.id}>
                        <TableCell className="hidden md:table-cell">{dryingStartDate ? format(dryingStartDate, 'dd MMM yyyy') : 'N/A'}</TableCell>
                        <TableCell>{getUnloadingBillNo(record.unloadingRecordId)}</TableCell>
                        <TableCell className="font-medium">{getCustomerName(record.customerId)}</TableCell>
                        <TableCell className="hidden lg:table-cell">{record.bagsForDrying}</TableCell>
                        <TableCell>{record.bagsPacked ?? 'N/A'}</TableCell>
                        <TableCell className="text-right font-mono hidden lg:table-cell">{formatCurrency(record.totalDryingHamali || 0)}</TableCell>
                        <TableCell>
                            <Badge variant="secondary" className={getStatusBadgeVariant(record.status)}>
                                {record.status}
                            </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                            <DryingActionsMenu 
                                record={record} 
                                unloadingRecord={unloadingRecords.find(ur => ur.id === record.unloadingRecordId)} 
                                lots={lots} 
                                storageRecords={storageRecords} 
                                commodities={commodities}
                            />
                        </TableCell>
                    </TableRow>
                    )
                })}
                 {validDryingRecords.length === 0 && (
                    <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground">
                            No active drying processes found.
                        </TableCell>
                    </TableRow>
                )}
            </TableBody>
            </Table>
        </CardContent>
      </Card>
    );
}
