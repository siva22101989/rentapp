
'use client';

import React, { useMemo } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { format } from "date-fns";
import type { Customer, StorageRecord } from "@/lib/definitions";
import { toDate, formatCurrency } from '@/lib/utils';
import { Badge } from "../ui/badge";
import { ActionsMenu } from "../dashboard/actions-menu";

export function MasterRegisterTable({ records, customers, title }: { records: StorageRecord[], customers: Customer[], title: string }) {
    const generatedDate = useMemo(() => format(new Date(), 'dd MMM yyyy, hh:mm a'), []);
    const getCustomerName = (id: string) => customers.find(c => c.id === id)?.name ?? 'Unknown';

    const processed = useMemo(() => {
        return [...records].map(r => {
            const paid = (r.payments || []).reduce((acc, p) => acc + p.amount, 0);
            const billed = (r.hamaliPayable || 0) + (r.totalRentBilled || 0);
            return { 
                ...r, 
                billed, 
                paid, 
                due: billed - paid,
                startDate: toDate(r.storageStartDate)
            };
        }).sort((a, b) => b.startDate.getTime() - a.startDate.getTime());
    }, [records]);

    const totals = useMemo(() => {
        return processed.reduce((acc, r) => {
            acc.bags += r.bagsStored || 0;
            acc.billed += r.billed;
            acc.paid += r.paid;
            acc.due += r.due;
            return acc;
        }, { bags: 0, billed: 0, paid: 0, due: 0 });
    }, [processed]);

    return (
        <div className="bg-white p-4 rounded-lg overflow-x-auto">
             <div className="mb-6 text-center report-component-header">
                <h2 className="text-2xl font-bold">GrainDost Master Register</h2>
                <p className="text-muted-foreground">{title}</p>
                <p className="text-xs text-muted-foreground">Generated: {generatedDate}</p>
            </div>
            <Table className="text-xs">
                <TableHeader>
                    <TableRow className="bg-muted/50">
                        <TableHead>Date</TableHead>
                        <TableHead>Patti No</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Product</TableHead>
                        <TableHead>Location (Lot)</TableHead>
                        <TableHead className="text-right">Stock</TableHead>
                        <TableHead className="text-right">Billed</TableHead>
                        <TableHead className="text-right">Paid</TableHead>
                        <TableHead className="text-right">Balance</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="print-hide text-right">Action</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {processed.map(r => (
                        <TableRow key={r.id}>
                            <TableCell>{format(r.startDate, 'dd/MM/yy')}</TableCell>
                            <TableCell className="font-mono font-medium">{r.id}</TableCell>
                            <TableCell className="whitespace-nowrap font-medium">{getCustomerName(r.customerId)}</TableCell>
                            <TableCell>{r.commodityDescription}</TableCell>
                            <TableCell>{r.location}</TableCell>
                            <TableCell className="text-right font-mono font-semibold">{r.bagsStored}</TableCell>
                            <TableCell className="text-right font-mono">{formatCurrency(r.billed)}</TableCell>
                            <TableCell className="text-right font-mono text-green-600">{formatCurrency(r.paid)}</TableCell>
                            <TableCell className={`text-right font-mono font-bold ${r.due > 0.5 ? 'text-destructive' : ''}`}>{formatCurrency(r.due)}</TableCell>
                            <TableCell>
                                <Badge variant={r.storageEndDate ? 'secondary' : 'default'} className={r.storageEndDate ? 'bg-zinc-100 text-zinc-800' : 'bg-green-100 text-green-800'}>
                                    {r.storageEndDate ? 'Closed' : 'Active'}
                                </Badge>
                            </TableCell>
                            <TableCell className="print-hide text-right">
                                <ActionsMenu record={r} customers={customers} allRecords={records} />
                            </TableCell>
                        </TableRow>
                    ))}
                    {processed.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={11} className="text-center py-12 text-muted-foreground italic">
                                No records found in the system.
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
                <TableFooter>
                    <TableRow className="font-bold border-t-2 border-primary">
                        <TableCell colSpan={5} className="text-right">Grand Totals</TableCell>
                        <TableCell className="text-right font-mono text-lg">{totals.bags}</TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(totals.billed)}</TableCell>
                        <TableCell className="text-right font-mono text-green-600">{formatCurrency(totals.paid)}</TableCell>
                        <TableCell className="text-right font-mono text-destructive text-lg">{formatCurrency(totals.due)}</TableCell>
                        <TableCell colSpan={2} />
                    </TableRow>
                </TableFooter>
            </Table>
        </div>
    );
}
