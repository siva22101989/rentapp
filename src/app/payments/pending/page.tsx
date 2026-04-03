
'use client';
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/shared/page-header";
<<<<<<< HEAD
import type { Customer, StorageRecord, UnloadingRecord } from "@/lib/definitions";
import { useCollection } from "@/firebase/firestore/use-collection";
import { collection } from "firebase/firestore";
import { useFirestore } from "@/firebase/provider";
import { useMemoFirebase } from "@/hooks/use-memo-firebase";
import { PendingPaymentsTable } from "@/components/payments/pending-payments-table";
import { CustomerBulkPaymentDialog } from "@/components/payments/customer-bulk-payment-dialog";
=======
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useMemo } from "react";
import type { Customer, StorageRecord } from "@/lib/definitions";
import { Badge } from "@/components/ui/badge";
import { AddPaymentDialog } from "@/components/payments/add-payment-dialog";
import { formatCurrency } from "@/lib/utils";
import { useCollection } from "@/firebase/firestore/use-collection";
import { collection, query, where } from "firebase/firestore";
import { useFirestore } from "@/firebase";

function PendingPaymentsTable() {
    const firestore = useFirestore();
    const { data: allRecords, loading: recordsLoading } = useCollection<StorageRecord>(
      firestore ? collection(firestore, 'storageRecords') : null
    );
    const { data: allCustomers, loading: customersLoading } = useCollection<Customer>(
      firestore ? collection(firestore, 'customers') : null
    );

    const loading = recordsLoading || customersLoading;

    const pendingRecords = useMemo(() => {
        if (!allRecords) return [];
        return allRecords.map(record => {
            const totalBilled = (record.hamaliPayable || 0) + (record.totalRentBilled || 0);
            const amountPaid = (record.payments || []).reduce((acc, p) => acc + p.amount, 0);
            const balanceDue = totalBilled - amountPaid;
            return { ...record, totalBilled, amountPaid, balanceDue };
        }).filter(record => record.balanceDue > 0);
    }, [allRecords]);
    
    const getCustomerName = (customerId: string) => {
        if (!allCustomers) return 'Unknown';
        return allCustomers.find(c => c.id === customerId)?.name ?? 'Unknown';
    }

    if (loading) {
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
                            <TableHead className="text-right">Amount Paid</TableHead>
                            <TableHead className="text-right">Balance Due</TableHead>
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
                                <TableCell className="text-right font-mono">{formatCurrency(record.amountPaid)}</TableCell>
                                <TableCell className="text-right font-mono text-destructive">{formatCurrency(record.balanceDue)}</TableCell>
                                <TableCell className="text-right">
                                    <AddPaymentDialog record={record} />
                                </TableCell>
                            </TableRow>
                        )})}
                    </TableBody>
                 </Table>
            </CardContent>
        </Card>
  );
}
>>>>>>> 493f64cf071699c798704dd512006dc35618f02c


export default function PendingPaymentsPage() {
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
    
    const unloadingRecordsQuery = useMemoFirebase(
        () => (firestore ? collection(firestore, 'unloadingRecords') : null),
        [firestore]
    );
    const { data: allUnloadingRecords, loading: loadingUnloadingRecords } = useCollection<UnloadingRecord>(unloadingRecordsQuery);


    if (loadingRecords || loadingCustomers || loadingUnloadingRecords) {
        return <AppLayout><div>Loading...</div></AppLayout>;
    }

    return (
        <AppLayout>
            <PageHeader
                title="Pending Payments"
                description="View all records with an outstanding balance."
            >
                <CustomerBulkPaymentDialog
                    customers={allCustomers || []}
                    storageRecords={allRecords || []}
                    unloadingRecords={allUnloadingRecords || []}
                />
            </PageHeader>
            <PendingPaymentsTable 
                records={allRecords || []} 
                customers={allCustomers || []} 
                unloadingRecords={allUnloadingRecords || []}
            />
        </AppLayout>
    );
}
