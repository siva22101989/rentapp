
'use client';
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/shared/page-header";
import { InflowForm } from "@/components/inflow/inflow-form";
import { AddCustomerDialog } from "@/components/customers/add-customer-dialog";
import { useMemo } from "react";
import type { Customer, StorageRecord, Commodity, Lot, UnloadingRecord } from "@/lib/definitions";
import { useCollection } from "@/firebase/firestore/use-collection";
import { collection, query, where } from "firebase/firestore";
import { useFirestore } from "@/firebase/provider";
import { useMemoFirebase } from "@/hooks/use-memo-firebase";
import { useAppUser } from "@/firebase/auth/use-user";
import { Card, CardContent } from "@/components/ui/card";

export default function InflowPage() {
  const firestore = useFirestore();
  const appUser = useAppUser();
  const canAdd = appUser?.role !== 'super-admin';

  const customersQuery = useMemoFirebase(
    () => (firestore && appUser?.warehouseId ? query(collection(firestore, 'customers'), where('warehouseId', '==', appUser.warehouseId)) : null),
    [firestore, appUser]
  );
  const { data: customers, loading: loadingCustomers } = useCollection<Customer>(customersQuery);

  const recordsQuery = useMemoFirebase(
    () => (firestore && appUser?.warehouseId ? query(collection(firestore, 'storageRecords'), where('warehouseId', '==', appUser.warehouseId)) : null),
    [firestore, appUser]
  );
  const { data: records, loading: loadingRecords } = useCollection<StorageRecord>(recordsQuery);

  const unloadingRecordsQuery = useMemoFirebase(
    () => (firestore && appUser?.warehouseId ? query(collection(firestore, 'unloadingRecords'), where('warehouseId', '==', appUser.warehouseId)) : null),
    [firestore, appUser]
  );
  const { data: unloadingRecords, loading: loadingUnloading } = useCollection<UnloadingRecord>(unloadingRecordsQuery);

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

  const nextId = useMemo(() => {
    let max = 1000;
    
    // 1. Check Storage Records & Outflow Pattis
    if (records) {
        records.forEach(r => {
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

    // 2. Check Unloading Bills
    if (unloadingRecords) {
        unloadingRecords.forEach(ur => {
            const billNum = parseInt(String(ur.billNo || ur.id).replace(/\D/g, ''), 10);
            if (!isNaN(billNum) && billNum > max) max = billNum;
        });
    }

    return String(max + 1);
  }, [records, unloadingRecords]);


  if (loadingCustomers || loadingRecords || loadingCommodities || loadingLots || loadingUnloading) {
    return <AppLayout><div className="p-8 text-center">Loading global sequence...</div></AppLayout>;
  }

  return (
    <AppLayout>
      <PageHeader
        title="Add Inflow"
        description="Create a new storage record. IDs are sequential across all bill types."
      >
        {canAdd && <AddCustomerDialog />}
      </PageHeader>
      {canAdd ? (
        <InflowForm 
          customers={customers || []} 
          commodities={commodities || []}
          lots={lots || []}
          records={records || []}
          nextId={nextId}
        />
      ) : (
        <Card><CardContent className="p-8 text-center text-muted-foreground">This function is not available for super-admins.</CardContent></Card>
      )}
    </AppLayout>
  );
}
