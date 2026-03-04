
'use client';
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/shared/page-header";
import { InflowReceipt } from "@/components/inflow/inflow-receipt";
import { notFound, useParams } from "next/navigation";
import type { Customer, StorageRecord, WarehouseInfo, UnloadingRecord, DryingRecord } from "@/lib/definitions";
import { useDoc } from "@/firebase/firestore/use-doc";
import { useFirestore } from "@/firebase/provider";
import { doc, getDoc } from "firebase/firestore";
import { useMemoFirebase } from "@/hooks/use-memo-firebase";
import { useState, useEffect } from "react";

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
      
      // Try fetching as a DryingRecord first (new flow)
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
          // Fallback: try fetching as an UnloadingRecord directly (old flow)
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
    return <AppLayout><div>Loading...</div></AppLayout>;
  }

  if (!record || !customer) {
    notFound();
  }
  
  return (
    <AppLayout>
      <PageHeader
        title="Inflow Bill"
        description={`Details for storage bill ${record.id}`}
      />
      <div className="flex justify-center">
        <InflowReceipt record={record} customer={customer} warehouseInfo={warehouseInfo} unloadingRecord={unloadingRecord || undefined} />
      </div>
    </AppLayout>
  );
}
