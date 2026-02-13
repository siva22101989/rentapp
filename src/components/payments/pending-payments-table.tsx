
'use client';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMemo } from "react";
import type { Customer, StorageRecord } from "@/lib/definitions";
import { Badge } from "@/components/ui/badge";
import { AddPaymentDialog } from "@/components/payments/add-payment-dialog";
import { formatCurrency } from "@/lib/utils";

export function PendingPaymentsTable({ records, customers }: { records: StorageRecord[], customers: Customer[] }) {

    const pendingRecords = useMemo(() => {
        if (!records) return [];
        return records.map(record => {
            const hamaliPayable = record.hamaliPayable || 0;
            const totalRentBilled = record.totalRentBilled || 0;

            const hamaliPaid = (record.payments || [])
                .filter(p => p.type === 'hamali')
                .reduce((acc, p) => acc + p.amount, 0);

            const rentPaid = (record.payments || [])
                .filter(p => p.type === 'rent')
                .reduce((acc, p) => acc + p.amount, 0);
            
            const otherPaid = (record.payments || [])
                .filter(p => p.type === 'other' || !p.type)
                .reduce((acc, p) => acc + p.amount, 0);

            const hamaliPending = hamaliPayable - hamaliPaid;
            const rentPending = totalRentBilled - rentPaid - otherPaid;
            
            const totalBilled = hamaliPayable + totalRentBilled;
            const amountPaid = hamaliPaid + rentPaid + otherPaid;
            const balanceDue = totalBilled - amountPaid;

            return { 
                ...record, 
                totalBilled, 
                amountPaid, 
                balanceDue,
                hamaliPending: Math.max(0, hamaliPending),
                rentPending: Math.max(0, rentPending)
            };
        }).filter(record => record.balanceDue > 0.5); // Use a small buffer for floating point issues
    }, [records]);
    
    const getCustomerName = (customerId: string) => {
        return customers?.find(c => c.id === customerId)?.name ?? 'Unknown';
    }

  return (
        <Card>
            <CardHeader>
                <CardTitle>Outstanding Balances</CardTitle>
            </CardHeader>
            <CardContent>
                 <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Record ID</TableHead>
                            <TableHead>Customer</TableHead>
                            <TableHead className="hidden sm:table-cell">Status</TableHead>
                            <TableHead className="text-right hidden lg:table-cell">Total Billed</TableHead>
                            <TableHead className="text-right hidden md:table-cell">Hamali Pending</TableHead>
                            <TableHead className="text-right hidden md:table-cell">Rent Pending</TableHead>
                            <TableHead className="text-right">Total Due</TableHead>
                            <TableHead className="w-[100px] text-right"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {pendingRecords.map((record) => {
                            const customerName = getCustomerName(record.customerId);
                            return (
                            <TableRow key={record.id}>
                                <TableCell className="font-medium">{record.id}</TableCell>
                                <TableCell>{customerName}</TableCell>
                                <TableCell className="hidden sm:table-cell">
                                    <Badge variant={record.storageEndDate ? "secondary" : "default"} className={record.storageEndDate ? 'bg-zinc-100 text-zinc-800' : 'bg-green-100 text-green-800'}>
                                        {record.storageEndDate ? 'Completed' : 'Active'}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-right font-mono hidden lg:table-cell">{formatCurrency(record.totalBilled)}</TableCell>
                                <TableCell className="text-right font-mono text-orange-600 hidden md:table-cell">{formatCurrency(record.hamaliPending)}</TableCell>
                                <TableCell className="text-right font-mono text-blue-600 hidden md:table-cell">{formatCurrency(record.rentPending)}</TableCell>
                                <TableCell className="text-right font-mono text-destructive">{formatCurrency(record.balanceDue)}</TableCell>
                                <TableCell className="text-right">
                                    <AddPaymentDialog record={record} />
                                </TableCell>
                            </TableRow>
                        )})}
                         {pendingRecords.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={8} className="text-center text-muted-foreground">
                                    No outstanding balances found.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                 </Table>
            </CardContent>
        </Card>
  );
}
