
'use client';
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useMemo } from "react";
import type { Customer, StorageRecord } from "@/lib/definitions";
import { Badge } from "@/components/ui/badge";
import { AddPaymentDialog } from "@/components/payments/add-payment-dialog";
import { formatCurrency } from "@/lib/utils";
import { useCollection } from "@/firebase/firestore/use-collection";
import { collection } from "firebase/firestore";
import { useFirestore } from "@/firebase";
import { useMemoFirebase } from "@/hooks/use-memo-firebase";

function PendingPaymentsTable() {
    const firestore = useFirestore();

    const recordsQuery = useMemoFirebase(
      () => (firestore ? collection(firestore, 'storageRecords') : null),
      [firestore]
    );
    const { data: allRecords, loading: loadingRecords } = useCollection<StorageRecord>(recordsQuery);

    const customersQuery = useMemoFirebase(
        () => (firestore ? collection(firestore, 'customers') : null),
        [firestore]
    );
    const { data: allCustomers, loading: loadingCustomers } = useCollection<Customer>(customersQuery);

    const pendingRecords = useMemo(() => {
        if (!allRecords) return [];
        return allRecords.map(record => {
            const hamaliPayable = record.hamaliPayable || 0;
            const totalRentBilled = record.totalRentBilled || 0;

            const hamaliPaid = (record.payments || [])
                .filter(p => p.type === 'hamali')
                .reduce((acc, p) => acc + p.amount, 0);

            const rentPaid = (record.payments || [])
                .filter(p => p.type === 'rent')
                .reduce((acc, p) => acc + p.amount, 0);
            
            // Treat 'other' or untyped payments as rent payments for balance calculation
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
    }, [allRecords]);
    
    const getCustomerName = (customerId: string) => {
        return allCustomers?.find(c => c.id === customerId)?.name ?? 'Unknown';
    }

    if (loadingRecords || loadingCustomers) {
        return <div>Loading...</div>;
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
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Total Billed</TableHead>
                            <TableHead className="text-right">Hamali Pending</TableHead>
                            <TableHead className="text-right">Rent Pending</TableHead>
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
                                <TableCell>
                                    <Badge variant={record.storageEndDate ? "secondary" : "default"} className={record.storageEndDate ? 'bg-green-100 text-green-800' : ''}>
                                        {record.storageEndDate ? 'Completed' : 'Active'}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-right font-mono">{formatCurrency(record.totalBilled)}</TableCell>
                                <TableCell className="text-right font-mono text-orange-600">{formatCurrency(record.hamaliPending)}</TableCell>
                                <TableCell className="text-right font-mono text-blue-600">{formatCurrency(record.rentPending)}</TableCell>
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


export default function PendingPaymentsPage() {
    return (
        <AppLayout>
            <PageHeader
                title="Pending Payments"
                description="View all records with an outstanding balance."
            />
            <PendingPaymentsTable />
        </AppLayout>
    );
}
