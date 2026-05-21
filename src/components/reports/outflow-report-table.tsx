
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
        <div className="bg-white p-6 rounded-xl border shadow-sm">
             <div className="mb-8 text-center border-b pb-6">
                <h2 className="text-xl font-black text-slate-900 tracking-tight uppercase leading-none">SRI LAKSHMI WAREHOUSE</h2>
                <p className="text-[14px] font-bold text-slate-500 uppercase tracking-[0.3em] mt-2">{title}</p>
                <p className="text-[11px] font-bold text-primary uppercase mt-1">Generated: {generatedDate}</p>
            </div>
            <Table className="text-[13px] border-collapse">
                <TableHeader>
                    <TableRow className="bg-[#3498db] hover:bg-[#3498db] border-none">
                        <TableHead className="h-auto p-3 text-white font-black border-r border-sky-400/50 text-center uppercase text-[10px]">Date</TableHead>
                        <TableHead className="h-auto p-3 text-white font-black border-r border-sky-400/50 text-center uppercase text-[10px]">Patti No</TableHead>
                        <TableHead className="h-auto p-3 text-white font-black border-r border-sky-400/50 text-left uppercase text-[10px]">Customer Name</TableHead>
                        <TableHead className="h-auto p-3 text-white font-black border-r border-sky-400/50 text-center uppercase text-[10px]">Commodity</TableHead>
                        <TableHead className="h-auto p-3 text-white font-black border-r border-sky-400/50 text-center uppercase text-[10px]">Lot No</TableHead>
                        <TableHead className="h-auto p-3 text-white font-black border-r border-sky-400/50 text-center uppercase text-[10px]">Bags Out</TableHead>
                        <TableHead className="h-auto p-3 text-white font-black border-r border-sky-400/50 text-right uppercase text-[10px]">Rent Billed</TableHead>
                        <TableHead className="h-auto p-3 text-white font-black text-center uppercase text-[10px] print-hide">Actions</TableHead>
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
                        <TableRow key={index} className="hover:bg-slate-50 h-8 border-b border-slate-100">
                            <TableCell className="p-2 text-center font-bold text-slate-500 whitespace-nowrap">{format(toDate(event.date), 'dd/MM/yyyy')}</TableCell>
                            <TableCell className="p-2 text-center font-mono font-black text-slate-400">{deliveryOrderNo}</TableCell>
                            <TableCell className="p-2 text-left font-black text-slate-800 uppercase tracking-tighter">{getCustomerName(event.customerId)}</TableCell>
                            <TableCell className="p-2 text-center font-bold text-slate-600">{event.commodityDescription}</TableCell>
                            <TableCell className="p-2 text-center font-mono font-black text-slate-500">{event.location}</TableCell>
                            <TableCell className="p-2 text-center font-mono font-black text-orange-600 text-[14px]">{event.bagsWithdrawn}</TableCell>
                            <TableCell className="p-2 text-right font-mono font-bold text-slate-700">{formatCurrency(event.rentBilled)}</TableCell>
                            <TableCell className="p-2 text-center print-hide">
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
                    <TableRow className="border-t-2 border-primary bg-slate-50 font-black">
                        <TableCell colSpan={5} className="p-4 text-right text-slate-700 uppercase tracking-tighter text-[11px]">Total Portfolio Outflow</TableCell>
                        <TableCell className="p-4 text-center font-mono text-lg text-orange-600">{totalBagsWithdrawn}</TableCell>
                        <TableCell className="p-4 text-right font-mono text-base text-slate-900">{formatCurrency(totalRentBilled)}</TableCell>
                        <TableCell className="p-4 print-hide"></TableCell>
                    </TableRow>
                </TableFooter>
            </Table>

            <div className="mt-16 pt-8 flex flex-col items-end text-center space-y-1">
                <div className="w-80 border-t border-slate-400 pt-4">
                    <p className="text-[#1e293b] font-black text-[12px] uppercase tracking-wider">Authorized Manager Signature</p>
                    <p className="text-[#3498db] font-bold text-[11px] uppercase mt-1">SRI LAKSHMI WAREHOUSE</p>
                </div>
            </div>
        </div>
    );
}
