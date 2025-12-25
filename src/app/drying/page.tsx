
'use client';
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/shared/page-header";
import { useCollection } from "@/firebase/firestore/use-collection";
import { collection, query, where, or } from "firebase/firestore";
import { useFirestore } from "@/firebase";
import { useMemoFirebase } from "@/hooks/use-memo-firebase";
import type { Customer, DryingRecord, UnloadingRecord } from "@/lib/definitions";
import { AddCustomerDialog } from "@/components/customers/add-customer-dialog";
import { DryingRecordsTable } from "@/components/drying/drying-records-table";
import { InitiateDryingForm } from "@/components/drying/initiate-drying-form";
import { useMemo } from "react";

export default function DryingPage() {
  const firestore = useFirestore();

  const customersQuery = useMemoFirebase(
    () => (firestore ? collection(firestore, 'customers') : null),
    [firestore]
  );
  const { data: customers, loading: loadingCustomers } = useCollection<Customer>(customersQuery);

  const activeDryingRecordsQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'dryingRecords'), or(where('status', '==', 'Drying'), where('status', '==', 'Packing'))) : null),
    [firestore]
  );
  const { data: activeDryingRecords, loading: loadingDryingRecords } = useCollection<DryingRecord>(activeDryingRecordsQuery);
  
  const unloadingRecordsQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'unloadingRecords'), where('status', '==', 'Unloading')) : null),
    [firestore]
  );
  const { data: unloadingRecords, loading: loadingUnloadingRecords } = useCollection<UnloadingRecord>(unloadingRecordsQuery);


  if (loadingCustomers || loadingDryingRecords || loadingUnloadingRecords) {
    return <AppLayout><div>Loading...</div></AppLayout>;
  }

  return (
    <AppLayout>
      <PageHeader
        title="Drying Process"
        description="Initiate and manage the process of drying goods."
      >
        <AddCustomerDialog />
      </PageHeader>

      <div className="grid gap-8 md:grid-cols-3">
        <div className="md:col-span-1">
          <InitiateDryingForm 
            customers={customers || []} 
            unloadingRecords={unloadingRecords || []}
          />
        </div>
        <div className="md:col-span-2">
            <DryingRecordsTable dryingRecords={activeDryingRecords || []} customers={customers || []} />
        </div>
      </div>
    </AppLayout>
  );
}
