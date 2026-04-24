
'use client';
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/shared/page-header";
import { useCollection } from "@/firebase/firestore/use-collection";
import { collection } from "firebase/firestore";
import { useFirestore } from "@/firebase/provider";
import { useMemoFirebase } from "@/hooks/use-memo-firebase";
import type { Customer, UnloadingRecord, Lot, StorageRecord, Commodity } from "@/lib/definitions";
import { AddCustomerDialog } from "@/components/customers/add-customer-dialog";
import { InitiateDryingForm } from "@/components/drying/initiate-drying-form";
import { useMemo } from "react";
import { toDate } from "@/lib/utils";
import { useAppUser } from "@/firebase/auth/use-user";

export default function DryingPage() {
  const firestore = useFirestore();
  const appUser = useAppUser();

  const customersQuery = useMemoFirebase(
    () => (firestore && appUser ? collection(firestore, 'customers') : null),
    [firestore, appUser]
  );
  const { data: customers, loading: loadingCustomers } = useCollection<Customer>(customersQuery);

  const unloadingRecordsQuery = useMemoFirebase(
    () => (firestore && appUser ? collection(firestore, 'unloadingRecords') : null),
    [firestore, appUser]
  );
  const { data: unloadingRecords, loading: loadingUnloadingRecords } = useCollection<UnloadingRecord>(unloadingRecordsQuery);

  const lotsQuery = useMemoFirebase(
    () => (firestore && appUser ? collection(firestore, 'lots') : null),
    [firestore, appUser]
  );
  const { data: lots, loading: loadingLots } = useCollection<Lot>(lotsQuery);
  
  const storageRecordsQuery = useMemoFirebase(
    () => (firestore && appUser ? collection(firestore, 'storageRecords') : null),
    [firestore, appUser]
  );
  const { data: storageRecords, loading: loadingStorageRecords } = useCollection<StorageRecord>(storageRecordsQuery);

  const commoditiesQuery = useMemoFirebase(
    () => (firestore && appUser ? collection(firestore, 'commodities') : null),
    [firestore, appUser]
  );
  const { data: commodities, loading: loadingCommodities } = useCollection<Commodity>(commoditiesQuery);

  const availableForDryingRecords = useMemo(() => {
    if (!unloadingRecords) return [];
    const filtered = unloadingRecords.filter(r => r.bagsUnloaded > (r.bagsSentToDrying || 0));
    return filtered.sort((a, b) => toDate(a.unloadingDate).getTime() - toDate(b.unloadingDate).getTime());
  }, [unloadingRecords]);


  if (loadingCustomers || loadingUnloadingRecords || loadingLots || loadingStorageRecords || loadingCommodities) {
    return <AppLayout><div>Loading...</div></AppLayout>;
  }

  return (
    <AppLayout>
      <PageHeader
        title="Drying Process"
        description="Manage items in the drying plot and finalize them into storage."
      >
        <AddCustomerDialog />
      </PageHeader>
      <div className="space-y-8">
        <InitiateDryingForm 
            customers={customers || []} 
            unloadingRecords={availableForDryingRecords || []}
            lots={lots || []}
            storageRecords={storageRecords || []}
            commodities={commodities || []}
        />
      </div>
    </AppLayout>
  );
}
