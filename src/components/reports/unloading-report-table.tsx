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
                <h2 className="text-xl font-bold uppercase tracking-wide">SRI LAKSHMI WAREHOUSE</h2>
                <p className="text-muted-foreground font-semibold uppercase">{title}</p>
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
                        <TableHead className="text-right">Bags Unloaded</TableHead>
                        <TableHead className="w-[50px] print-hide"></TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {records.map((record) => (
                        <TableRow key={record.id}>
                            <TableCell>{format(toDate(record.unloadingDate), 'dd/MM/yy')}</TableCell>
                            <TableCell className="font-mono">{record.billNo || record.id}</TableCell>
                            <TableCell className="font-medium">{getCustomerName(record.customerId)}</TableCell>
                            <TableCell>{record.location || 'N/A'}</TableCell>
                            <TableCell>{record.commodityDescription}</TableCell>
                            <TableCell className="text-right font-mono">{record.bagsUnloaded}</TableCell>
                            <TableCell className="text-right print-hide">
                                <UnloadingTableActionsMenu 
                                    record={{...record, hamaliPending: 0}} 
                                    customers={customers} 
                                    commodities={commodities}
                                    lots={[]} 
                                    storageRecords={[]}
                                />
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
                <TableFooter>
                    <TableRow>
                        <TableCell colSpan={5} className="text-right font-bold">Total Bags Unloaded</TableCell>
                        <TableCell className="text-right font-mono font-bold">{totalBagsUnloaded}</TableCell>
                        <TableCell className="print-hide"></TableCell>
                    </TableRow>
                </TableFooter>
            </Table>

            <div className="mt-16 pt-8 flex flex-col items-end text-center space-y-1">
                <div className="w-72 border-t border-slate-400 pt-4">
                    <p className="text-[#1e293b] font-bold text-sm uppercase tracking-wider">AUTHORIZED MANAGER SIGNATURE</p>
                    <p className="text-primary font-bold text-xs uppercase mt-1">SRI LAKSHMI WAREHOUSE</p>
                </div>
                <div className="text-[10px] text-slate-500 italic mt-4">
                    <p>Report validity verified on {generatedDate}</p>
                    <p>This is a computer generated statement.</p>
                </div>
            </div>
        </div>
    );
}
