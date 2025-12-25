
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
import type { Customer, DryingRecord, DryingStatus } from "@/lib/definitions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { DryingActionsMenu } from "./drying-actions-menu";
import { ArrowRight } from "lucide-react";

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
  
export function DryingRecordsTable({ dryingRecords, customers }: { dryingRecords: DryingRecord[], customers: Customer[] }) {

    const getCustomerName = (customerId: string) => {
        return customers.find(c => c.id === customerId)?.name ?? 'Unknown';
    };

    const sortedRecords = [...dryingRecords].sort((a, b) => {
        const dateA = a.dryingStartDate ? toDate(a.dryingStartDate) : new Date(0);
        const dateB = b.dryingStartDate ? toDate(b.dryingStartDate) : new Date(0);
        return dateB.getTime() - dateA.getTime();
    });

    return (
      <Card>
        <CardHeader>
            <CardTitle>Drying Process History</CardTitle>
            <CardDescription>A log of all drying activities and their current status.</CardDescription>
        </CardHeader>
        <CardContent>
            <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Start Date</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Commodity</TableHead>
                    <TableHead className="text-right">Bags</TableHead>
                    <TableHead className="text-right">Drying Hamali</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[50px] text-right"></TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {sortedRecords.map((record) => {
                    const dryingDate = record.dryingStartDate ? toDate(record.dryingStartDate) : null;
                    return (
                    <TableRow key={record.id}>
                        <TableCell>{dryingDate ? format(dryingDate, 'dd MMM yyyy') : 'N/A'}</TableCell>
                        <TableCell className="font-medium">{getCustomerName(record.customerId)}</TableCell>
                        <TableCell>{record.commodityDescription}</TableCell>
                        <TableCell className="text-right">
                           <div className="flex items-center justify-end gap-2">
                               <span>{record.bagsForDrying}</span>
                                {record.bagsPacked && (
                                    <>
                                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                                        <span className="font-bold">{record.bagsPacked}</span>
                                    </>
                                )}
                           </div>
                        </TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(record.totalDryingHamali || 0)}</TableCell>
                        <TableCell>
                            <Badge variant="secondary" className={getStatusBadgeVariant(record.status)}>
                                {record.status}
                            </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                            <DryingActionsMenu record={record} />
                        </TableCell>
                    </TableRow>
                    )
                })}
                 {dryingRecords.length === 0 && (
                    <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground">
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
