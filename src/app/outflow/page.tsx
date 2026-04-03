
'use client';
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/shared/page-header";
import { OutflowForm } from "@/components/outflow/outflow-form";
import type { Customer, StorageRecord } from "@/lib/definitions";
import { useCollection } from "@/firebase/firestore/use-collection";
import { collection, query, where } from "firebase/firestore";
<<<<<<< HEAD
import { useFirestore } from "@/firebase/provider";
import { useMemoFirebase } from "@/hooks/use-memo-firebase";

export default function OutflowPage() {
  const firestore = useFirestore();

  const customersQuery = useMemoFirebase(
    () => (firestore ? collection(firestore, 'customers') : null),
    [firestore]
  );
  const { data: customers, loading: loadingCustomers } = useCollection<Customer>(customersQuery);

  const activeRecordsQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'storageRecords'), where('storageEndDate', '==', null)) : null),
    [firestore]
  );
  const { data: activeRecords, loading: loadingRecords } = useCollection<StorageRecord>(activeRecordsQuery);
=======
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
>>>>>>> 493f64cf071699c798704dd512006dc35618f02c

  if (loadingCustomers || loadingRecords) {
    return <AppLayout><div>Loading...</div></AppLayout>;
  }

  return (
    <AppLayout>
      <PageHeader
        title="Process Outflow"
        description="Select one or more records to process for full withdrawal."
      />
      <OutflowForm records={activeRecords || []} customers={customers || []} />
    </AppLayout>
  );
}
