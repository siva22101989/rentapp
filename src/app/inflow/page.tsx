
'use client';
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/shared/page-header";
import { InflowForm } from "@/components/inflow/inflow-form";
import { AddCustomerDialog } from "@/components/customers/add-customer-dialog";
import { useMemo } from "react";
import type { Customer, StorageRecord, Commodity, Lot } from "@/lib/definitions";
import { useCollection } from "@/firebase/firestore/use-collection";
import { collection, query } from "firebase/firestore";
import { useFirestore } from "@/firebase/provider";
import { useMemoFirebase } from "@/hooks/use-memo-firebase";
import { useAppUser } from "@/firebase/auth/use-user";

export default function InflowPage() {
  const firestore = useFirestore();
  const appUser = useAppUser();

  const customersQuery = useMemoFirebase(
    () => (firestore && appUser ? collection(firestore, 'customers') : null),
    [firestore, appUser]
  );
  const { data: customers, loading: loadingCustomers } = useCollection<Customer>(customersQuery);

  const recordsQuery = useMemoFirebase(
    () => (firestore && appUser ? collection(firestore, 'storageRecords') : null),
    [firestore, appUser]
  );
  const { data: records, loading: loadingRecords } = useCollection<StorageRecord>(recordsQuery);

  const commoditiesQuery = useMemoFirebase(
    () => (firestore && appUser ? collection(firestore, 'commodities') : null),
    [firestore, appUser]
  );
  const { data: commodities, loading: loadingCommodities } = useCollection<Commodity>(commoditiesQuery);
  
  const lotsQuery = useMemoFirebase(
    () => (firestore && appUser ? collection(firestore, 'lots') : null),
    [firestore, appUser]
  );
  const { data: lots, loading: loadingLots } = useCollection<Lot>(lotsQuery);

  const nextId = useMemo(() => {
    if (!records) return '1';
    const maxId = records.reduce((max, r) => {
        const idNum = parseInt(r.id.replace(/[^0-9]/g, ''), 10);
        return isNaN(idNum) ? max : Math.max(max, idNum);
    }, 0);
    return (maxId + 1).toString();
  }, [records]);


  if (loadingCustomers || loadingRecords || loadingCommodities || loadingLots) {
    return <AppLayout><div>Loading...</div></AppLayout>;
  }

  return (
    <AppLayout>
      <PageHeader
        title="Add Inflow"
        description="Create a new storage record for a customer."
      >
        <AddCustomerDialog />
      </PageHeader>
      <InflowForm 
        customers={customers || []} 
        commodities={commodities || []}
        lots={lots || []}
        records={records || []}
        nextId={nextId}
      />
    </AppLayout>
  );
}
