
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
             <div className="mb-4 text-center">
                <h2 className="text-xl font-bold">Sri Lakshmi Warehouse</h2>
                <p className="text-muted-foreground font-semibold">{title}</p>
                <p className="text-xs text-muted-foreground">Generated on: {generatedDate}</p>
            </div>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Bill No</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Lot No</TableHead>
                        <TableHead>Commodity</TableHead>
                        <TableHead>Lorry/Tractor No</TableHead>
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
                                <TableCell>{record.location || 'N/A'}</TableCell>
                                <TableCell>{record.commodityDescription}</TableCell>
                                <TableCell>{record.lorryTractorNo}</TableCell>
                                <TableCell className="text-right font-mono">{record.bagsUnloaded}</TableCell>
                                <TableCell className="text-right print-hide">
                                    <UnloadingTableActionsMenu 
                                        record={recordWithPending} 
                                        customers={customers} 
                                        commodities={commodities}
                                        lots={[]} // Empty array here as it's not needed for the action menu in report view
                                        storageRecords={[]}
                                    />
                                </TableCell>
                            </TableRow>
                        )
                    })}
                    {records.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={8} className="text-center text-muted-foreground">
                                No unloading records found for the selected criteria.
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
                <TableFooter>
                    <TableRow>
                        <TableCell colSpan={6} className="text-right font-bold">Total Bags Unloaded</TableCell>
                        <TableCell className="text-right font-mono font-bold">{totalBagsUnloaded}</TableCell>
                        <TableCell className="print-hide"></TableCell>
                    </TableRow>
                </TableFooter>
            </Table>
        </div>
    );
}
