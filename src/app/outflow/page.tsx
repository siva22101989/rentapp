'use client';
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/shared/page-header";
import { OutflowForm } from "@/components/outflow/outflow-form";
import type { Customer, StorageRecord } from "@/lib/definitions";
import { useCollection } from "@/firebase/firestore/use-collection";
import { collection, query, where } from "firebase/firestore";
import { useFirestore } from "@/firebase";

export default function OutflowPage() {
  const firestore = useFirestore();
  
  const { data: customers, loading: customersLoading } = useCollection<Customer>(
    firestore ? collection(firestore, 'customers') : null
  );

  const activeRecordsQuery = firestore 
    ? query(collection(firestore, 'storageRecords'), where('storageEndDate', '==', null)) 
    : null;
    
  const { data: activeRecords, loading: recordsLoading } = useCollection<StorageRecord>(activeRecordsQuery);

  const loading = customersLoading || recordsLoading;

  if (loading) {
    return <AppLayout><div>Loading...</div></AppLayout>;
  }

  return (
    <AppLayout>
      <PageHeader
        title="Process Outflow"
        description="Select a record to process for withdrawal and generate a final bill."
      />
      <OutflowForm records={activeRecords || []} customers={customers || []} />
    </AppLayout>
  );
}
