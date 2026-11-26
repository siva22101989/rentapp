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

    // NEWEST FIRST SORTING (Mandatory)
    const sortedEvents = useMemo(() => {
        return [...events].sort((a, b) => b.date.getTime() - a.date.getTime());
    }, [events]);

    // COMPULSORY TOTALS
    const totals = useMemo(() => {
        return sortedEvents.reduce((acc, event) => {
            acc.bags += (Number(event.bagsWithdrawn) || 0);
            acc.rent += (Number(event.rentBilled) || 0);
            acc.discount += (Number(event.discount) || 0);
            return acc;
        }, { bags: 0, rent: 0, discount: 0 });
    }, [sortedEvents]);

    return (
        <div className="bg-white p-6 text-black font-sans text-sm printable-area border-2 border-black shadow-none rounded-xl w-full mx-auto" style={{ width: '277mm' }}>
             <div className="mb-6 text-center border-b-2 border-black pb-4">
                <h2 className="text-2xl font-black uppercase tracking-tight leading-none text-center text-primary">{warehouseInfo?.name || 'SRI LAKSHMI WAREHOUSE'}</h2>
                <p className="text-[10px] text-slate-500 uppercase mt-1 text-center font-bold">Serialized Audit Register • Generated: {generatedDate}</p>
                <h3 className="font-black text-center mt-3 uppercase text-[13px] tracking-widest text-center">{title}</h3>
            </div>
            
            <div className="table-scroll-container border-y-2 border-black">
                <Table className="text-[13px] min-w-[800px]">
                    <TableHeader>
                        <TableRow className="border-b-2 border-black bg-slate-50">
                            <TableHead className="font-black text-black p-2 text-center uppercase text-[10px] border-r">Date</TableHead>
                            <TableHead className="font-black text-black p-2 text-center uppercase text-[10px] border-r">Bill No</TableHead>
                            <TableHead className="font-black text-black p-2 text-center uppercase text-[10px] border-r">Customer Name</TableHead>
                            <TableHead className="font-black text-black p-2 text-center uppercase text-[10px] border-r">Location/Lot</TableHead>
                            <TableHead className="font-black text-black p-2 text-center uppercase text-[10px] border-r">Bags Out</TableHead>
                            <TableHead className="font-black text-black p-2 text-center uppercase text-[10px] border-r">Rent Billed</TableHead>
                            <TableHead className="font-black text-black p-2 text-center uppercase text-[10px] border-r">Discount</TableHead>
                            <TableHead className="font-black text-black p-2 text-center uppercase text-[10px] print-hide">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {sortedEvents.map((event, index) => {
                            const parentRecord = allRecords.find(r => r.id === event.recordId);
                            const customer = customers.find(c => c.id === event.customerId);
                            const displayId = String(event.pattiNo || '').replace(/\D/g, '');

                            return (
                                <TableRow key={index} className="h-10 border-b border-slate-100 hover:bg-slate-50/50">
                                    <TableCell className="p-1 text-center whitespace-nowrap border-r">{format(toDate(event.date), 'dd/MM/yy')}</TableCell>
                                    <TableCell className="p-1 text-center font-mono font-black text-blue-600 whitespace-nowrap border-r">{displayId}</TableCell>
                                    <TableCell className="p-1 font-black whitespace-nowrap uppercase tracking-tight text-center border-r">{getCustomerName(event.customerId)}</TableCell>
                                    <TableCell className="p-1 text-slate-500 text-[11px] leading-tight whitespace-nowrap text-center border-r">
                                        <div className="font-bold text-slate-700">{event.location}</div>
                                        <div>{event.commodityDescription}</div>
                                    </TableCell>
                                    <TableCell className="p-1 text-center font-mono font-black text-orange-600 whitespace-nowrap border-r">{event.bagsWithdrawn}</TableCell>
                                    <TableCell className="p-1 text-right font-mono font-bold whitespace-nowrap text-center border-r">{formatCurrency(event.rentBilled)}</TableCell>
                                    <TableCell className="p-1 text-right font-mono text-green-600 font-bold text-center border-r">{event.discount ? formatCurrency(event.discount) : '-'}</TableCell>
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
                        {sortedEvents.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={8} className="text-center py-24 text-muted-foreground italic font-medium">
                                    No outflow entries found for this selection.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                    <TableFooter>
                        <TableRow className="bg-slate-50 text-black font-black border-t-2 border-black h-14 hover:bg-slate-50">
                            <TableCell colSpan={4} className="p-2 text-right uppercase text-[10px] tracking-widest pr-6 border-r">Grand Annual Outflow Totals</TableCell>
                            <TableCell className="p-2 text-center font-mono text-lg text-orange-600 border-r">{totals.bags}</TableCell>
                            <TableCell className="p-2 text-center font-mono text-lg border-r">{formatCurrency(totals.rent)}</TableCell>
                            <TableCell className="p-2 text-center font-mono text-lg text-green-700 border-r">{formatCurrency(totals.discount)}</TableCell>
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