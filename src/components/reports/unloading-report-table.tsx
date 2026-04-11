
'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { format } from "date-fns";
import type { Customer, UnloadingRecord, Commodity } from "@/lib/definitions";
import { toDate } from '@/lib/utils';
import { useMemo } from "react";
import { UnloadingTableActionsMenu } from "../unloading/unloading-table-actions-menu";

type ReportTableProps = {
    records: UnloadingRecord[];
    customers: Customer[];
    title: string;
    commodities: Commodity[];
}

export function UnloadingReportTable({ records, customers, title, commodities }: ReportTableProps) {
    const generatedDate = useMemo(() => format(new Date(), 'dd MMM yyyy, hh:mm a'), []);

    const getCustomerName = (customerId: string) => {
        return customers.find(c => c.id === customerId)?.name ?? 'Unknown';
    }

    const totalBagsUnloaded = records.reduce((acc, record) => acc + (record.bagsUnloaded || 0), 0);

    return (
        <div className="bg-white p-4 rounded-lg">
             <div className="mb-4">
                <h2 className="text-xl font-bold">GrainDost</h2>
                <p className="text-muted-foreground">{title}</p>
                <p className="text-xs text-muted-foreground">Generated on: {generatedDate}</p>
            </div>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Bill No</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead className="hidden md:table-cell">Commodity</TableHead>
                        <TableHead className="hidden lg:table-cell">Lorry/Tractor No</TableHead>
                        <TableHead className="text-right">Bags Unloaded</TableHead>
                        <TableHead className="w-[50px] print-hide"></TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {records.map((record) => {
                        const hamaliPending = (record.totalHamali || 0) - (record.payments || []).reduce((acc, p) => acc + p.amount, 0);
                        const recordWithPending = {...record, hamaliPending: Math.max(0, hamaliPending)};

                        return (
                            <TableRow key={record.id}>
                                <TableCell>{format(toDate(record.unloadingDate), 'dd MMM yyyy')}</TableCell>
                                <TableCell>{record.billNo}</TableCell>
                                <TableCell className="font-medium">{getCustomerName(record.customerId)}</TableCell>
                                <TableCell className="hidden md:table-cell">{record.commodityDescription}</TableCell>
                                <TableCell className="hidden lg:table-cell">{record.lorryTractorNo}</TableCell>
                                <TableCell className="text-right font-mono">{record.bagsUnloaded}</TableCell>
                                <TableCell className="text-right print-hide">
                                    <UnloadingTableActionsMenu 
                                        record={recordWithPending} 
                                        customers={customers} 
                                        commodities={commodities} 
                                    />
                                </TableCell>
                            </TableRow>
                        )
                    })}
                    {records.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={7} className="text-center text-muted-foreground">
                                No unloading records found for the selected criteria.
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
                <TableFooter>
                    <TableRow>
                        <TableCell colSpan={3} className="text-right font-bold md:hidden">Total</TableCell>
                        <TableCell colSpan={4} className="text-right font-bold hidden md:table-cell lg:hidden">Total</TableCell>
                        <TableCell colSpan={5} className="text-right font-bold hidden lg:table-cell">Total Bags Unloaded</TableCell>
                        <TableCell className="text-right font-mono font-bold">{totalBagsUnloaded}</TableCell>
                        <TableCell className="print-hide"></TableCell>
                    </TableRow>
                </TableFooter>
            </Table>
        </div>
    );
}
