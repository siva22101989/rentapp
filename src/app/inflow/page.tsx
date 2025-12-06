'use client';
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/shared/page-header";
import { InflowForm } from "@/components/inflow/inflow-form";
import { AddCustomerDialog } from "@/components/customers/add-customer-dialog";
import { useMemo } from "react";
import type { Customer, StorageRecord } from "@/lib/definitions";
import { useCollection } from "@/firebase/firestore/use-collection";
import { collection } from "firebase/firestore";
import { useFirestore } from "@/firebase";

export default function InflowPage() {
  const firestore = useFirestore();
  const { data: customers, loading: customersLoading } = useCollection<Customer>(
    firestore ? collection(firestore, 'customers') : null
  );
  const { data: records, loading: recordsLoading } = useCollection<StorageRecord>(
    firestore ? collection(firestore, 'storageRecords') : null
  );
  
  const loading = customersLoading || recordsLoading;

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


  if (loading) {
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
      <InflowForm customers={customers || []} nextSerialNumber={nextSerialNumber} />
    </AppLayout>
  );
}
