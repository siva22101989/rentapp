
'use client';
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/shared/page-header";
import { useCollection } from "@/firebase/firestore/use-collection";
import { collection } from "firebase/firestore";
import { useFirestore } from "@/firebase/provider";
import { useMemoFirebase } from "@/hooks/use-memo-firebase";
import type { Customer, UnloadingRecord, Lot, StorageRecord } from "@/lib/definitions";
import { AddCustomerDialog } from "@/components/customers/add-customer-dialog";
import { InitiateDryingForm } from "@/components/drying/initiate-drying-form";
import { useMemo } from "react";
import { toDate } from "@/lib/utils";
import { useAppUser } from "@/firebase/auth/use-user";

export default function DryingPage() {
  const firestore = useFirestore();
  const appUser = useAppUser();

  const customersQuery = useMemoFirebase(
    () => (firestore && appUser?.warehouseId ? collection(firestore, 'managedWarehouses', appUser.warehouseId, 'customers') : null),
    [firestore, appUser]
  );
  const { data: customers, loading: loadingCustomers } = useCollection<Customer>(customersQuery);

  const unloadingRecordsQuery = useMemoFirebase(
    () => (firestore && appUser?.warehouseId ? collection(firestore, 'managedWarehouses', appUser.warehouseId, 'unloadingRecords') : null),
    [firestore, appUser]
  );
  const { data: unloadingRecords, loading: loadingUnloadingRecords } = useCollection<UnloadingRecord>(unloadingRecordsQuery);

  const lotsQuery = useMemoFirebase(
    () => (firestore && appUser?.warehouseId ? collection(firestore, 'managedWarehouses', appUser.warehouseId, 'lots') : null),
    [firestore, appUser]
  );
  const { data: lots, loading: loadingLots } = useCollection<Lot>(lotsQuery);
  
  const storageRecordsQuery = useMemoFirebase(
    () => (firestore && appUser?.warehouseId ? collection(firestore, 'managedWarehouses', appUser.warehouseId, 'storageRecords') : null),
    [firestore, appUser]
  );
  const { data: storageRecords, loading: loadingStorageRecords } = useCollection<StorageRecord>(storageRecordsQuery);


  const availableForDryingRecords = useMemo(() => {
    if (!unloadingRecords) return [];
    const filtered = unloadingRecords.filter(r => r.bagsUnloaded > (r.bagsSentToDrying || 0));
    return filtered.sort((a, b) => toDate(a.unloadingDate).getTime() - toDate(b.unloadingDate).getTime());
  }, [unloadingRecords]);


  if (loadingCustomers || loadingUnloadingRecords || loadingLots || loadingStorageRecords) {
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

      <div className="flex justify-center">
        <div className="w-full max-w-lg">
            <InitiateDryingForm 
                customers={customers || []} 
                unloadingRecords={availableForDryingRecords || []}
                lots={lots || []}
                storageRecords={storageRecords || []}
            />
        </div>
      </div>
    </AppLayout>
  );
}
