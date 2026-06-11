'use client';
import { PrintHeader } from "@/components/shared/print-header";
import { OutflowReceipt } from "@/components/outflow/outflow-receipt";
import { useSearchParams } from "next/navigation";
import type { Customer, StorageRecord, WarehouseInfo, Outflow } from "@/lib/definitions";
import { useFirestore } from "@/firebase/provider";
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";
import { useMemoFirebase } from "@/hooks/use-memo-firebase";
import { toDate } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { useDoc } from "@/firebase/firestore/use-doc";
import { Button } from "@/components/ui/button";
import { useAppUser } from "@/firebase/auth/use-user";

export default function OutflowReceiptPage() {
  const searchParams = useSearchParams();
  const pattiNo = searchParams.get('pattiNo');
  const recordIdFallback = searchParams.get('recordId'); // For single-record legacy links
  
  const firestore = useFirestore();
  const appUser = useAppUser();

  const [records, setRecords] = useState<StorageRecord[]>([]);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string|null>(null);

  // Parse numeric values from URL (often used for immediate generation)
  const paidNowFromUrl = parseFloat(searchParams.get('paidNow') || '0') || 0;

  useEffect(() => {
    async function fetchData() {
        if (!firestore || !appUser?.warehouseId || (!pattiNo && !recordIdFallback)) {
            setLoading(false);
            return;
        }

        try {
            let foundRecords: StorageRecord[] = [];
            
            // 1. Fetch Records for the Patti
            if (pattiNo) {
                const q = query(collection(firestore, 'storageRecords'), where('warehouseId', '==', appUser.warehouseId));
                const snap = await getDocs(q);
                foundRecords = snap.docs
                    .map(d => ({ id: d.id, ...d.data() } as StorageRecord))
                    .filter(r => Array.isArray(r.outflows) && r.outflows.some(o => String(o.pattiNo) === String(pattiNo)));
            } else if (recordIdFallback) {
                const dRef = doc(firestore, 'storageRecords', recordIdFallback);
                const dSnap = await getDoc(dRef);
                if (dSnap.exists() && dSnap.data().warehouseId === appUser.warehouseId) {
                    foundRecords = [{ id: dSnap.id, ...dSnap.data() } as StorageRecord];
                }
            }

            if (foundRecords.length === 0) {
                setError("Bill not found.");
                setLoading(false);
                return;
            }

            setRecords(foundRecords);

            // 2. Fetch Customer (assume all records in patti belong to same customer)
            const customerId = foundRecords[0].customerId;
            const cRef = doc(firestore, 'customers', customerId);
            const cSnap = await getDoc(cRef);
            if (cSnap.exists()) {
                setCustomer({ id: cSnap.id, ...cSnap.data() } as Customer);
            }

            setLoading(false);
        } catch (err) {
            console.error("Fetch error:", err);
            setError("Failed to load bill data.");
            setLoading(false);
        }
    }
    fetchData();
  }, [firestore, pattiNo, recordIdFallback, appUser]);

  const warehouseInfoRef = useMemoFirebase(
    () => (firestore && appUser?.warehouseId ? doc(firestore, 'warehouses', appUser.warehouseId) : null),
    [firestore, appUser]
  );
  const { data: warehouseInfo, loading: loadingWarehouse } = useDoc<WarehouseInfo>(warehouseInfoRef);

  if (loading || loadingWarehouse) {
    return (
        <div className="flex h-screen w-full items-center justify-center bg-gray-50">
            <div className="flex flex-col items-center gap-2">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-muted-foreground font-bold animate-pulse">Building Consolidated Bill...</p>
            </div>
        </div>
    );
  }

  if (error || records.length === 0 || !customer) {
    return (
        <div className="flex h-screen w-full items-center justify-center bg-gray-50 p-4">
            <div className="text-center bg-white p-8 rounded-xl shadow-lg border">
                <h1 className="text-2xl font-bold text-destructive">Bill Search Failed</h1>
                <p className="text-muted-foreground mt-2 max-w-sm">{error || "The requested consolidated receipt could not be located."}</p>
                 <Button onClick={() => window.close()} className="mt-6 w-full">Close Bill View</Button>
            </div>
        </div>
    );
  }

  return (
    <div className="bg-gray-100 min-h-screen">
       <PrintHeader title={`Outflow Bill #${pattiNo || records[0].id}`} filename={`patti-bill-${pattiNo || records[0].id}.pdf`} />
       <main className="p-4 sm:p-8 flex justify-center printable-area">
        <OutflowReceipt 
            records={records} 
            customer={customer}
            warehouseInfo={warehouseInfo}
            pattiNo={pattiNo || String(records[0].id)}
            paidNow={paidNowFromUrl}
        />
      </main>
    </div>
  );
}
