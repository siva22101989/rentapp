
'use client';
// This page is no longer used for generating receipts from the form.
// It is kept for historical purposes or direct linking if needed.
// The primary receipt generation now happens in a dialog within the form components.
import { PrintHeader } from "@/components/shared/print-header";
import { OutflowReceipt } from "@/components/outflow/outflow-receipt";
import { notFound, useParams, useSearchParams } from "next/navigation";
import type { Customer, StorageRecord, WarehouseInfo } from "@/lib/definitions";
import { useDoc } from "@/firebase/firestore/use-doc";
import { useFirestore } from "@/firebase/provider";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { useMemoFirebase } from "@/hooks/use-memo-firebase";
import { toDate } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { useState, useEffect } from "react";

export default function OutflowReceiptPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const recordId = params.recordId as string;
  const firestore = useFirestore();

  const [record, setRecord] = useState<StorageRecord | null>(null);
  const [loadingRecord, setLoadingRecord] = useState(true);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loadingCustomer, setLoadingCustomer] = useState(true);

  const withdrawnBags = Number(searchParams.get('withdrawn')) || 0;
  const finalRent = Number(searchParams.get('rent')) || 0;
  const paidNow = Number(searchParams.get('paidNow')) || 0;
  const discount = Number(searchParams.get('discount')) || 0;

  useEffect(() => {
    if (!firestore || !recordId) {
      setLoadingRecord(false);
      return;
    }
    const recordRef = doc(firestore, 'storageRecords', recordId);
    const unsubscribe = onSnapshot(recordRef, (docSnap) => {
        if (docSnap.exists()) {
            setRecord({ id: docSnap.id, ...docSnap.data() } as StorageRecord);
        } else {
            setRecord(null);
        }
        setLoadingRecord(false);
    }, (e) => {
        console.error("Error fetching storage record:", e);
        setLoadingRecord(false);
    });
    return () => unsubscribe();
  }, [firestore, recordId]);

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

  const latestOutflow = record?.outflows && record.outflows.length > 0
    ? record.outflows[record.outflows.length - 1]
    : null;
  
  const deliveryOrderNo = record?.outflows && record.outflows.length > 0
    ? `${record.id}-${record.outflows.length}`
    : `${record.id}-1`;

  const deliveryOrderDate = latestOutflow ? toDate(latestOutflow.date) : new Date();

  const cleanRecord = {
    ...record,
    storageStartDate: toDate(record.storageStartDate),
    storageEndDate: record.storageEndDate ? toDate(record.storageEndDate) : null,
    payments: (record.payments || []).map(p => ({...p, date: toDate(p.date)})),
  };

  return (
    <div className="bg-gray-100 min-h-screen">
       <PrintHeader title={`Outflow Bill #${deliveryOrderNo}`} />
       <main className="p-4 sm:p-8 flex justify-center">
        <OutflowReceipt 
            record={cleanRecord} 
            customer={customer}
            warehouseInfo={warehouseInfo}
            withdrawnBags={withdrawnBags}
            finalRent={finalRent}
            paidNow={paidNow}
            discount={discount}
            deliveryOrderNo={deliveryOrderNo}
            deliveryOrderDate={deliveryOrderDate}
        />
      </main>
    </div>
  );
}
