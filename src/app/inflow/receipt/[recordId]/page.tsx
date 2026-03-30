'use client';
import { InflowReceipt } from "@/components/inflow/inflow-receipt";
import { PrintHeader } from "@/components/shared/print-header";
import { notFound, useParams } from "next/navigation";
import type { Customer, StorageRecord, WarehouseInfo, UnloadingRecord } from "@/lib/definitions";
import { useFirestore } from "@/firebase/provider";
import { doc, getDoc } from "firebase/firestore";
import { useMemoFirebase } from "@/hooks/use-memo-firebase";
import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { toDate } from "@/lib/utils";
import { useDoc } from "@/firebase/firestore/use-doc";

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
  const [error, setError] = useState<string|null>(null);

  // Poll for the main record
  useEffect(() => {
    if (!firestore || !recordId) {
      setLoadingRecord(false);
      return;
    }
    const recordRef = doc(firestore, 'storageRecords', recordId as string);
    let attempts = 0;
    const maxAttempts = 10;
    const intervalTime = 500;

    const pollDocument = async () => {
      attempts++;
      try {
        const docSnap = await getDoc(recordRef);
        if (docSnap.exists()) {
          setRecord({ id: docSnap.id, ...docSnap.data() } as StorageRecord);
          setLoadingRecord(false);
        } else if (attempts < maxAttempts) {
          setTimeout(pollDocument, intervalTime);
        } else {
          setError('The bill could not be found. It may not have been saved correctly.');
          setLoadingRecord(false);
        }
      } catch (err) {
        console.error('Error fetching document:', err);
        setError('An error occurred while fetching the bill.');
        setLoadingRecord(false);
      }
    };

    pollDocument();
  }, [firestore, recordId]);

  // Fetch related data after the main record is loaded
  useEffect(() => {
    async function fetchRelatedData() {
        if (!firestore || !record?.customerId) {
            setLoadingCustomer(false);
            setLoadingUnloading(false);
            return;
        }

        // Fetch Customer
        setLoadingCustomer(true);
        try {
            const customerRef = doc(firestore, 'customers', record.customerId);
            const customerSnap = await getDoc(customerRef);
            if (customerSnap.exists()) {
                setCustomer({ id: customerSnap.id, ...customerSnap.data() } as Customer);
            }
        } catch (e) {
            console.error("Error fetching customer", e);
        } finally {
            setLoadingCustomer(false);
        }

        // Fetch Unloading Record (if applicable)
        if (record.inflowType === 'Plot' && record.dryingRecordId) {
            setLoadingUnloading(true);
            try {
                const dryingRef = doc(firestore, 'dryingRecords', record.dryingRecordId);
                const dryingSnap = await getDoc(dryingRef);
                if (dryingSnap.exists()) {
                    const dryingData = dryingSnap.data() as { unloadingRecordId?: string };
                    if (dryingData.unloadingRecordId) {
                        const unloadingRef = doc(firestore, 'unloadingRecords', dryingData.unloadingRecordId);
                        const unloadingSnap = await getDoc(unloadingRef);
                        if (unloadingSnap.exists()) {
                            setUnloadingRecord({ id: unloadingSnap.id, ...unloadingSnap.data() } as UnloadingRecord);
                        }
                    }
                }
            } catch (e) {
               console.error("Error fetching related unloading record", e);
            } finally {
               setLoadingUnloading(false);
            }
        } else {
            setLoadingUnloading(false);
        }
    }
    fetchRelatedData();
  }, [firestore, record]);
  
  const warehouseInfoRef = useMemoFirebase(
    () => (firestore ? doc(firestore, 'settings', 'main') : null),
    [firestore]
  );
  const { data: warehouseInfo, loading: loadingWarehouseInfo } = useDoc<WarehouseInfo>(warehouseInfoRef);
  
  const isLoading = loadingRecord || loadingCustomer || loadingWarehouseInfo || loadingUnloading;

  if (isLoading) {
    return (
        <div className="flex h-screen w-full items-center justify-center bg-gray-50">
            <div className="flex flex-col items-center gap-2">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-muted-foreground">Loading receipt...</p>
            </div>
        </div>
    );
  }

  if (error || !record || !customer) {
    return (
        <div className="flex h-screen w-full items-center justify-center bg-gray-50 p-4">
            <div className="text-center">
                <h1 className="text-xl font-bold text-destructive">404 - Not Found</h1>
                <p className="text-muted-foreground mt-2">{error || "The requested receipt could not be found."}</p>
                 <Button onClick={() => window.close()} className="mt-4">Close Window</Button>
            </div>
        </div>
    );
  }
  
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
