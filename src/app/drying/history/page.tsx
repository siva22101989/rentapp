
'use client';
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/shared/page-header";
import { useCollection } from "@/firebase/firestore/use-collection";
import { collection, query, orderBy } from "firebase/firestore";
import { useFirestore } from "@/firebase";
import { useMemoFirebase } from "@/hooks/use-memo-firebase";
import type { Customer, DryingRecord, UnloadingRecord, Lot } from "@/lib/definitions";
import { DryingHistoryTable } from "@/components/drying/drying-history-table";

export default function DryingHistoryPage() {
  const firestore = useFirestore();

  const customersQuery = useMemoFirebase(
    () => (firestore ? collection(firestore, 'customers') : null),
    [firestore]
  );
  const { data: customers, loading: loadingCustomers } = useCollection<Customer>(customersQuery);

  const dryingRecordsQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'dryingRecords'), orderBy('dryingStartDate', 'desc')) : null),
    [firestore]
  );
  const { data: dryingRecords, loading: loadingDryingRecords } = useCollection<DryingRecord>(dryingRecordsQuery);

  const unloadingRecordsQuery = useMemoFirebase(
    () => (firestore ? collection(firestore, 'unloadingRecords') : null),
    [firestore]
  );
  const { data: unloadingRecords, loading: loadingUnloadingRecords } = useCollection<UnloadingRecord>(unloadingRecordsQuery);

  const lotsQuery = useMemoFirebase(
    () => (firestore ? collection(firestore, 'lots') : null),
    [firestore]
  );
  const { data: lots, loading: loadingLots } = useCollection<Lot>(lotsQuery);

  if (loadingCustomers || loadingDryingRecords || loadingUnloadingRecords || loadingLots) {
    return <AppLayout><div>Loading...</div></AppLayout>;
  }

  return (
    <AppLayout>
      <PageHeader
        title="Drying Process History"
        description="A complete log of all drying and packing activities."
      />
      <DryingHistoryTable 
        dryingRecords={dryingRecords || []}
        customers={customers || []}
        unloadingRecords={unloadingRecords || []}
        lots={lots || []}
      />
    </AppLayout>
  );
}
