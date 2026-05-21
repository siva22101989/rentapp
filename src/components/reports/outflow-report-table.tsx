'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { format } from "date-fns";
import type { Customer, StorageRecord, Outflow, Commodity, Lot } from "@/lib/definitions";
import { toDate, formatCurrency } from '@/lib/utils';
import { useMemo } from "react";
import { OutflowActionsMenu } from "./outflow-actions-menu";
import { useDoc } from "@/firebase/firestore/use-doc";
import { useFirestore } from "@/firebase/provider";
import { useMemoFirebase } from "@/hooks/use-memo-firebase";
import { doc } from "firebase/firestore";
import { useAppUser } from "@/firebase/auth/use-user";

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
    title: string;
    allRecords: StorageRecord[];
    commodities: Commodity[];
    lots: Lot[];
}

export function OutflowReportTable({ events, customers, title, allRecords, commodities, lots }: ReportTableProps) {
    const generatedDate = useMemo(() => format(new Date(), 'dd/MM/yyyy, hh:mm a'), []);
    const firestore = useFirestore();
    const appUser = useAppUser();

    const warehouseInfoRef = useMemoFirebase(
        () => (firestore && appUser?.warehouseId ? doc(firestore, 'warehouses', appUser.warehouseId) : null),
        [firestore, appUser]
    );
    const { data: warehouseInfo } = useDoc<any>(warehouseInfoRef);

    const getCustomerName = (customerId: string) => {
        return customers.find(c => c.id === customerId)?.name ?? 'Unknown';
    }

    const totalBagsWithdrawn = events.reduce((acc, event) => acc + (event.bagsWithdrawn || 0), 0);
    const totalRentBilled = events.reduce((acc, event) => acc + (event.rentBilled || 0), 0);

    return (
        <div className="bg-white p-4 sm:p-6 rounded border shadow-sm">
             <div className="mb-6 text-center border-b pb-4">
                <h2 className="text-xl font-bold text-slate-900 uppercase">{title}</h2>
                <p className="text-[10px] text-slate-500 uppercase mt-1">Generated: {generatedDate}</p>
            </div>
            <Table className="text-[13px] border-collapse border border-slate-200">
                <TableHeader>
                    <TableRow className="bg-slate-50">
                        <TableHead className="text-black font-bold border-r p-2 text-center uppercase text-[10px]">Date</TableHead>
                        <TableHead className="text-black font-bold border-r p-2 text-center uppercase text-[10px]">Patti No</TableHead>
                        <TableHead className="text-black font-bold border-r p-2 text-left uppercase text-[10px]">Customer</TableHead>
                        <TableHead className="text-black font-bold border-r p-2 text-center uppercase text-[10px]">Product</TableHead>
                        <TableHead className="text-black font-bold border-r p-2 text-center uppercase text-[10px]">Lot</TableHead>
                        <TableHead className="text-black font-bold border-r p-2 text-center uppercase text-[10px]">Bags Out</TableHead>
                        <TableHead className="text-black font-bold border-r p-2 text-right uppercase text-[10px]">Rent</TableHead>
                        <TableHead className="text-black font-bold p-2 text-center uppercase text-[10px] print-hide">Action</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {events.map((event, index) => {
                        const fullRecord = allRecords.find(r => r.id === event.recordId);
                        const customer = customers.find(c => c.id === event.customerId);
                        
                        const outflowIndex = fullRecord ? (fullRecord.outflows || []).findIndex(o => 
                            toDate(o.date).getTime() === event.date.getTime() &&
                            o.bagsWithdrawn === event.bagsWithdrawn &&
                            o.rentBilled === event.rentBilled
                        ) : -1;

                        const deliveryOrderNo = outflowIndex !== -1 ? `${event.recordId}-${outflowIndex + 1}` : event.recordId;

                        return (
                        <TableRow key={index} className="hover:bg-slate-50 h-7 border-b border-slate-100">
                            <TableCell className="p-1 text-center whitespace-nowrap">{format(toDate(event.date), 'dd/MM/yy')}</TableCell>
                            <TableCell className="p-1 text-center font-mono text-slate-400">{deliveryOrderNo}</TableCell>
                            <TableCell className="p-1 font-bold whitespace-nowrap">{getCustomerName(event.customerId)}</TableCell>
                            <TableCell className="p-1 text-center">{event.commodityDescription}</TableCell>
                            <TableCell className="p-1 text-center font-mono">{event.location}</TableCell>
                            <TableCell className="p-1 text-center font-mono font-bold text-orange-600">{event.bagsWithdrawn}</TableCell>
                            <TableCell className="p-1 text-right font-mono">{formatCurrency(event.rentBilled)}</TableCell>
                            <TableCell className="p-1 text-center print-hide">
                                {fullRecord && customer && outflowIndex !== -1 && (
                                    <OutflowActionsMenu
                                        record={fullRecord}
                                        customer={customer}
                                        warehouseInfo={warehouseInfo}
                                        outflow={event}
                                        outflowIndex={outflowIndex}
                                        deliveryOrderNo={deliveryOrderNo}
                                        deliveryOrderDate={event.date}
                                        commodities={commodities}
                                        lots={lots}
                                        allRecords={allRecords}
                                    />
                                )}
                            </TableCell>
                        </TableRow>
                    )})}
                </TableBody>
                <TableFooter>
                    <TableRow className="border-t border-slate-900 bg-slate-50 font-bold">
                        <TableCell colSpan={5} className="p-2 text-right uppercase text-[10px]">Total Outflow</TableCell>
                        <TableCell className="p-2 text-center font-mono text-[14px] text-orange-600">{totalBagsWithdrawn}</TableCell>
                        <TableCell className="p-2 text-right font-mono">{formatCurrency(totalRentBilled)}</TableCell>
                        <TableCell className="p-2 print-hide"></TableCell>
                    </TableRow>
                </TableFooter>
            </Table>

            <div className="mt-16 flex justify-end">
                <div className="w-64 border-t border-slate-400 text-center pt-2">
                    <p className="font-bold text-xs uppercase">Authorized Signature</p>
                </div>
            </div>
        </div>
    );
}