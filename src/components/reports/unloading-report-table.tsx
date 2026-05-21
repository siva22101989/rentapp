
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
                <p className="text-muted-foreground font-semibold uppercase text-[14px]">{title}</p>
                <p className="text-[11px] text-slate-400 mt-1">Generated: {generatedDate}</p>
            </div>
            <Table className="text-[13px]">
                <TableHeader>
                    <TableRow className="bg-muted/50">
                        <TableHead className="uppercase text-[10px] font-bold">Date</TableHead>
                        <TableHead className="uppercase text-[10px] font-bold">Bill No</TableHead>
                        <TableHead className="uppercase text-[10px] font-bold">Customer</TableHead>
                        <TableHead className="uppercase text-[10px] font-bold">Lot No</TableHead>
                        <TableHead className="uppercase text-[10px] font-bold">Commodity</TableHead>
                        <TableHead className="text-right uppercase text-[10px] font-bold">Bags Unloaded</TableHead>
                        <TableHead className="w-[50px] print-hide"></TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {records.map((record) => (
                        <TableRow key={record.id} className="h-8">
                            <TableCell className="p-1">{format(toDate(record.unloadingDate), 'dd/MM/yy')}</TableCell>
                            <TableCell className="p-1 font-mono">{record.billNo || record.id}</TableCell>
                            <TableCell className="p-1 font-medium">{getCustomerName(record.customerId)}</TableCell>
                            <TableCell className="p-1">{record.location || 'N/A'}</TableCell>
                            <TableCell className="p-1">{record.commodityDescription}</TableCell>
                            <TableCell className="p-1 text-right font-mono">{record.bagsUnloaded}</TableCell>
                            <TableCell className="p-1 text-right print-hide">
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
                    {records.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={7} className="text-center text-muted-foreground py-10 italic">No unloading records found.</TableCell>
                        </TableRow>
                    )}
                </TableBody>
                <TableFooter>
                    <TableRow className="bg-secondary/50 font-bold">
                        <TableCell colSpan={5} className="p-2 text-right uppercase text-[10px]">Total Bags Unloaded</TableCell>
                        <TableCell className="p-2 text-right font-mono">{totalBagsUnloaded}</TableCell>
                        <TableCell className="print-hide"></TableCell>
                    </TableRow>
                </TableFooter>
            </Table>
            
            <div className="mt-16 pt-8 flex flex-col items-end text-center space-y-1">
                <div className="w-72 border-t border-slate-400 pt-4">
                    <p className="text-[#1e293b] font-bold text-[12px] uppercase tracking-wider">Authorized Manager Signature</p>
                </div>
            </div>
        </div>
    );
}
