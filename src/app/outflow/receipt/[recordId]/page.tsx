'use client';
import { PrintHeader } from "@/components/shared/print-header";
import { OutflowReceipt } from "@/components/outflow/outflow-receipt";
import { notFound, useParams, useSearchParams } from "next/navigation";
import type { Customer, StorageRecord, WarehouseInfo } from "@/lib/definitions";
import { useFirestore } from "@/firebase/provider";
import { doc, getDoc } from "firebase/firestore";
import { useMemoFirebase } from "@/hooks/use-memo-firebase";
import { toDate } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { useDoc } from "@/firebase/firestore/use-doc";
import { Button } from "@/components/ui/button";
import { useAppUser } from "@/firebase/auth/use-user";

export default function OutflowReceiptPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const recordId = params.recordId as string;
  const firestore = useFirestore();
  const appUser = useAppUser();

  const [record, setRecord] = useState<StorageRecord | null>(null);
  const [loadingRecord, setLoadingRecord] = useState(true);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loadingCustomer, setLoadingCustomer] = useState(true);
  const [error, setError] = useState<string|null>(null);

  const withdrawnBags = Number(searchParams.get('withdrawn')) || 0;
  const finalRent = Number(searchParams.get('rent')) || 0;
  const paidNow = Number(searchParams.get('paidNow')) || 0;
  const discount = Number(searchParams.get('discount')) || 0;

  useEffect(() => {
    if (!firestore || !recordId || !appUser) {
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
  }, [firestore, recordId, appUser]);

  useEffect(() => {
    async function fetchCustomer() {
        if (!firestore || !record?.customerId || !appUser) {
            setLoadingCustomer(false);
            return;
        }
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
    }
    fetchCustomer();
  }, [firestore, record, appUser]);


  const warehouseInfoRef = useMemoFirebase(
    () => (firestore && appUser ? doc(firestore, 'settings', 'main') : null),
    [firestore, appUser]
  );
  const { data: warehouseInfo, loading: loadingWarehouseInfo } = useDoc<WarehouseInfo>(warehouseInfoRef);


  if (loadingRecord || loadingCustomer || loadingWarehouseInfo) {
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
       <PrintHeader title={`Outflow Bill #${deliveryOrderNo}`} filename={`outflow-bill-${deliveryOrderNo}.pdf`} />
       <main className="p-4 sm:p-8 flex justify-center printable-area">
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
