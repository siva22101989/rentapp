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
        <div className="bg-white p-4 rounded-lg">
             <div className="mb-4 text-center">
                <h2 className="text-xl font-bold uppercase tracking-wide">SRI LAKSHMI WAREHOUSE</h2>
                <p className="text-muted-foreground font-semibold uppercase">{title}</p>
                <p className="text-xs text-muted-foreground">Generated on: {generatedDate}</p>
            </div>
            <Table className="text-xs border">
                <TableHeader>
                    <TableRow className="bg-[#3498db] hover:bg-[#3498db]">
                        <TableHead className="py-2 px-2 text-white text-center font-bold border">Date</TableHead>
                        <TableHead className="py-2 px-2 text-white text-center font-bold border">Bill No</TableHead>
                        <TableHead className="py-2 px-2 text-white text-center font-bold border">Customer</TableHead>
                        <TableHead className="py-2 px-2 text-white text-center font-bold border">Commodity</TableHead>
                        <TableHead className="py-2 px-2 text-white text-center font-bold border">Lot No</TableHead>
                        <TableHead className="py-2 px-2 text-white text-center font-bold border">Bags Out</TableHead>
                        <TableHead className="py-2 px-2 text-white text-center font-bold border">Rent Billed</TableHead>
                        <TableHead className="py-2 px-2 w-[50px] text-white text-center font-bold border print-hide">Actions</TableHead>
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
                        <TableRow key={index}>
                            <TableCell className="p-2 text-center border">{format(toDate(event.date), 'dd/MM/yyyy')}</TableCell>
                            <TableCell className="p-2 text-center border font-mono">{deliveryOrderNo}</TableCell>
                            <TableCell className="p-2 text-center border font-medium">{getCustomerName(event.customerId)}</TableCell>
                            <TableCell className="p-2 text-center border">{event.commodityDescription}</TableCell>
                            <TableCell className="p-2 text-center border">{event.location}</TableCell>
                            <TableCell className="p-2 text-center border font-mono">{event.bagsWithdrawn}</TableCell>
                            <TableCell className="p-2 text-center border font-mono">{formatCurrency(event.rentBilled)}</TableCell>
                            <TableCell className="p-2 text-center border print-hide">
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
                    <TableRow className="bg-slate-50">
                        <TableCell colSpan={5} className="p-2 text-right font-bold border">Totals</TableCell>
                        <TableCell className="p-2 text-center font-mono font-bold border">{totalBagsWithdrawn}</TableCell>
                        <TableCell className="p-2 text-center font-mono font-bold border">{formatCurrency(totalRentBilled)}</TableCell>
                        <TableCell className="p-2 border print-hide"></TableCell>
                    </TableRow>
                </TableFooter>
            </Table>

            <div className="mt-16 pt-8 flex flex-col items-end text-center space-y-1">
                <div className="w-72 border-t border-slate-400 pt-4">
                    <p className="text-[#1e293b] font-bold text-sm uppercase tracking-wider">AUTHORIZED MANAGER SIGNATURE</p>
                    <p className="text-[#3498db] font-bold text-xs uppercase mt-1">SRI LAKSHMI WAREHOUSE</p>
                </div>
                <div className="text-[10px] text-slate-500 italic mt-4">
                    <p>Report validity verified on {generatedDate}</p>
                    <p>This is a computer generated statement.</p>
                </div>
            </div>
        </div>
    );
}
