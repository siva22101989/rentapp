'use client';
import { PrintHeader } from "@/components/shared/print-header";
import { OutflowReceipt } from "@/components/outflow/outflow-receipt";
import { useSearchParams } from "next/navigation";
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
  const searchParams = useSearchParams();
  const recordId = searchParams.get('recordId');
  const firestore = useFirestore();
  const appUser = useAppUser();

  const [record, setRecord] = useState<StorageRecord | null>(null);
  const [loadingRecord, setLoadingRecord] = useState(true);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loadingCustomer, setLoadingCustomer] = useState(true);
  const [error, setError] = useState<string|null>(null);

  // Parse numeric values with defaults
  const withdrawnBags = parseFloat(searchParams.get('withdrawn') || '0') || 0;
  const finalRent = parseFloat(searchParams.get('rent') || '0') || 0;
  const paidNow = parseFloat(searchParams.get('paidNow') || '0') || 0;
  const discount = parseFloat(searchParams.get('discount') || '0') || 0;
  const khataAmountFromForm = searchParams.get('khata') !== null ? parseFloat(searchParams.get('khata') || '0') : null;

  useEffect(() => {
    if (!firestore || !recordId || !appUser?.warehouseId) {
      setLoadingRecord(false);
      return;
    }
    const recordRef = doc(firestore, 'storageRecords', recordId);
    let attempts = 0;
    const maxAttempts = 15;
    const intervalTime = 1000;

    const pollDocument = async () => {
      attempts++;
      try {
        const docSnap = await getDoc(recordRef);
        if (docSnap.exists() && docSnap.data().warehouseId === appUser.warehouseId) {
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
        if (!firestore || !record?.customerId || !appUser?.warehouseId) {
            setLoadingCustomer(false);
            return;
        }
        setLoadingCustomer(true);
        try {
            const customerRef = doc(firestore, 'customers', record.customerId);
            const customerSnap = await getDoc(customerRef);
            if (customerSnap.exists() && customerSnap.data().warehouseId === appUser.warehouseId) {
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
    () => (firestore && appUser?.warehouseId ? doc(firestore, 'warehouses', appUser.warehouseId) : null),
    [firestore, appUser]
  );
  const { data: warehouseInfo, loading: loadingWarehouseInfo } = useDoc<WarehouseInfo>(warehouseInfoRef);


  if (loadingRecord || loadingCustomer || loadingWarehouseInfo) {
    return (
        <div className="flex h-screen w-full items-center justify-center bg-gray-50">
            <div className="flex flex-col items-center gap-2">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-muted-foreground font-bold animate-pulse">Building your Patti Bill...</p>
            </div>
        </div>
    );
  }

  if (error || !record || !customer) {
    return (
        <div className="flex h-screen w-full items-center justify-center bg-gray-50 p-4">
            <div className="text-center bg-white p-8 rounded-xl shadow-lg border">
                <h1 className="text-2xl font-bold text-destructive">Bill Search Failed</h1>
                <p className="text-muted-foreground mt-2 max-w-sm">{error || "The requested withdrawal receipt could not be located in our system."}</p>
                 <Button onClick={() => window.close()} className="mt-6 w-full">Close Bill View</Button>
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
    khataAmount: khataAmountFromForm !== null ? khataAmountFromForm : record.khataAmount,
    storageStartDate: toDate(record.storageStartDate),
    storageEndDate: record.storageEndDate ? toDate(record.storageEndDate) : null,
    payments: (record.payments || []).map(p => ({...p, date: toDate(p.date)})),
  };

  return (
    <div className="bg-gray-100 min-h-screen">
       <PrintHeader title={`Withdrawal Bill #${deliveryOrderNo}`} filename={`outflow-bill-${deliveryOrderNo}.pdf`} />
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