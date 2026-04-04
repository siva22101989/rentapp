
'use client';
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/shared/page-header";
import { OutflowForm } from "@/components/outflow/outflow-form";
import type { Customer, StorageRecord } from "@/lib/definitions";
import { useCollection } from "@/firebase/firestore/use-collection";
import { collection, query, where } from "firebase/firestore";
import { useFirestore } from "@/firebase/provider";
import { useMemoFirebase } from "@/hooks/use-memo-firebase";
import { useAppUser } from "@/firebase/auth/use-user";

export default function OutflowPage() {
  const firestore = useFirestore();
  const appUser = useAppUser();

  const customersQuery = useMemoFirebase(
    () => (firestore && appUser ? collection(firestore, 'customers') : null),
    [firestore, appUser]
  );
  const { data: customers, loading: loadingCustomers } = useCollection<Customer>(customersQuery);

  const activeRecordsQuery = useMemoFirebase(
    () => (firestore && appUser ? query(collection(firestore, 'storageRecords'), where('storageEndDate', '==', null)) : null),
    [firestore, appUser]
  );
  const { data: activeRecords, loading: loadingRecords } = useCollection<StorageRecord>(activeRecordsQuery);

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
