'use client';
import { InflowReceipt } from "@/components/inflow/inflow-receipt";
import { PrintHeader } from "@/components/shared/print-header";
import { notFound, useParams } from "next/navigation";
import type { Customer, StorageRecord, WarehouseInfo, UnloadingRecord, DryingRecord } from "@/lib/definitions";
import { useDoc } from "@/firebase/firestore/use-doc";
import { useFirestore } from "@/firebase/provider";
import { doc, getDoc } from "firebase/firestore";
import { useMemoFirebase } from "@/hooks/use-memo-firebase";
import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";

export default function InflowReceiptPage() {
  const params = useParams();
  const recordId = params.recordId as string;
  const firestore = useFirestore();

  const [unloadingRecord, setUnloadingRecord] = useState<UnloadingRecord | null>(null);
  const [loadingUnloading, setLoadingUnloading] = useState(true);

  const recordRef = useMemoFirebase(
    () => (firestore && recordId ? doc(firestore, 'storageRecords', recordId) : null),
    [firestore, recordId]
  );
  const { data: record, loading: loadingRecord } = useDoc<StorageRecord>(recordRef);

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

  useEffect(() => {
    async function fetchUnloadingRecord() {
      if (!firestore || !record || record.inflowType !== 'Plot' || !record.dryingRecordId) {
        setLoadingUnloading(false);
        return;
      }
      
      setLoadingUnloading(true);
      
      try {
        const dryingRef = doc(firestore, 'dryingRecords', record.dryingRecordId);
        const dryingSnap = await getDoc(dryingRef);
        
        if (dryingSnap.exists()) {
          const dryingData = dryingSnap.data() as DryingRecord;
          if (dryingData.unloadingRecordId) {
            const unloadingRef = doc(firestore, 'unloadingRecords', dryingData.unloadingRecordId);
            const unloadingSnap = await getDoc(unloadingRef);
            if (unloadingSnap.exists()) {
              setUnloadingRecord({ id: unloadingSnap.id, ...unloadingSnap.data() } as UnloadingRecord);
            }
          }
        } else {
          const unloadingRef = doc(firestore, 'unloadingRecords', record.dryingRecordId);
          const unloadingSnap = await getDoc(unloadingRef);
          if (unloadingSnap.exists()) {
            setUnloadingRecord({ id: unloadingSnap.id, ...unloadingSnap.data() } as UnloadingRecord);
          }
        }
      } catch (e) {
        console.error("Error fetching related unloading record", e);
      } finally {
        setLoadingUnloading(false);
      }
    }
    fetchUnloadingRecord();
  }, [firestore, record]);

  if (loadingRecord || loadingCustomer || loadingWarehouseInfo || loadingUnloading) {
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
      <PrintHeader title={`Inflow Bill #${record.id}`} />
      <main className="p-4 sm:p-8 flex justify-center">
        <InflowReceipt record={record} customer={customer} warehouseInfo={warehouseInfo} unloadingRecord={unloadingRecord || undefined} />
      </main>
    </div>
  );
}
