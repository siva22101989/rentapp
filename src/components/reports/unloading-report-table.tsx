'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { format } from "date-fns";
import type { Customer, UnloadingRecord, Commodity, Lot, StorageRecord } from "@/lib/definitions";
import { toDate, formatCurrency } from '@/lib/utils';
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

    // NEWEST FIRST SORTING (Mandatory)
    const sortedRecords = useMemo(() => {
        return [...records].sort((a, b) => toDate(b.unloadingDate).getTime() - toDate(a.unloadingDate).getTime());
    }, [records]);

    // COMPULSORY TOTALS
    const totals = useMemo(() => {
        return sortedRecords.reduce((acc, record) => {
            acc.bags += (Number(record.bagsUnloaded) || 0);
            acc.hamali += (Number(record.totalHamali) || 0);
            return acc;
        }, { bags: 0, hamali: 0 });
    }, [sortedRecords]);

    return (
        <div className="bg-white p-6 text-black font-sans text-sm printable-area border-2 border-black shadow-none rounded-xl w-full mx-auto" style={{ width: '277mm' }}>
             <div className="mb-6 text-center border-b-2 border-black pb-4">
                <h2 className="text-2xl font-black uppercase tracking-tight leading-none text-center">SRI LAKSHMI WAREHOUSE</h2>
                <h3 className="font-black uppercase text-[13px] tracking-widest mt-2 text-center">{title}</h3>
                <p className="text-[10px] text-slate-400 mt-1 uppercase text-center font-bold">Unloading Audit Token: {generatedDate}</p>
            </div>
            
            <div className="table-scroll-container border-y-2 border-black">
                <Table className="text-[13px]">
                    <TableHeader>
                        <TableRow className="border-b-2 border-black bg-slate-50">
                            <TableHead className="font-black text-black p-2 text-center uppercase text-[10px] border-r">Date</TableHead>
                            <TableHead className="font-black text-black p-2 text-center uppercase text-[10px] border-r">Bill No</TableHead>
                            <TableHead className="font-black text-black p-2 text-center uppercase text-[10px] border-r">Customer Name</TableHead>
                            <TableHead className="font-black text-black p-2 text-center uppercase text-[10px] border-r">Commodity</TableHead>
                            <TableHead className="font-black text-black p-2 text-center uppercase text-[10px] border-r">Bags</TableHead>
                            <TableHead className="font-black text-black p-2 text-center uppercase text-[10px] border-r">Total Hamali</TableHead>
                            <TableHead className="font-black text-black p-2 text-center uppercase text-[10px] print-hide">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {sortedRecords.map((record) => {
                            const totalPaid = (record.payments || []).reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
                            const hamaliPending = Math.max(0, (Number(record.totalHamali) || 0) - totalPaid);
                            const cleanBillNo = String(record.billNo || record.id).replace(/\D/g, ''); 
                            
                            return (
                                <TableRow key={record.id} className="h-10 border-b border-slate-100 hover:bg-slate-50/50">
                                    <TableCell className="p-1 text-center border-r">{format(toDate(record.unloadingDate), 'dd/MM/yy')}</TableCell>
                                    <TableCell className="p-1 text-center font-mono font-bold text-center border-r">{cleanBillNo}</TableCell>
                                    <TableCell className="p-1 font-black uppercase whitespace-nowrap text-center border-r">{getCustomerName(record.customerId)}</TableCell>
                                    <TableCell className="p-1 text-center border-r">{record.commodityDescription}</TableCell>
                                    <TableCell className="p-1 text-center font-mono font-black text-slate-900 border-r">{record.bagsUnloaded}</TableCell>
                                    <TableCell className="p-1 text-right font-mono font-bold text-center border-r">{formatCurrency(record.totalHamali || 0)}</TableCell>
                                    <TableCell className="p-1 text-center print-hide">
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
                        {sortedRecords.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center py-24 text-muted-foreground italic font-medium">
                                    No unloading records found for the selected period.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                    <TableFooter>
                        <TableRow className="bg-slate-50 text-black font-black border-t-2 border-black h-14">
                            <TableCell colSpan={4} className="p-2 text-right uppercase text-[10px] tracking-widest pr-6 border-r">Grand Unloading Totals</TableCell>
                            <TableCell className="p-2 text-center font-mono text-lg border-r">{totals.bags}</TableCell>
                            <TableCell className="p-2 text-center font-mono text-lg border-r">{formatCurrency(totals.hamali)}</TableCell>
                            <TableCell className="print-hide" />
                        </TableRow>
                    </TableFooter>
                </Table>
            </div>
            
            <div className="mt-20 flex justify-end">
                <div className="w-72 border-t-2 border-black text-center pt-2">
                    <p className="font-black text-[12px] uppercase tracking-widest text-slate-800 text-center">Authorized Manager Signature</p>
                </div>
            </div>
        </div>
    );
}