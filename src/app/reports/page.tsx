'use client';
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/shared/page-header";
import { ReportClient } from "@/components/reports/report-client";
import type { Customer, StorageRecord } from "@/lib/definitions";
import { useCollection } from "@/firebase/firestore/use-collection";
import { collection } from "firebase/firestore";
import { useFirestore } from "@/firebase";

export default function ReportsPage() {
    const firestore = useFirestore();
    const { data: allRecords, loading: recordsLoading } = useCollection<StorageRecord>(
      firestore ? collection(firestore, 'storageRecords') : null
    );
    const { data: allCustomers, loading: customersLoading } = useCollection<Customer>(
      firestore ? collection(firestore, 'customers') : null
    );
    
    const loading = recordsLoading || customersLoading;

    if (loading) {
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
