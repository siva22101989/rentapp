
'use client';
import { PrintHeader } from "@/components/shared/print-header";
import { UnloadingReceipt } from "@/components/unloading/unloading-receipt";
import { notFound, useParams } from "next/navigation";
import type { Customer, UnloadingRecord, WarehouseInfo } from "@/lib/definitions";
import { useFirestore } from "@/firebase/provider";
import { doc, getDoc } from "firebase/firestore";
import { useMemoFirebase } from "@/hooks/use-memo-firebase";
import { Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { toDate } from "@/lib/utils";
import { useDoc } from "@/firebase/firestore/use-doc";
import { Button } from "@/components/ui/button";
import { useAppUser } from "@/firebase/auth/use-user";

export default function UnloadingReceiptPage() {
  const params = useParams();
  const unloadingId = params.unloadingId as string;
  const firestore = useFirestore();
  const { appUser } = useAppUser();

  const [record, setRecord] = useState<UnloadingRecord | null>(null);
  const [loadingRecord, setLoadingRecord] = useState(true);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loadingCustomer, setLoadingCustomer] = useState(true);
  const [error, setError] = useState<string|null>(null);

  useEffect(() => {
    if (!firestore || !unloadingId || !appUser?.warehouseId) {
      setLoadingRecord(false);
      return;
    }
    const recordRef = doc(firestore, 'unloadingRecords', unloadingId);
    let attempts = 0;
    const maxAttempts = 20;
    const intervalTime = 1000;

    const pollDocument = async () => {
      attempts++;
      try {
        const docSnap = await getDoc(recordRef);
        if (docSnap.exists() && docSnap.data().warehouseId === appUser.warehouseId) {
          setRecord({ id: docSnap.id, ...docSnap.data() } as UnloadingRecord);
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
  }, [firestore, unloadingId, appUser]);

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
    unloadingDate: toDate(record.unloadingDate),
  }

  return (
    <div className="bg-gray-100 min-h-screen">
      <PrintHeader title={`Unloading Bill #${record.billNo}`} filename={`unloading-bill-${record.billNo}.pdf`} />
      <main className="p-4 sm:p-8 flex justify-center printable-area">
        <UnloadingReceipt record={cleanRecord} customer={customer} warehouseInfo={warehouseInfo} />
      </main>
    </div>
  );
}
