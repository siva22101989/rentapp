'use client';

import { useState, useEffect } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { format } from "date-fns";
import type { Customer, StorageRecord } from "@/lib/definitions";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, toDate } from '@/lib/utils';
import { ActionsMenu } from "@/components/dashboard/actions-menu";


type ReportTableProps = {
    records: StorageRecord[];
    allRecords: StorageRecord[];
    customers: Customer[];
    title: string;
}

export function ReportTable({ records, allRecords, customers, title }: ReportTableProps) {
    const [generatedDate, setGeneratedDate] = useState('');

    useEffect(() => {
        setGeneratedDate(format(new Date(), 'dd MMM yyyy, hh:mm a'));
    }, []);

    const getCustomerName = (customerId: string) => {
        return customers.find(c => c.id === customerId)?.name ?? 'Unknown';
    }

    const recordsWithBalance = records.map(record => {
        const hamali = record.hamaliPayable || 0;
        const rent = record.totalRentBilled || 0;
        const totalBilled = hamali + rent;
        const amountPaid = (record.payments || []).reduce((acc, p) => acc + p.amount, 0);
        const balanceDue = totalBilled - amountPaid;
        return { ...record, totalBilled, amountPaid, balanceDue };
    }).sort((a, b) => {
        const dateA = toDate(a.storageStartDate);
        const dateB = toDate(b.storageStartDate);
        return dateB.getTime() - dateA.getTime();
    });

    const totalBagsIn = recordsWithBalance.reduce((acc, record) => acc + (record.bagsIn || 0), 0);
    const totalBagsOut = recordsWithBalance.reduce((acc, record) => acc + (record.bagsOut || 0), 0);
    const totalBagsStored = recordsWithBalance.reduce((acc, record) => acc + record.bagsStored, 0);
    const totalBilledSum = recordsWithBalance.reduce((acc, record) => acc + record.totalBilled, 0);
    const totalAmountPaid = recordsWithBalance.reduce((acc, record) => acc + record.amountPaid, 0);
    const totalBalanceDue = recordsWithBalance.reduce((acc, record) => acc + record.balanceDue, 0);

    return (
        <div className="bg-white p-4 rounded-lg">
             <div className="mb-4">
                <h2 className="text-xl font-bold">Srilakshmi Warehouse</h2>
                <p className="text-muted-foreground">{title}</p>
                {generatedDate && (
                    <p className="text-xs text-muted-foreground">Generated on: {generatedDate}</p>
                )}
            </div>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Customer</TableHead>
                        <TableHead className="hidden sm:table-cell">Start Date</TableHead>
                        <TableHead className="hidden lg:table-cell">End Date</TableHead>
                        <TableHead className="hidden md:table-cell">Status</TableHead>
                        <TableHead className="text-right hidden xl:table-cell">Bags In</TableHead>
                        <TableHead className="text-right hidden xl:table-cell">Bags Out</TableHead>
                        <TableHead className="text-right">Balance</TableHead>
                        <TableHead className="text-right hidden md:table-cell">Total Billed</TableHead>
                        <TableHead className="text-right hidden lg:table-cell">Amount Paid</TableHead>
                        <TableHead className="text-right">Balance Due</TableHead>
                        <TableHead className="w-[50px] text-right print-hide">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {recordsWithBalance.map((record) => {
                        const customerName = getCustomerName(record.customerId);
                        const startDate = toDate(record.storageStartDate);
                        const endDate = record.storageEndDate ? toDate(record.storageEndDate) : null;
                        return (
                        <TableRow key={record.id}>
                            <TableCell className="font-medium">{customerName}</TableCell>
                            <TableCell className="hidden sm:table-cell">{startDate ? format(startDate, 'dd MMM yyyy') : 'N/A'}</TableCell>
                            <TableCell className="hidden lg:table-cell">
                                {endDate ? format(endDate, 'dd MMM yyyy') : 'N/A'}
                            </TableCell>
                            <TableCell className="hidden md:table-cell">
                                <Badge variant={record.storageEndDate ? "secondary" : "default"} className={record.storageEndDate ? 'bg-zinc-100 text-zinc-800' : 'bg-green-100 text-green-800'}>
                                    {record.storageEndDate ? 'Completed' : 'Active'}
                                </Badge>
                            </TableCell>
                            <TableCell className="text-right hidden xl:table-cell">{record.bagsIn || 0}</TableCell>
                            <TableCell className="text-right hidden xl:table-cell">{record.bagsOut || 0}</TableCell>
                            <TableCell className="text-right font-bold">{record.bagsStored}</TableCell>
                            <TableCell className="text-right font-mono hidden md:table-cell">{formatCurrency(record.totalBilled || 0)}</TableCell>
                            <TableCell className="text-right font-mono hidden lg:table-cell">{formatCurrency(record.amountPaid || 0)}</TableCell>
                            <TableCell className={`text-right font-mono ${record.balanceDue > 0 ? 'text-destructive' : ''}`}>
                                {formatCurrency(record.balanceDue || 0)}
                            </TableCell>
                             <TableCell className="text-right print-hide">
                                <ActionsMenu record={record} customers={customers} allRecords={allRecords} />
                            </TableCell>
                        </TableRow>
                    )})}
                    {recordsWithBalance.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={11} className="text-center text-muted-foreground">
                                No records found for the selected customer.
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
                <TableFooter>
                    <TableRow>
                        <TableCell className="font-bold text-lg">Totals</TableCell>
                        <TableCell className="hidden sm:table-cell" />
                        <TableCell className="hidden lg:table-cell" />
                        <TableCell className="hidden md:table-cell" />
                        <TableCell className="text-right font-mono font-bold text-lg hidden xl:table-cell">{totalBagsIn}</TableCell>
                        <TableCell className="text-right font-mono font-bold text-lg hidden xl:table-cell">{totalBagsOut}</TableCell>
                        <TableCell className="text-right font-mono font-bold text-lg">{totalBagsStored}</TableCell>
                        <TableCell className="text-right font-mono font-bold text-lg hidden md:table-cell">{formatCurrency(totalBilledSum)}</TableCell>
                        <TableCell className="text-right font-mono font-bold text-lg hidden lg:table-cell">{formatCurrency(totalAmountPaid)}</TableCell>
                        <TableCell className="text-right font-mono font-bold text-lg text-destructive">
                            {formatCurrency(totalBalanceDue)}
                        </TableCell>
                         <TableCell className="print-hide" />
                    </TableRow>
                </TableFooter>
            </Table>
        </div>
    );
}
