'use client';
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/shared/page-header";
import { InflowForm } from "@/components/inflow/inflow-form";
import { AddCustomerDialog } from "@/components/customers/add-customer-dialog";
import { useMemo } from "react";
import type { Customer, StorageRecord, DryingRecord, Commodity } from "@/lib/definitions";
import { useCollection } from "@/firebase/firestore/use-collection";
import { collection, query, where } from "firebase/firestore";
import { useFirestore } from "@/firebase";
import { useMemoFirebase } from "@/hooks/use-memo-firebase";
import { useSearchParams } from "next/navigation";

export default function InflowPage() {
  const firestore = useFirestore();
  const searchParams = useSearchParams();
  const fromDryingRecordId = searchParams.get('fromDryingRecord');

  const customersQuery = useMemoFirebase(
    () => (firestore ? collection(firestore, 'customers') : null),
    [firestore]
  );
  const { data: customers, loading: loadingCustomers } = useCollection<Customer>(customersQuery);

  const recordsQuery = useMemoFirebase(
    () => (firestore ? collection(firestore, 'storageRecords') : null),
    [firestore]
  );
  const { data: records, loading: loadingRecords } = useCollection<StorageRecord>(recordsQuery);

  const dryingRecordsQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'dryingRecords'), where('status', '==', 'Billed')) : null),
    [firestore]
  );
  const { data: dryingRecords, loading: loadingDryingRecords } = useCollection<DryingRecord>(dryingRecordsQuery);

  const commoditiesQuery = useMemoFirebase(
    () => (firestore ? collection(firestore, 'commodities') : null),
    [firestore]
  );
  const { data: commodities, loading: loadingCommodities } = useCollection<Commodity>(commoditiesQuery);


  const nextSerialNumber = useMemo(() => {
    if (!records || records.length === 0) {
      return 'SLWH-1';
    }
    const maxId = records.reduce((max, record) => {
      const idNum = parseInt(record.id.replace('SLWH-', ''), 10);
      return isNaN(idNum) ? max : Math.max(max, idNum);
    }, 0);
    return `SLWH-${maxId + 1}`;
  }, [records]);


  if (loadingCustomers || loadingRecords || loadingDryingRecords || loadingCommodities) {
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
        dryingRecords={dryingRecords || []}
        commodities={commodities || []}
        nextSerialNumber={nextSerialNumber} 
        fromDryingRecordId={fromDryingRecordId} 
      />
    </AppLayout>
  );
}
