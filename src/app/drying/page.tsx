
'use client';
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/shared/page-header";
import { useCollection } from "@/firebase/firestore/use-collection";
import { collection, query, where } from "firebase/firestore";
import { useFirestore } from "@/firebase";
import { useMemoFirebase } from "@/hooks/use-memo-firebase";
import type { Customer, UnloadingRecord } from "@/lib/definitions";
import { AddCustomerDialog } from "@/components/customers/add-customer-dialog";
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

  const unloadingRecordsQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'unloadingRecords'), where('status', '==', 'Unloading')) : null),
    [firestore]
  );
  const { data: unloadingRecords, loading: loadingUnloadingRecords } = useCollection<UnloadingRecord>(unloadingRecordsQuery);

  if (loadingCustomers || loadingUnloadingRecords) {
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

      <div className="flex justify-center">
        <div className="w-full max-w-lg">
            <InitiateDryingForm 
                customers={customers || []} 
                unloadingRecords={unloadingRecords || []}
                onCustomerChange={setSelectedCustomerId}
            />
        </div>
      </div>
    </AppLayout>
  );
}
