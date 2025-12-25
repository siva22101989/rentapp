
'use client';
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/shared/page-header";
import { UnloadingReceipt } from "@/components/unloading/unloading-receipt";
import { notFound, useParams } from "next/navigation";
import type { Customer, UnloadingRecord } from "@/lib/definitions";
import { useDoc } from "@/firebase/firestore/use-doc";
import { useFirestore } from "@/firebase";
import { doc } from "firebase/firestore";
import { useMemoFirebase } from "@/hooks/use-memo-firebase";

export default function UnloadingReceiptPage() {
  const params = useParams();
  const unloadingId = params.unloadingId as string;
  const firestore = useFirestore();

  const recordRef = useMemoFirebase(
    () => (firestore && unloadingId ? doc(firestore, 'unloadingRecords', unloadingId) : null),
    [firestore, unloadingId]
  );
  const { data: record, loading: loadingRecord } = useDoc<UnloadingRecord>(recordRef);

  const customerRef = useMemoFirebase(
    () => (firestore && record?.customerId ? doc(firestore, 'customers', record.customerId) : null),
    [firestore, record?.customerId]
  );
  const { data: customer, loading: loadingCustomer } = useDoc<Customer>(customerRef);

  if (loadingRecord || loadingCustomer) {
    return <AppLayout><div>Loading...</div></AppLayout>;
  }

  if (!record || !customer) {
    notFound();
  }
  
  return (
    <AppLayout>
      <PageHeader
        title="Unloading Bill"
        description={`Details for Unloading Bill No. ${record.billNo}`}
      />
      <div className="flex justify-center">
        <UnloadingReceipt record={record} customer={customer} />
      </div>
    </AppLayout>
  );
}
