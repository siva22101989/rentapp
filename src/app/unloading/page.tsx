
'use client';
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/shared/page-header";
import { useCollection } from "@/firebase/firestore/use-collection";
import { collection, query, where } from "firebase/firestore";
import { useFirestore } from "@/firebase/provider";
import { useMemoFirebase } from "@/hooks/use-memo-firebase";
import type { Customer, UnloadingRecord, Commodity, Lot, StorageRecord } from "@/lib/definitions";
import { AddCustomerDialog } from "@/components/customers/add-customer-dialog";
import { AddUnloadingRecordForm } from "@/components/unloading/add-unloading-form";
import { useMemo } from "react";
import { UnloadingRecordsTable } from "@/components/unloading/unloading-records-table";
import { useAppUser } from "@/firebase/auth/use-user";

export default function UnloadingPage() {
  const firestore = useFirestore();
  const appUser = useAppUser();
  const canAdd = appUser?.role === 'owner' || appUser?.role === 'biller' || appUser?.role === 'supervisor';

  const customersQuery = useMemoFirebase(
    () => (firestore && appUser?.warehouseId ? query(collection(firestore, 'customers'), where('warehouseId', '==', appUser.warehouseId)) : null),
    [firestore, appUser]
  );
  const { data: customers, loading: loadingCustomers } = useCollection<Customer>(customersQuery);

  const unloadingRecordsQuery = useMemoFirebase(
    () => (firestore && appUser?.warehouseId ? query(collection(firestore, 'unloadingRecords'), where('warehouseId', '==', appUser.warehouseId)) : null),
    [firestore, appUser]
  );
  const { data: unloadingRecords, loading: loadingRecords } = useCollection<UnloadingRecord>(unloadingRecordsQuery);

  const commoditiesQuery = useMemoFirebase(
    () => (firestore && appUser?.warehouseId ? query(collection(firestore, 'commodities'), where('warehouseId', '==', appUser.warehouseId)) : null),
    [firestore, appUser]
  );
  const { data: commodities, loading: loadingCommodities } = useCollection<Commodity>(commoditiesQuery);

  const lotsQuery = useMemoFirebase(
    () => (firestore && appUser?.warehouseId ? query(collection(firestore, 'lots'), where('warehouseId', '==', appUser.warehouseId)) : null),
    [firestore, appUser]
  );
  const { data: lots, loading: loadingLots } = useCollection<Lot>(lotsQuery);

  const storageRecordsQuery = useMemoFirebase(
    () => (firestore && appUser?.warehouseId ? query(collection(firestore, 'storageRecords'), where('warehouseId', '==', appUser.warehouseId)) : null),
    [firestore, appUser]
  );
  const { data: storageRecords, loading: loadingStorage } = useCollection<StorageRecord>(storageRecordsQuery);

  const nextBillNo = useMemo(() => {
    let max = 1000;
    
    // 1. Check Unloading Records
    if (unloadingRecords) {
        unloadingRecords.forEach(ur => {
            const billNum = parseInt(String(ur.billNo || ur.id).replace(/\D/g, ''), 10);
            if (!isNaN(billNum) && billNum > max) max = billNum;
        });
    }

    // 2. Check Storage Records & Outflow Pattis
    if (storageRecords) {
        storageRecords.forEach(r => {
            const idNum = parseInt(String(r.id).replace(/\D/g, ''), 10);
            if (!isNaN(idNum) && idNum > max) max = idNum;
            
            if (Array.isArray(r.outflows)) {
                r.outflows.forEach(o => {
                    const pNum = parseInt(String(o.pattiNo || '0').replace(/\D/g, ''), 10);
                    if (!isNaN(pNum) && pNum > max) max = pNum;
                });
            }
        });
    }

    return String(max + 1);
  }, [unloadingRecords, storageRecords]);

  if (loadingCustomers || loadingRecords || loadingCommodities || loadingLots || loadingStorage) {
    return <AppLayout><div className="p-8 text-center">Loading global sequence...</div></AppLayout>;
  }

  return (
    <AppLayout>
      <PageHeader
        title="Unloading Process"
        description="Sequential Bill Numbers applied across all warehouse activities."
      >
        {canAdd && <AddCustomerDialog />}
      </PageHeader>

      <div className="grid gap-8 lg:grid-cols-3">
          {canAdd && (
            <div className="lg:col-span-1">
              <AddUnloadingRecordForm 
                customers={customers || []} 
                commodities={commodities || []} 
                lots={lots || []}
                storageRecords={storageRecords || []}
                nextBillNo={nextBillNo} 
              />
            </div>
          )}
          <div className={canAdd ? "lg:col-span-2" : "lg:col-span-3"}>
            <UnloadingRecordsTable 
              unloadingRecords={unloadingRecords || []} 
              customers={customers || []}
              commodities={commodities || []}
              lots={lots || []}
              storageRecords={storageRecords || []}
            />
          </div>
      </div>
    </AppLayout>
  );
}
