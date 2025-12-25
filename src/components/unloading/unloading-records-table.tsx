
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
  
export function UnloadingRecordsTable({ unloadingRecords, customers }: { unloadingRecords: UnloadingRecord[], customers: Customer[] }) {

    const getCustomerName = (customerId: string) => {
        return customers.find(c => c.id === customerId)?.name ?? 'Unknown';
    };

    return (
      <Card>
        <CardHeader>
            <CardTitle>Unloading History</CardTitle>
            <CardDescription>A log of all unloading activities.</CardDescription>
        </CardHeader>
        <CardContent>
            <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Commodity</TableHead>
                    <TableHead>Vehicle No.</TableHead>
                    <TableHead className="text-right">Bags</TableHead>
                    <TableHead className="text-right">Total Hamali</TableHead>
                    <TableHead>Status</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {unloadingRecords.map((record) => {
                    const unloadingDate = toDate(record.unloadingDate);
                    return (
                    <TableRow key={record.id}>
                        <TableCell>{unloadingDate ? format(unloadingDate, 'dd MMM yyyy') : 'N/A'}</TableCell>
                        <TableCell className="font-medium">{getCustomerName(record.customerId)}</TableCell>
                        <TableCell>{record.commodityDescription}</TableCell>
                        <TableCell>{record.lorryTractorNo}</TableCell>
                        <TableCell className="text-right">{record.bagsUnloaded}</TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(record.totalHamali || 0)}</TableCell>
                        <TableCell>
                            <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                                {record.status}
                            </Badge>
                        </TableCell>
                    </TableRow>
                    )
                })}
                 {unloadingRecords.length === 0 && (
                    <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground">
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
