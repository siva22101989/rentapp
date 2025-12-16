
'use client';
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/shared/page-header";
import { ReportClient } from "@/components/reports/report-client";
import type { Customer, StorageRecord } from "@/lib/definitions";
import { useCollection } from "@/firebase/firestore/use-collection";
import { collection } from "firebase/firestore";
import { useFirestore } from "@/firebase";
import { useMemoFirebase } from "@/hooks/use-memo-firebase";

export default function ReportsPage() {
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
        title="All Transactions Report"
        description="A complete log of all storage records, filterable by customer."
      />
      <ReportClient records={allRecords || []} customers={allCustomers || []} />
    </AppLayout>
  );
}
