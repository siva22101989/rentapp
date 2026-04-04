
'use client';
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/shared/page-header";
import type { Customer, StorageRecord, UnloadingRecord } from "@/lib/definitions";
import { useCollection } from "@/firebase/firestore/use-collection";
import { collection } from "firebase/firestore";
import { useFirestore } from "@/firebase/provider";
import { useMemoFirebase } from "@/hooks/use-memo-firebase";
import { PendingPaymentsTable } from "@/components/payments/pending-payments-table";
import { CustomerBulkPaymentDialog } from "@/components/payments/customer-bulk-payment-dialog";
import { useAppUser } from "@/firebase/auth/use-user";

export default function PendingPaymentsPage() {
    const firestore = useFirestore();
    const appUser = useAppUser();

    const recordsQuery = useMemoFirebase(
      () => (firestore && appUser?.warehouseId ? collection(firestore, 'managedWarehouses', appUser.warehouseId, 'storageRecords') : null),
      [firestore, appUser]
    );
    const { data: allRecords, loading: loadingRecords } = useCollection<StorageRecord>(recordsQuery);

    const customersQuery = useMemoFirebase(
        () => (firestore && appUser?.warehouseId ? collection(firestore, 'managedWarehouses', appUser.warehouseId, 'customers') : null),
        [firestore, appUser]
    );
    const { data: allCustomers, loading: loadingCustomers } = useCollection<Customer>(customersQuery);
    
    const unloadingRecordsQuery = useMemoFirebase(
        () => (firestore && appUser?.warehouseId ? collection(firestore, 'managedWarehouses', appUser.warehouseId, 'unloadingRecords') : null),
        [firestore, appUser]
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
