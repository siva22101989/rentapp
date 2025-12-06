'use client';
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/shared/page-header";
import { InflowReceipt } from "@/components/inflow/inflow-receipt";
import { notFound, useParams } from "next/navigation";
import type { Customer, StorageRecord } from "@/lib/definitions";
import { useDoc } from "@/firebase/firestore/use-doc";
import { doc } from "firebase/firestore";
import { useFirestore } from "@/firebase";

export default function InflowReceiptPage() {
  const params = useParams();
  const recordId = params.recordId as string;
  const firestore = useFirestore();

  const { data: record, loading: recordLoading } = useDoc<StorageRecord>(
    firestore && recordId ? doc(firestore, 'storageRecords', recordId) : null
  );
  
  // Fetch customer separately based on record's customerId
  const { data: customer, loading: customerLoading } = useDoc<Customer>(
    firestore && record ? doc(firestore, 'customers', record.customerId) : null
  );
  
  const loading = recordLoading || customerLoading;

  if (loading) {
    return <AppLayout><div>Loading...</div></AppLayout>;
  }

  if (!record || !customer) {
    notFound();
  }
  
  return (
    <AppLayout>
      <PageHeader
        title="Inflow Receipt"
        description={`Details for storage record ${record.id}`}
      />
      <div className="flex justify-center">
        <InflowReceipt record={record} customer={customer} />
      </div>
    </AppLayout>
  );
}
