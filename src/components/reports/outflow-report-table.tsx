'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { format } from "date-fns";
import type { Customer, StorageRecord, Outflow, Commodity, Lot, WarehouseInfo } from "@/lib/definitions";
import { toDate, formatCurrency } from '@/lib/utils';
import { useMemo } from "react";
import { OutflowActionsMenu } from "./outflow-actions-menu";

export type OutflowEvent = Outflow & {
    customerId: string;
    recordId: string;
    commodityDescription: string;
    location?: string;
    date: Date;
};

type ReportTableProps = {
    events: OutflowEvent[];
    customers: Customer[];
    allRecords: StorageRecord[];
    commodities: Commodity[];
    lots: Lot[];
    warehouseInfo: WarehouseInfo | null;
    title: string;
}

export function OutflowReportTable({ events, customers, allRecords, commodities, lots, warehouseInfo, title }: ReportTableProps) {
    const generatedDate = useMemo(() => format(new Date(), 'dd/MM/yy, h:mm a'), []);

    const getCustomerName = (customerId: string) => {
        return customers.find(c => c.id === customerId)?.name ?? 'Unknown';
    }

    const totalBagsWithdrawn = events.reduce((acc, event) => acc + (event.bagsWithdrawn || 0), 0);
    const totalRentBilled = events.reduce((acc, event) => acc + (event.rentBilled || 0), 0);

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
                            <TableHead className="font-bold text-black p-1 text-center uppercase text-[10px]">Patti No</TableHead>
                            <TableHead className="font-bold text-black p-1 text-left uppercase text-[10px]">Customer Name</TableHead>
                            <TableHead className="font-bold text-black p-1 text-center uppercase text-[10px]">Bags Out</TableHead>
                            <TableHead className="font-bold text-black p-1 text-right uppercase text-[10px]">Rent Billed</TableHead>
                            <TableHead className="font-bold text-black p-1 text-right uppercase text-[10px] print-hide">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {events.map((event, index) => {
                            const parentRecord = allRecords.find(r => r.id === event.recordId);
                            const customer = customers.find(c => c.id === event.customerId);
                            const outflowIndex = parentRecord?.outflows?.findIndex(o => 
                                toDate(o.date).getTime() === event.date.getTime() && 
                                o.bagsWithdrawn === event.bagsWithdrawn
                            ) ?? -1;

                            return (
                                <TableRow key={index} className="h-7 border-b border-slate-100">
                                    <TableCell className="p-1 text-center whitespace-nowrap">{format(toDate(event.date), 'dd/MM/yy')}</TableCell>
                                    <TableCell className="p-1 text-center font-mono">{event.recordId}</TableCell>
                                    <TableCell className="p-1 font-bold whitespace-nowrap uppercase">{getCustomerName(event.customerId)}</TableCell>
                                    <TableCell className="p-1 text-center font-mono font-bold">{event.bagsWithdrawn}</TableCell>
                                    <TableCell className="p-1 text-right font-mono">{formatCurrency(event.rentBilled)}</TableCell>
                                    <TableCell className="p-1 text-right print-hide">
                                        {parentRecord && customer && outflowIndex !== -1 && (
                                            <OutflowActionsMenu 
                                                record={parentRecord}
                                                customer={customer}
                                                warehouseInfo={warehouseInfo}
                                                outflow={parentRecord.outflows![outflowIndex]}
                                                outflowIndex={outflowIndex}
                                                deliveryOrderNo={`${parentRecord.id}-${outflowIndex + 1}`}
                                                deliveryOrderDate={event.date}
                                                commodities={commodities}
                                                lots={lots}
                                                allRecords={allRecords}
                                            />
                                        )}
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                    <TableFooter>
                        <TableRow className="bg-slate-50 font-bold border-t-2 border-black">
                            <TableCell colSpan={3} className="p-1 text-right uppercase text-[10px]">Total Withdrawal Summary</TableCell>
                            <TableCell className="p-1 text-center font-mono text-[14px]">{totalBagsWithdrawn}</TableCell>
                            <TableCell className="p-1 text-right font-mono">{formatCurrency(totalRentBilled)}</TableCell>
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