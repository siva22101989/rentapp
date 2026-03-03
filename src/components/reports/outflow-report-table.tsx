
'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { format } from "date-fns";
import type { Customer, StorageRecord, Outflow, WarehouseInfo } from "@/lib/definitions";
import { toDate, formatCurrency } from '@/lib/utils';
import { useMemo, useState } from "react";
import { Button } from "../ui/button";
import { Download } from "lucide-react";
import { OutflowReceiptDialog } from "./outflow-receipt-dialog";
import { useDoc } from "@/firebase/firestore/use-doc";
import { useFirestore } from "@/firebase/provider";
import { useMemoFirebase } from "@/hooks/use-memo-firebase";
import { doc } from "firebase/firestore";


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
}

export function OutflowReportTable({ events, customers, title, allRecords }: ReportTableProps) {
    const generatedDate = useMemo(() => format(new Date(), 'dd MMM yyyy, hh:mm a'), []);
    const firestore = useFirestore();

    const warehouseInfoRef = useMemoFirebase(
        () => (firestore ? doc(firestore, 'settings', 'main') : null),
        [firestore]
    );
    const { data: warehouseInfo } = useDoc<WarehouseInfo>(warehouseInfoRef);


    const getCustomerName = (customerId: string) => {
        return customers.find(c => c.id === customerId)?.name ?? 'Unknown';
    }

    const totalBagsWithdrawn = events.reduce((acc, event) => acc + (event.bagsWithdrawn || 0), 0);
    const totalRentBilled = events.reduce((acc, event) => acc + (event.rentBilled || 0), 0);

    return (
        <div className="bg-white p-4 rounded-lg">
             <div className="mb-4">
                <h2 className="text-xl font-bold">Srilakshmi Warehouse</h2>
                <p className="text-muted-foreground">{title}</p>
                <p className="text-xs text-muted-foreground">Generated on: {generatedDate}</p>
            </div>
            <Table className="text-xs">
                <TableHeader>
                    <TableRow>
                        <TableHead className="h-auto py-2 px-2">Date</TableHead>
                        <TableHead className="h-auto py-2 px-2">Serial No</TableHead>
                        <TableHead className="h-auto py-2 px-2">Customer</TableHead>
                        <TableHead className="h-auto py-2 px-2">Commodity</TableHead>
                        <TableHead className="h-auto py-2 px-2">Lot No</TableHead>
                        <TableHead className="h-auto py-2 px-2 text-right">Bags Withdrawn</TableHead>
                        <TableHead className="h-auto py-2 px-2 text-right">Rent Billed</TableHead>
                        <TableHead className="h-auto py-2 px-2 w-[50px] text-right print-hide">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {events.map((event, index) => {
                        const fullRecord = allRecords.find(r => r.id === event.recordId);
                        const customer = customers.find(c => c.id === event.customerId);
                        
                        let deliveryOrderNo = event.recordId;
                        if (fullRecord && fullRecord.outflows) {
                            const outflowIndex = fullRecord.outflows.findIndex(o => 
                                toDate(o.date).getTime() === event.date.getTime() &&
                                o.bagsWithdrawn === event.bagsWithdrawn &&
                                o.rentBilled === event.rentBilled
                            );
                            if (outflowIndex !== -1) {
                                deliveryOrderNo = `${event.recordId}-${outflowIndex + 1}`;
                            }
                        }

                        return (
                        <TableRow key={index}>
                            <TableCell className="p-2">{format(toDate(event.date), 'dd MMM yyyy')}</TableCell>
                            <TableCell className="p-2">{deliveryOrderNo}</TableCell>
                            <TableCell className="p-2 font-medium">{getCustomerName(event.customerId)}</TableCell>
                            <TableCell className="p-2">{event.commodityDescription}</TableCell>
                            <TableCell className="p-2">{event.location}</TableCell>
                            <TableCell className="p-2 text-right font-mono">{event.bagsWithdrawn}</TableCell>
                            <TableCell className="p-2 text-right font-mono">{formatCurrency(event.rentBilled)}</TableCell>
                            <TableCell className="p-2 print-hide text-right">
                                {fullRecord && customer && (
                                    <OutflowReceiptDialog
                                        record={fullRecord}
                                        customer={customer}
                                        warehouseInfo={warehouseInfo}
                                        outflow={event}
                                        deliveryOrderNo={deliveryOrderNo}
                                        deliveryOrderDate={event.date}
                                    >
                                        <Button variant="ghost" size="icon">
                                            <Download className="h-4 w-4" />
                                        </Button>
                                    </OutflowReceiptDialog>
                                )}
                            </TableCell>
                        </TableRow>
                    )})}
                    {events.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={8} className="p-2 text-center text-muted-foreground">
                                No outflow records found for the selected criteria.
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
                <TableFooter>
                    <TableRow>
                        <TableCell colSpan={5} className="p-2 text-right font-bold">Totals</TableCell>
                        <TableCell className="p-2 text-right font-mono font-bold">{totalBagsWithdrawn}</TableCell>
                        <TableCell className="p-2 text-right font-mono font-bold">{formatCurrency(totalRentBilled)}</TableCell>
                        <TableCell className="p-2 print-hide"></TableCell>
                    </TableRow>
                </TableFooter>
            </Table>
        </div>
    );
}
