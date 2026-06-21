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
    outflowIndex: number;
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

    const totalBagsWithdrawn = events.reduce((acc, event) => acc + (Number(event.bagsWithdrawn) || 0), 0);
    const totalRentBilled = events.reduce((acc, event) => acc + (Number(event.rentBilled) || 0), 0);

    return (
        <div className="bg-white p-4 text-black font-sans text-sm printable-area border shadow-sm rounded-lg w-full overflow-hidden">
             <div className="mb-4 text-center border-b pb-2">
                <h2 className="text-xl font-bold uppercase tracking-tight leading-none text-center">SRI LAKSHMI WAREHOUSE</h2>
                <p className="text-[10px] text-slate-500 uppercase mt-1 text-center">Serialized Audit Register • Generated: {generatedDate}</p>
                <h3 className="font-bold text-center mt-3 uppercase text-[12px] underline decoration-slate-200 underline-offset-4 text-center">{title}</h3>
            </div>
            
            <div className="table-scroll-container border-y-2 border-black">
                <Table className="text-[13px] min-w-[800px]">
                    <TableHeader>
                        <TableRow className="border-b border-black bg-slate-50">
                            <TableHead className="font-bold text-black p-2 text-center uppercase text-[10px] whitespace-nowrap">Date</TableHead>
                            <TableHead className="font-bold text-black p-2 text-center uppercase text-[10px] whitespace-nowrap">Bill No</TableHead>
                            <TableHead className="font-bold text-black p-2 text-center uppercase text-[10px] whitespace-nowrap">Customer Name</TableHead>
                            <TableHead className="font-bold text-black p-2 text-center uppercase text-[10px] whitespace-nowrap">Location/Lot</TableHead>
                            <TableHead className="font-bold text-black p-2 text-center uppercase text-[10px] whitespace-nowrap">Bags Out</TableHead>
                            <TableHead className="font-bold text-black p-2 text-center uppercase text-[10px] whitespace-nowrap">Rent Billed</TableHead>
                            <TableHead className="font-bold text-black p-2 text-center uppercase text-[10px] print-hide whitespace-nowrap">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {events.map((event, index) => {
                            const parentRecord = allRecords.find(r => r.id === event.recordId);
                            const customer = customers.find(c => c.id === event.customerId);
                            const displayId = String(event.pattiNo || '').replace(/\D/g, '');

                            return (
                                <TableRow key={index} className="h-8 border-b border-slate-100 hover:bg-slate-50/50">
                                    <TableCell className="p-1 text-center whitespace-nowrap">{format(toDate(event.date), 'dd/MM/yy')}</TableCell>
                                    <TableCell className="p-1 text-center font-mono font-black text-blue-600 whitespace-nowrap">{displayId}</TableCell>
                                    <TableCell className="p-1 font-black whitespace-nowrap uppercase tracking-tight">{getCustomerName(event.customerId)}</TableCell>
                                    <TableCell className="p-1 text-slate-500 text-[11px] leading-tight whitespace-nowrap text-center">
                                        <div className="font-bold text-slate-700">{event.location}</div>
                                        <div>{event.commodityDescription}</div>
                                    </TableCell>
                                    <TableCell className="p-1 text-center font-mono font-black text-orange-600 whitespace-nowrap">{event.bagsWithdrawn}</TableCell>
                                    <TableCell className="p-1 text-right font-mono font-bold whitespace-nowrap">{formatCurrency(event.rentBilled)}</TableCell>
                                    <TableCell className="p-1 text-right print-hide whitespace-nowrap">
                                        {parentRecord && customer && (
                                            <OutflowActionsMenu 
                                                record={parentRecord}
                                                customer={customer}
                                                warehouseInfo={warehouseInfo}
                                                outflow={event}
                                                outflowIndex={event.outflowIndex}
                                                deliveryOrderNo={displayId}
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
                        {events.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center py-20 text-muted-foreground italic">
                                    No outflow entries found for this selection.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                    <TableFooter>
                        <TableRow className="bg-slate-900 text-white font-black border-t-2 border-black h-10 hover:bg-slate-900">
                            <TableCell colSpan={4} className="p-2 text-right uppercase text-[10px] tracking-widest whitespace-nowrap">Grand Total Summary</TableCell>
                            <TableCell className="p-2 text-center font-mono text-[14px] text-orange-200 whitespace-nowrap">{totalBagsWithdrawn}</TableCell>
                            <TableCell className="p-2 text-right font-mono text-[14px] whitespace-nowrap">{formatCurrency(totalRentBilled)}</TableCell>
                            <TableCell className="print-hide" />
                        </TableRow>
                    </TableFooter>
                </Table>
            </div>
            
            <div className="mt-16 flex justify-end">
                <div className="w-64 border-t-2 border-black text-center pt-2">
                    <p className="font-black text-[12px] uppercase tracking-widest text-slate-800">Authorized Manager Signature</p>
                </div>
            </div>
        </div>
    );
}
