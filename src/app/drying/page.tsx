
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
import { useState } from "react";

export default function DryingPage() {
  const firestore = useFirestore();
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

  const customersQuery = useMemoFirebase(
    () => (firestore ? collection(firestore, 'customers') : null),
    [firestore]
  );
  const { data: customers, loading: loadingCustomers } = useCollection<Customer>(customersQuery);

  const activeDryingRecordsQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'dryingRecords'), or(where('status', '==', 'Drying'), where('status', '==', 'Packing'))) : null),
    [firestore]
  );
  const { data: allActiveDryingRecords, loading: loadingDryingRecords } = useCollection<DryingRecord>(activeDryingRecordsQuery);
  
  const unloadingRecordsQuery = useMemoFirebase(
    () => (firestore ? collection(firestore, 'unloadingRecords') : null),
    [firestore]
  );
  const { data: unloadingRecords, loading: loadingUnloadingRecords } = useCollection<UnloadingRecord>(unloadingRecordsQuery);

  const filteredDryingRecords = selectedCustomerId
    ? allActiveDryingRecords?.filter(record => record.customerId === selectedCustomerId)
    : allActiveDryingRecords;

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
            unloadingRecords={unloadingRecords?.filter(ur => ur.status === 'Unloading') || []}
            onCustomerChange={setSelectedCustomerId}
          />
        </div>
        <div className="md:col-span-2">
            <DryingRecordsTable 
              dryingRecords={filteredDryingRecords || []} 
              customers={customers || []}
              unloadingRecords={unloadingRecords || []}
            />
        </div>
      </div>
    </AppLayout>
  );
}
