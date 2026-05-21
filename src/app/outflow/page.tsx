'use client';
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/shared/page-header";
import { OutflowForm } from "@/components/outflow/outflow-form";
import type { Customer, StorageRecord, Commodity } from "@/lib/definitions";
import { useCollection } from "@/firebase/firestore/use-collection";
import { collection, query, where } from "firebase/firestore";
import { useFirestore } from "@/firebase/provider";
import { useMemoFirebase } from "@/hooks/use-memo-firebase";
import { useAppUser } from "@/firebase/auth/use-user";
import { Card, CardContent } from "@/components/ui/card";
import { useMemo } from "react";

export default function OutflowPage() {
  const firestore = useFirestore();
  const appUser = useAppUser();
  const canAdd = appUser?.role !== 'super-admin';

  // Fetch all warehouse records to avoid strict end-date filter issues
  const allRecordsQuery = useMemoFirebase(
    () => (firestore && appUser?.warehouseId ? query(collection(firestore, 'storageRecords'), where('warehouseId', '==', appUser.warehouseId)) : null),
    [firestore, appUser]
  );
  const { data: allRecords, loading: loadingRecords } = useCollection<StorageRecord>(allRecordsQuery);

  const customersQuery = useMemoFirebase(
    () => (firestore && appUser?.warehouseId ? query(collection(firestore, 'customers'), where('warehouseId', '==', appUser.warehouseId)) : null),
    [firestore, appUser]
  );
  const { data: customers, loading: loadingCustomers } = useCollection<Customer>(customersQuery);

  const commoditiesQuery = useMemoFirebase(
    () => (firestore && appUser?.warehouseId ? query(collection(firestore, 'commodities'), where('warehouseId', '==', appUser.warehouseId)) : null),
    [firestore, appUser]
  );
  const { data: commodities, loading: loadingCommodities } = useCollection<Commodity>(commoditiesQuery);

  // Safter stock visibility filter: if it has bags stored, it's active for outflow
  const activeRecords = useMemo(() => {
    if (!allRecords) return [];
    return allRecords.filter(r => Number(r.bagsStored || 0) > 0);
  }, [allRecords]);

  if (loadingCustomers || loadingRecords || loadingCommodities) {
    return <AppLayout><div className="p-8 text-center text-muted-foreground">Loading active godown stock...</div></AppLayout>;
  }

  return (
    <AppLayout>
      <PageHeader
        title="Process Outflow"
        description="Select one or more records to process for withdrawal."
      />
      {canAdd ? (
        <OutflowForm records={activeRecords} customers={customers || []} commodities={commodities || []} />
      ) : (
        <Card><CardContent className="p-8 text-center text-muted-foreground">This function is not available for super-admins.</CardContent></Card>
      )}
    </AppLayout>
  );
}