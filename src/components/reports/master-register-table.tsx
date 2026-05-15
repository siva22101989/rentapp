
'use client';

import React, { useMemo } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { format } from "date-fns";
import type { Customer, StorageRecord } from "@/lib/definitions";
import { toDate, formatCurrency } from '@/lib/utils';
import { Badge } from "../ui/badge";
import { ActionsMenu } from "../dashboard/actions-menu";

type MasterRegisterTableProps = {
    records: StorageRecord[];
    customers: Customer[];
    title: string;
}

export function MasterRegisterTable({ records, customers, title }: MasterRegisterTableProps) {
    const generatedDate = useMemo(() => format(new Date(), 'dd MMM yyyy, hh:mm a'), []);

    const getCustomerName = (customerId: string) => {
        return customers.find(c => c.id === customerId)?.name ?? 'Unknown';
    }

    const processedRecords = useMemo(() => {
        return records.map(record => {
            const totalPaid = (record.payments || []).reduce((acc, p) => acc + p.amount, 0);
            const totalBilled = (record.hamaliPayable || 0) + (record.totalRentBilled || 0);
            return {
                ...record,
                totalBilled,
                totalPaid,
                balanceDue: totalBilled - totalPaid
            };
        }).sort((a, b) => toDate(b.storageStartDate).getTime() - toDate(a.storageStartDate).getTime());
    }, [records]);

    const totals = useMemo(() => {
        return processedRecords.reduce((acc, r) => {
            acc.bagsIn += (r.bagsIn || 0);
            acc.bagsOut += (r.bagsOut || 0);
            acc.bagsStored += (r.bagsStored || 0);
            acc.billed += r.totalBilled;
            acc.paid += r.totalPaid;
            acc.due += r.balanceDue;
            return acc;
        }, { bagsIn: 0, bagsOut: 0, bagsStored: 0, billed: 0, paid: 0, due: 0 });
    }, [processedRecords]);

    return (
        <div className="bg-white p-4 rounded-lg overflow-x-auto">
             <div className="mb-6 text-center">
                <h2 className="text-2xl font-bold">Sri Lakshmi Warehouse Master Register</h2>
                <p className="text-muted-foreground">{title}</p>
                <p className="text-xs text-muted-foreground">Generated on: {generatedDate}</p>
            </div>
            <Table className="text-xs">
                <TableHeader>
                    <TableRow className="bg-muted/50">
                        <TableHead>Date</TableHead>
                        <TableHead>Storage ID</TableHead>
                        <TableHead className="min-w-[150px]">Customer</TableHead>
                        <TableHead>Commodity</TableHead>
                        <TableHead>Lot No</TableHead>
                        <TableHead className="text-right">Bags In</TableHead>
                        <TableHead className="text-right">Bags Out</TableHead>
                        <TableHead className="text-right font-bold">Balance</TableHead>
                        <TableHead className="text-right">Total Billed</TableHead>
                        <TableHead className="text-right">Amount Paid</TableHead>
                        <TableHead className="text-right font-bold">Amt Due</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-[50px] print-hide">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {processedRecords.length > 0 ? (
                        processedRecords.map((record) => (
                            <TableRow key={record.id}>
                                <TableCell className="whitespace-nowrap">{format(toDate(record.storageStartDate), 'dd/MM/yy')}</TableCell>
                                <TableCell className="font-medium">{record.id}</TableCell>
                                <TableCell className="font-medium whitespace-nowrap">{getCustomerName(record.customerId)}</TableCell>
                                <TableCell>{record.commodityDescription}</TableCell>
                                <TableCell>{record.location}</TableCell>
                                <TableCell className="text-right font-mono">{record.bagsIn}</TableCell>
                                <TableCell className="text-right font-mono">{record.bagsOut}</TableCell>
                                <TableCell className="text-right font-mono font-bold">{record.bagsStored}</TableCell>
                                <TableCell className="text-right font-mono">{formatCurrency(record.totalBilled)}</TableCell>
                                <TableCell className="text-right font-mono text-green-600">{formatCurrency(record.totalPaid)}</TableCell>
                                <TableCell className={`text-right font-mono font-bold ${record.balanceDue > 0.5 ? 'text-destructive' : ''}`}>
                                    {formatCurrency(record.balanceDue)}
                                </TableCell>
                                <TableCell>
                                    <Badge variant={record.storageEndDate ? "secondary" : "default"} className={record.storageEndDate ? 'bg-zinc-100 text-zinc-800' : 'bg-green-100 text-green-800'}>
                                        {record.storageEndDate ? 'Closed' : 'Active'}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-right print-hide">
                                    <ActionsMenu record={record} customers={customers} allRecords={records} />
                                </TableCell>
                            </TableRow>
                        ))
                    ) : (
                        <TableRow>
                            <TableCell colSpan={13} className="h-24 text-center text-muted-foreground">
                                No records found for the selected period.
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
                <TableFooter>
                    <TableRow className="border-t-2 border-primary bg-muted/30 font-bold">
                        <TableCell colSpan={5} className="text-right text-base">Grand Totals</TableCell>
                        <TableCell className="text-right font-mono">{totals.bagsIn}</TableCell>
                        <TableCell className="text-right font-mono">{totals.bagsOut}</TableCell>
                        <TableCell className="text-right font-mono">{totals.bagsStored}</TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(totals.billed)}</TableCell>
                        <TableCell className="text-right font-mono text-green-600">{formatCurrency(totals.paid)}</TableCell>
                        <TableCell className="text-right font-mono text-destructive">{formatCurrency(totals.due)}</TableCell>
                        <TableCell colSpan={2}></TableCell>
                    </TableRow>
                </TableFooter>
            </Table>
        </div>
    );
}
