
'use client';
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/shared/page-header";
import { useCollection } from "@/firebase/firestore/use-collection";
import { collection } from "firebase/firestore";
import { useFirestore } from "@/firebase";
import { useMemoFirebase } from "@/hooks/use-memo-firebase";
import type { Customer, DryingRecord } from "@/lib/definitions";
import { AddCustomerDialog } from "@/components/customers/add-customer-dialog";
import { AddDryingRecordForm } from "@/components/drying/add-drying-form";
import { DryingRecordsTable } from "@/components/drying/drying-records-table";

export default function DryingPage() {
  const firestore = useFirestore();

  const customersQuery = useMemoFirebase(
    () => (firestore ? collection(firestore, 'customers') : null),
    [firestore]
  );
  const { data: customers, loading: loadingCustomers } = useCollection<Customer>(customersQuery);

  const dryingRecordsQuery = useMemoFirebase(
    () => (firestore ? collection(firestore, 'dryingRecords') : null),
    [firestore]
  );
  const { data: dryingRecords, loading: loadingRecords } = useCollection<DryingRecord>(dryingRecordsQuery);


  if (loadingCustomers || loadingRecords) {
    return <AppLayout><div>Loading...</div></AppLayout>;
  }

  return (
    <AppLayout>
      <PageHeader
        title="Drying Process"
        description="Manage the process of drying goods."
      >
        <AddCustomerDialog />
      </PageHeader>

      <div className="grid gap-8 md:grid-cols-3">
        <div className="md:col-span-1">
          <AddDryingRecordForm customers={customers || []} />
        </div>
        <div className="md:col-span-2">
            <DryingRecordsTable dryingRecords={dryingRecords || []} customers={customers || []} />
        </div>
      </div>
    </AppLayout>
  );
}

    