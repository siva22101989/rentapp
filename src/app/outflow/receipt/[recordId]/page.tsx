'use client';
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/shared/page-header";
import { OutflowReceipt } from "@/components/outflow/outflow-receipt";
import { notFound, useParams, useSearchParams } from "next/navigation";
import type { Customer, StorageRecord } from "@/lib/definitions";
import { useDoc } from "@/firebase/firestore/use-doc";
import { doc } from "firebase/firestore";
import { useFirestore } from "@/firebase";

export default function OutflowReceiptPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const recordId = params.recordId as string;
  const firestore = useFirestore();

  const withdrawnBags = Number(searchParams.get('withdrawn')) || 0;
  const finalRent = Number(searchParams.get('rent')) || 0;
  const paidNow = Number(searchParams.get('paidNow')) || 0;

  const { data: record, loading: recordLoading } = useDoc<StorageRecord>(
    firestore && recordId ? doc(firestore, 'storageRecords', recordId) : null
  );
  
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
        title="Outflow Receipt"
        description={`Final bill for storage record ${record.id}`}
      />
      <div className="flex justify-center">
        <OutflowReceipt 
            record={record} 
            customer={customer}
            withdrawnBags={withdrawnBags}
            finalRent={finalRent}
            paidNow={paidNow}
        />
      </div>
    </AppLayout>
  );
}
