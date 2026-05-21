'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { format } from "date-fns";
import type { Customer, UnloadingRecord, Commodity, Lot, StorageRecord } from "@/lib/definitions";
import { toDate } from '@/lib/utils';
import { useMemo } from "react";
import { UnloadingTableActionsMenu } from "../unloading/unloading-table-actions-menu";

type ReportTableProps = {
    records: UnloadingRecord[];
    customers: Customer[];
    commodities: Commodity[];
    lots: Lot[];
    storageRecords: StorageRecord[];
    title: string;
}

export function UnloadingReportTable({ records, customers, commodities, lots, storageRecords, title }: ReportTableProps) {
    const generatedDate = useMemo(() => format(new Date(), 'dd/MM/yy, h:mm a'), []);

    const getCustomerName = (customerId: string) => {
        return customers.find(c => c.id === customerId)?.name ?? 'Unknown';
    }

    const totalBagsUnloaded = records.reduce((acc, record) => acc + (record.bagsUnloaded || 0), 0);

    return (
        <div className="bg-white p-4 text-black font-sans text-sm printable-area">
             <div className="mb-4 text-center border-b-2 border-black pb-2">
                <h2 className="text-xl font-bold uppercase">{title}</h2>
                <p className="text-[10px] text-slate-500 uppercase">Generated: {generatedDate}</p>
            </div>
            <div className="table-scroll-container border-y-2 border-black">
                <Table className="text-[13px]">
                    <TableHeader>
                        <TableRow className="border-b border-black">
                            <TableHead className="font-bold text-black p-1 text-center uppercase text-[10px]">Date</TableHead>
                            <TableHead className="font-bold text-black p-1 text-center uppercase text-[10px]">Bill No</TableHead>
                            <TableHead className="font-bold text-black p-1 text-left uppercase text-[10px]">Customer Name</TableHead>
                            <TableHead className="font-bold text-black p-1 text-center uppercase text-[10px]">Commodity</TableHead>
                            <TableHead className="font-bold text-black p-1 text-center uppercase text-[10px]">Bags</TableHead>
                            <TableHead className="font-bold text-black p-1 text-right uppercase text-[10px] print-hide">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {records.map((record) => {
                            const totalPaid = (record.payments || []).reduce((acc, p) => acc + p.amount, 0);
                            const hamaliPending = Math.max(0, (record.totalHamali || 0) - totalPaid);
                            
                            return (
                                <TableRow key={record.id} className="h-8 border-b border-slate-100">
                                    <TableCell className="p-1 text-center">{format(toDate(record.unloadingDate), 'dd/MM/yy')}</TableCell>
                                    <TableCell className="p-1 text-center font-mono">{record.billNo || record.id}</TableCell>
                                    <TableCell className="p-1 font-medium uppercase whitespace-nowrap">{getCustomerName(record.customerId)}</TableCell>
                                    <TableCell className="p-1 text-center">{record.commodityDescription}</TableCell>
                                    <TableCell className="p-1 text-right font-mono font-bold">{record.bagsUnloaded}</TableCell>
                                    <TableCell className="p-1 text-right print-hide">
                                        <UnloadingTableActionsMenu 
                                            record={{ ...record, hamaliPending }} 
                                            customers={customers} 
                                            commodities={commodities}
                                            lots={lots}
                                            storageRecords={storageRecords}
                                        />
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                    <TableFooter>
                        <TableRow className="bg-slate-50 font-bold border-t-2 border-black">
                            <TableCell colSpan={4} className="p-1 text-right uppercase text-[10px]">Total Unloaded Bags</TableCell>
                            <TableCell className="p-1 text-right font-mono text-[14px]">{totalBagsUnloaded}</TableCell>
                            <TableCell className="print-hide" />
                        </TableRow>
                    </TableFooter>
                </Table>
            </div>
            <div className="mt-16 flex justify-end">
                <div className="w-56 border-t border-black text-center pt-1">
                    <p className="font-bold text-[12px] uppercase">Authorized Signature</p>
                </div>
            </div>
        </div>
    );
}