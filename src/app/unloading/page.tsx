
'use client';
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/shared/page-header";
import { useCollection } from "@/firebase/firestore/use-collection";
import { collection, query, where } from "firebase/firestore";
import { useFirestore } from "@/firebase/provider";
import { useMemoFirebase } from "@/hooks/use-memo-firebase";
import type { Customer, UnloadingRecord, Commodity } from "@/lib/definitions";
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

  const nextBillNo = useMemo(() => {
    if (!unloadingRecords) return '1';
    const maxBillNo = unloadingRecords.reduce((max, record) => {
      const billNo = parseInt(record.billNo || '0', 10);
      return billNo > max ? billNo : max;
    }, 0);
    return (maxBillNo + 1).toString();
  }, [unloadingRecords]);

  if (loadingCustomers || loadingRecords || loadingCommodities) {
    return <AppLayout><div>Loading...</div></AppLayout>;
  }

  return (
    <AppLayout>
      <PageHeader
        title="Unloading Process"
        description="Manage the process of unloading goods from vehicles."
      >
        {canAdd && <AddCustomerDialog />}
      </PageHeader>

      <div className="grid gap-8 lg:grid-cols-3">
          {canAdd && (
            <div className="lg:col-span-1">
              <AddUnloadingRecordForm customers={customers || []} commodities={commodities || []} nextBillNo={nextBillNo} />
            </div>
          )}
          <div className={canAdd ? "lg:col-span-2" : "lg:col-span-3"}>
            <UnloadingRecordsTable 
              unloadingRecords={unloadingRecords || []} 
              customers={customers || []}
              commodities={commodities || []}
            />
          </div>
      </div>
    </AppLayout>
  );
}
