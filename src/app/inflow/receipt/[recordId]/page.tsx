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
import { toDate } from "@/lib/utils";

export default function InflowReceiptPage() {
  const params = useParams();
  const recordId = params.recordId as string;
  const firestore = useFirestore();

  const [record, setRecord] = useState<StorageRecord | null>(null);
  const [loadingRecord, setLoadingRecord] = useState(true);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loadingCustomer, setLoadingCustomer] = useState(true);
  const [unloadingRecord, setUnloadingRecord] = useState<UnloadingRecord | null>(null);
  const [loadingUnloading, setLoadingUnloading] = useState(true);

  // Fetch record with retry logic to solve race condition
  useEffect(() => {
    if (!firestore || !recordId) {
      setLoadingRecord(false);
      return;
    }

    const recordRef = doc(firestore, 'storageRecords', recordId);
    let attempts = 0;
    const maxAttempts = 5;
    const delay = 500; // ms

    const fetchRecord = async () => {
      try {
        const docSnap = await getDoc(recordRef);
        if (docSnap.exists()) {
          setRecord({ id: docSnap.id, ...docSnap.data() } as StorageRecord);
          setLoadingRecord(false);
        } else {
          attempts++;
          if (attempts < maxAttempts) {
            setTimeout(fetchRecord, delay);
          } else {
            console.error(`Document ${recordId} not found after ${maxAttempts} attempts.`);
            setRecord(null);
            setLoadingRecord(false);
          }
        }
      } catch (e) {
        console.error("Error fetching storage record:", e);
        setLoadingRecord(false);
      }
    };
    fetchRecord();
  }, [firestore, recordId]);

  // Fetch customer after record is available
  useEffect(() => {
    if (!firestore || !record?.customerId) {
        setLoadingCustomer(false);
        return;
    }
    setLoadingCustomer(true);
    const customerRef = doc(firestore, 'customers', record.customerId);
    getDoc(customerRef).then(docSnap => {
        if(docSnap.exists()) {
            setCustomer({ id: docSnap.id, ...docSnap.data() } as Customer);
        } else {
            setCustomer(null);
        }
        setLoadingCustomer(false);
    }).catch(e => {
        console.error("Error fetching customer", e);
        setLoadingCustomer(false);
    });
  }, [firestore, record]);

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
          // Fallback for old data structure
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
  
  const isLoading = loadingRecord || loadingCustomer || loadingWarehouseInfo || loadingUnloading;

  if (isLoading) {
    return (
        <div className="flex h-screen w-full items-center justify-center bg-gray-50">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
    );
  }

  if (!record || !customer) {
    notFound();
  }
  
  // Create a version of the record where all timestamps are converted to dates for the component
  const cleanRecord = {
    ...record,
    storageStartDate: toDate(record.storageStartDate),
    storageEndDate: record.storageEndDate ? toDate(record.storageEndDate) : null,
    dryingStartDate: record.dryingStartDate ? toDate(record.dryingStartDate) : null,
    dryingEndDate: record.dryingEndDate ? toDate(record.dryingEndDate) : null,
    payments: (record.payments || []).map(p => ({...p, date: toDate(p.date)})),
    outflows: (record.outflows || []).map(o => ({...o, date: toDate(o.date)})),
  };
  
  const cleanUnloadingRecord = unloadingRecord ? {
      ...unloadingRecord,
      unloadingDate: toDate(unloadingRecord.unloadingDate),
  } : undefined;

  return (
    <div className="bg-gray-100 min-h-screen">
      <PrintHeader title={`Inflow Bill #${record.id}`} />
      <main className="p-4 sm:p-8 flex justify-center">
        <InflowReceipt record={cleanRecord} customer={customer} warehouseInfo={warehouseInfo} unloadingRecord={cleanUnloadingRecord} />
      </main>
    </div>
  );
}
