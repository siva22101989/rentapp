'use client';
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/shared/page-header";
import { useCollection } from "@/firebase/firestore/use-collection";
import { collection, query, orderBy } from "firebase/firestore";
import { useFirestore } from "@/firebase";
import { useMemoFirebase } from "@/hooks/use-memo-firebase";
import type { Customer, UnloadingRecord, DryingRecord, Lot, StorageRecord } from "@/lib/definitions";
import { AddCustomerDialog } from "@/components/customers/add-customer-dialog";
import { InitiateDryingForm } from "@/components/drying/initiate-drying-form";
import { useState, useMemo } from "react";
import { DryingHistoryTable } from "@/components/drying/drying-history-table";
import { Separator } from "@/components/ui/separator";

export default function DryingPage() {
  const firestore = useFirestore();
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

  const customersQuery = useMemoFirebase(
    () => (firestore ? collection(firestore, 'customers') : null),
    [firestore]
  );
  const { data: customers, loading: loadingCustomers } = useCollection<Customer>(customersQuery);

  const unloadingRecordsQuery = useMemoFirebase(
    () => (firestore ? collection(firestore, 'unloadingRecords') : null),
    [firestore]
  );
  const { data: unloadingRecords, loading: loadingUnloadingRecords } = useCollection<UnloadingRecord>(unloadingRecordsQuery);
  
  const dryingRecordsQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'dryingRecords'), orderBy('dryingStartDate', 'desc')) : null),
    [firestore]
  );
  const { data: dryingRecords, loading: loadingDryingRecords } = useCollection<DryingRecord>(dryingRecordsQuery);
  
  const lotsQuery = useMemoFirebase(
    () => (firestore ? collection(firestore, 'lots') : null),
    [firestore]
  );
  const { data: lots, loading: loadingLots } = useCollection<Lot>(lotsQuery);

  const storageRecordsQuery = useMemoFirebase(
    () => (firestore ? collection(firestore, 'storageRecords') : null),
    [firestore]
  );
  const { data: storageRecords, loading: loadingStorageRecords } = useCollection<StorageRecord>(storageRecordsQuery);


  const availableForDryingRecords = useMemo(() => {
    if (!unloadingRecords) return [];
    return unloadingRecords.filter(r => r.bagsUnloaded > (r.bagsSentToDrying || 0));
  }, [unloadingRecords]);
  
  const activeDryingRecords = useMemo(() => {
      if (!dryingRecords) return [];
      return dryingRecords.filter(r => r.status !== 'Billed');
  }, [dryingRecords]);


  if (loadingCustomers || loadingUnloadingRecords || loadingDryingRecords || loadingLots || loadingStorageRecords) {
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

      <div className="space-y-8">
        <div className="flex justify-center">
            <div className="w-full max-w-lg">
                <InitiateDryingForm 
                    customers={customers || []} 
                    unloadingRecords={availableForDryingRecords || []}
                    onCustomerChange={setSelectedCustomerId}
                />
            </div>
        </div>

        <Separator />

        <DryingHistoryTable 
            dryingRecords={activeDryingRecords || []}
            customers={customers || []}
            unloadingRecords={unloadingRecords || []}
            lots={lots || []}
            storageRecords={storageRecords || []}
        />
      </div>
    </AppLayout>
  );
}
