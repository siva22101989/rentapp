'use client';
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/shared/page-header";
import { useCollection, useFirestore, useAppUser } from "@/firebase";
import { collection, query, where } from "firebase/firestore";
import { useMemoFirebase } from "@/hooks/use-memo-firebase";
import type { Customer, UnloadingRecord, Lot, StorageRecord, Commodity, DryingRecord } from "@/lib/definitions";
import { AddCustomerDialog } from "@/components/customers/add-customer-dialog";
import { InitiateDryingForm } from "@/components/drying/initiate-drying-form";
import { DryingHistoryTable } from "@/components/drying/drying-history-table";
import { useMemo } from "react";
import { toDate } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

export default function DryingPage() {
  const firestore = useFirestore();
  const appUser = useAppUser();
  const canAdd = appUser?.role !== 'super-admin';

  const customersQuery = useMemoFirebase(
    () => (firestore && appUser?.warehouseId ? query(collection(firestore, 'customers'), where('warehouseId', '==', appUser.warehouseId)) : null),
    [firestore, appUser]
  );
  const { data: customers, loading: loadingCustomers } = useCollection<Customer>(customersQuery);

  const unloadingRecordsQuery = useMemoFirebase(
    () => (firestore && appUser?.warehouseId ? query(collection(firestore, 'unloadingRecords'), where('warehouseId', '==', appUser.warehouseId)) : null),
    [firestore, appUser]
  );
  const { data: unloadingRecords, loading: loadingUnloadingRecords } = useCollection<UnloadingRecord>(unloadingRecordsQuery);

  const lotsQuery = useMemoFirebase(
    () => (firestore && appUser?.warehouseId ? query(collection(firestore, 'lots'), where('warehouseId', '==', appUser.warehouseId)) : null),
    [firestore, appUser]
  );
  const { data: lots, loading: loadingLots } = useCollection<Lot>(lotsQuery);
  
  const storageRecordsQuery = useMemoFirebase(
    () => (firestore && appUser?.warehouseId ? query(collection(firestore, 'storageRecords'), where('warehouseId', '==', appUser.warehouseId)) : null),
    [firestore, appUser]
  );
  const { data: storageRecords, loading: loadingStorageRecords } = useCollection<StorageRecord>(storageRecordsQuery);

  const commoditiesQuery = useMemoFirebase(
    () => (firestore && appUser?.warehouseId ? query(collection(firestore, 'commodities'), where('warehouseId', '==', appUser.warehouseId)) : null),
    [firestore, appUser]
  );
  const { data: commodities, loading: loadingCommodities } = useCollection<Commodity>(commoditiesQuery);

  const dryingRecordsQuery = useMemoFirebase(
    () => (firestore && appUser?.warehouseId ? query(collection(firestore, 'dryingRecords'), where('warehouseId', '==', appUser.warehouseId)) : null),
    [firestore, appUser]
  );
  const { data: dryingRecords, loading: loadingDryingRecords } = useCollection<DryingRecord>(dryingRecordsQuery);

  const availableForDryingRecords = useMemo(() => {
    if (!unloadingRecords) return [];
    const filtered = unloadingRecords.filter(r => r.bagsUnloaded > (r.bagsSentToDrying || 0));
    return filtered.sort((a, b) => toDate(a.unloadingDate).getTime() - toDate(b.unloadingDate).getTime());
  }, [unloadingRecords]);


  if (loadingCustomers || loadingUnloadingRecords || loadingLots || loadingStorageRecords || loadingCommodities || loadingDryingRecords) {
    return <AppLayout><div>Loading...</div></AppLayout>;
  }

  return (
    <AppLayout>
      <PageHeader
        title="Drying Process"
        description="Manage items in the drying plot and finalize them into storage."
      >
        {canAdd && <AddCustomerDialog />}
      </PageHeader>
      <div className="space-y-8">
        {canAdd ? (
          <InitiateDryingForm 
              customers={customers || []} 
              unloadingRecords={availableForDryingRecords || []}
              lots={lots || []}
              storageRecords={storageRecords || []}
              commodities={commodities || []}
          />
        ) : (
          <Card><CardContent className="p-8 text-center text-muted-foreground">This function is not available for super-admins.</CardContent></Card>
        )}

        <DryingHistoryTable 
            dryingRecords={dryingRecords || []}
            customers={customers || []}
            unloadingRecords={unloadingRecords || []}
            lots={lots || []}
            storageRecords={storageRecords || []}
            commodities={commodities || []}
        />
      </div>
    </AppLayout>
  );
}
