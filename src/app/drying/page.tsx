'use client';
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/shared/page-header";
import { useCollection } from "@/firebase/firestore/use-collection";
import { collection } from "firebase/firestore";
import { useFirestore } from "@/firebase";
import { useMemoFirebase } from "@/hooks/use-memo-firebase";
import type { Customer, UnloadingRecord } from "@/lib/definitions";
import { AddCustomerDialog } from "@/components/customers/add-customer-dialog";
import { InitiateDryingForm } from "@/components/drying/initiate-drying-form";
import { useMemo } from "react";
import { toDate } from "@/lib/utils";

export default function DryingPage() {
  const firestore = useFirestore();

  const customersQuery = useMemoFirebase(
    () => (firestore ? collection(firestore, 'customers') : null),
    [firestore]
  );
  const { data: customers, loading: loadingCustomers } = useCollection<Customer>(customersQuery);

  const unloadingRecordsQuery = useMemoFirebase(
    () => (firestore ? collection(firestore, 'unloadingRecords') : null),
    [firestore]
  );
  const { data: unloadingRecords, loading: loadingUnloadingRecords } = useCollection<UnloadingRecord>(unloadingRecordsQuery);


  const availableForDryingRecords = useMemo(() => {
    if (!unloadingRecords) return [];
    const filtered = unloadingRecords.filter(r => r.bagsUnloaded > (r.bagsSentToDrying || 0));
    // Sort by unloading date, oldest first, to show the earliest records at the top of the list.
    return filtered.sort((a, b) => toDate(a.unloadingDate).getTime() - toDate(b.unloadingDate).getTime());
  }, [unloadingRecords]);


  if (loadingCustomers || loadingUnloadingRecords) {
    return <AppLayout><div>Loading...</div></AppLayout>;
  }

  return (
    <AppLayout>
      <PageHeader
        title="Finalize Drying"
        description="Select an item from the unloading queue to finalize the drying process."
      >
        <AddCustomerDialog />
      </PageHeader>

      <div className="flex justify-center">
        <div className="w-full max-w-lg">
            <InitiateDryingForm 
                customers={customers || []} 
                unloadingRecords={availableForDryingRecords || []}
            />
        </div>
      </div>
    </AppLayout>
  );
}
