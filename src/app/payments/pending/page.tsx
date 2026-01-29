
'use client';
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/shared/page-header";
import type { Customer, StorageRecord } from "@/lib/definitions";
import { useCollection } from "@/firebase/firestore/use-collection";
import { collection } from "firebase/firestore";
import { useFirestore } from "@/firebase";
import { useMemoFirebase } from "@/hooks/use-memo-firebase";
import { PendingPaymentsTable } from "@/components/payments/pending-payments-table";


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

    if (loadingRecords || loadingCustomers) {
        return <AppLayout><div>Loading...</div></AppLayout>;
    }

    return (
        <AppLayout>
            <PageHeader
                title="Pending Payments"
                description="View all records with an outstanding balance."
            />
            <PendingPaymentsTable records={allRecords || []} customers={allCustomers || []} />
        </AppLayout>
    );
}
