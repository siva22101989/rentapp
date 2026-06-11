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
import { Loader2 } from "lucide-react";

export default function OutflowPage() {
  const firestore = useFirestore();
  const appUser = useAppUser();
  const canAdd = appUser?.role !== 'super-admin';

  // 1. Fetch ALL records for ID calculation (to prevent repeats)
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

  // 2. Extract Active Records for selection
  const activeRecords = useMemo(() => {
    if (!allRecords) return [];
    return allRecords.filter(r => {
        const bagsOut = Array.isArray(r.outflows) ? r.outflows.reduce((acc, o) => acc + (Number(o.bagsWithdrawn) || 0), 0) : (Number(r.bagsOut) || 0);
        const initialIn = Number(r.bagsIn) || (Number(r.bagsStored || 0) + bagsOut);
        const balance = initialIn - bagsOut;
        return !r.storageEndDate && balance > 0.5;
    });
  }, [allRecords]);

  if (loadingCustomers || loadingRecords || loadingCommodities) {
    return (
        <AppLayout>
            <div className="flex h-64 items-center justify-center text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Synchronizing global inventory...
            </div>
        </AppLayout>
    );
  }

  return (
    <AppLayout>
      <PageHeader
        title="Process Outflow"
        description="Withdraw items from Godown. Every entry generates a unique numerical ID."
      />
      {canAdd ? (
        <OutflowForm 
            activeRecords={activeRecords} 
            allRecords={allRecords || []} 
            customers={customers || []} 
            commodities={commodities || []} 
        />
      ) : (
        <Card><CardContent className="p-8 text-center text-muted-foreground">This function is not available for super-admins.</CardContent></Card>
      )}
    </AppLayout>
  );
}
