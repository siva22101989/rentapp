
'use client';
// This page is no longer used for generating receipts from the form.
// It is kept for historical purposes or direct linking if needed.
// The primary receipt generation now happens in a dialog within the form components.
import { PrintHeader } from "@/components/shared/print-header";
import { UnloadingReceipt } from "@/components/unloading/unloading-receipt";
import { notFound, useParams } from "next/navigation";
import type { Customer, UnloadingRecord, WarehouseInfo } from "@/lib/definitions";
import { useDoc } from "@/firebase/firestore/use-doc";
import { useFirestore } from "@/firebase/provider";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { useMemoFirebase } from "@/hooks/use-memo-firebase";
import { Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { toDate } from "@/lib/utils";

export default function UnloadingReceiptPage() {
  const params = useParams();
  const unloadingId = params.unloadingId as string;
  const firestore = useFirestore();

  const [record, setRecord] = useState<UnloadingRecord | null>(null);
  const [loadingRecord, setLoadingRecord] = useState(true);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loadingCustomer, setLoadingCustomer] = useState(true);

  useEffect(() => {
    if (!firestore || !unloadingId) {
      setLoadingRecord(false);
      return;
    }
    const recordRef = doc(firestore, 'unloadingRecords', unloadingId);
    const unsubscribe = onSnapshot(recordRef, (docSnap) => {
        if (docSnap.exists()) {
            setRecord({ id: docSnap.id, ...docSnap.data() } as UnloadingRecord);
        } else {
            setRecord(null);
        }
        setLoadingRecord(false);
    }, (e) => {
        console.error("Error fetching unloading record:", e);
        setLoadingRecord(false);
    });
    return () => unsubscribe();
  }, [firestore, unloadingId]);

  useEffect(() => {
    if (!firestore || !record?.customerId) {
        setLoadingCustomer(false);
        return;
    }
    setLoadingCustomer(true);
    const customerRef = doc(firestore, 'customers', record.customerId);
    const unsubscribe = onSnapshot(customerRef, (docSnap) => {
        if(docSnap.exists()) {
            setCustomer({ id: docSnap.id, ...docSnap.data() } as Customer);
        } else {
            setCustomer(null);
        }
        setLoadingCustomer(false);
    }, (e) => {
        console.error("Error fetching customer", e);
        setLoadingCustomer(false);
    });
     return () => unsubscribe();
  }, [firestore, record]);

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
  
  const cleanRecord = {
    ...record,
    unloadingDate: toDate(record.unloadingDate),
  }

  return (
    <div className="bg-gray-100 min-h-screen">
      <PrintHeader title={`Unloading Bill #${record.billNo}`} />
      <main className="p-4 sm:p-8 flex justify-center">
        <UnloadingReceipt record={cleanRecord} customer={customer} warehouseInfo={warehouseInfo} />
      </main>
    </div>
  );
}
