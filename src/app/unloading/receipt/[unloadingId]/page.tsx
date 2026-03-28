'use client';
import { PrintHeader } from "@/components/shared/print-header";
import { UnloadingReceipt } from "@/components/unloading/unloading-receipt";
import { notFound, useParams } from "next/navigation";
import type { Customer, UnloadingRecord, WarehouseInfo } from "@/lib/definitions";
import { useDoc } from "@/firebase/firestore/use-doc";
import { useFirestore } from "@/firebase/provider";
import { doc } from "firebase/firestore";
import { useMemoFirebase } from "@/hooks/use-memo-firebase";
import { Loader2 } from "lucide-react";

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

  const warehouseInfoRef = useMemoFirebase(
    () => (firestore ? doc(firestore, 'settings', 'main') : null),
    [firestore]
  );
  const { data: warehouseInfo, loading: loadingWarehouseInfo } = useDoc<WarehouseInfo>(warehouseInfoRef);
  
  if (loadingRecord || loadingCustomer || loadingWarehouseInfo) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gray-50">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!record || !customer) {
    notFound();
  }
  
  return (
    <div className="bg-gray-100 min-h-screen">
      <PrintHeader title={`Unloading Bill #${record.billNo}`} />
      <main className="p-4 sm:p-8 flex justify-center">
        <UnloadingReceipt record={record} customer={customer} warehouseInfo={warehouseInfo} />
      </main>
    </div>
  );
}
