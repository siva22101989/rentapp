'use client';
import { PrintHeader } from "@/components/shared/print-header";
import { OutflowReceipt } from "@/components/outflow/outflow-receipt";
import { useSearchParams } from "next/navigation";
import type { Customer, StorageRecord, WarehouseInfo, UnloadingRecord, CustomerPayment } from "@/lib/definitions";
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
  const recordIdFallback = searchParams.get('recordId'); 
  
  const firestore = useFirestore();
  const appUser = useAppUser();

  const [records, setRecords] = useState<StorageRecord[]>([]);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [outstandingDues, setOutstandingDues] = useState({ rent: 0, hamali: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string|null>(null);

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
                    .filter(r => Array.isArray(r.outflows) && r.outflows.some(o => String(o.pattiNo).replace(/\D/g, '') === String(pattiNo).replace(/\D/g, '')));
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

            // 2. Fetch Customer
            const customerId = foundRecords[0].customerId;
            const cRef = doc(firestore, 'customers', customerId);
            const cSnap = await getDoc(cRef);
            if (cSnap.exists()) {
                setCustomer({ id: cSnap.id, ...cSnap.data() } as Customer);
            }

            // 3. Calculate Account-wide Outstanding Dues
            const allStorageQ = query(collection(firestore, 'storageRecords'), where('warehouseId', '==', appUser.warehouseId), where('customerId', '==', customerId));
            const allUnloadingQ = query(collection(firestore, 'unloadingRecords'), where('warehouseId', '==', appUser.warehouseId), where('customerId', '==', customerId));
            const allPaymentsQ = query(collection(firestore, 'customerPayments'), where('warehouseId', '==', appUser.warehouseId), where('customerId', '==', customerId));
            
            const [storageSnap, unloadingSnap, paymentsSnap] = await Promise.all([
                getDocs(allStorageQ),
                getDocs(allUnloadingQ),
                getDocs(allPaymentsQ)
            ]);

            let totalRentLiab = 0;
            let totalHamaliLiab = 0;
            let totalRentPaid = 0;
            let totalHamaliPaid = 0;

            storageSnap.docs.forEach(d => {
                const data = d.data() as StorageRecord;
                totalHamaliLiab += Number(data.hamaliPayable) || 0;
                totalRentLiab += (Number(data.totalRentBilled) || 0) + (Number(data.khataAmount) || 0);
                (data.payments || []).forEach(p => {
                    if (p.type === 'hamali' || p.type === 'unloading') totalHamaliPaid += (Number(p.amount) || 0);
                    else totalRentPaid += (Number(p.amount) || 0);
                });
            });

            unloadingSnap.docs.forEach(d => {
                const data = d.data() as UnloadingRecord;
                const remaining = Math.max(0, (data.bagsUnloaded || 0) - (data.bagsSentToDrying || 0));
                totalHamaliLiab += remaining * (data.hamaliPerBag || 0);
                (data.payments || []).forEach(p => {
                    totalHamaliPaid += (Number(p.amount) || 0);
                });
            });

            paymentsSnap.docs.forEach(d => {
                const data = d.data() as CustomerPayment;
                if (data.type === 'hamali') totalHamaliPaid += (Number(data.amount) || 0);
                else totalRentPaid += (Number(data.amount) || 0);
            });

            setOutstandingDues({
                rent: Math.max(0, totalRentLiab - totalRentPaid),
                hamali: Math.max(0, totalHamaliLiab - totalHamaliPaid)
            });

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
                <p className="text-muted-foreground font-bold animate-pulse uppercase tracking-widest text-[10px]">Reconciling Ledger...</p>
            </div>
        </div>
    );
  }

  if (error || records.length === 0 || !customer) {
    return (
        <div className="flex h-screen w-full items-center justify-center bg-gray-50 p-4">
            <div className="text-center bg-white p-8 rounded-xl shadow-lg border">
                <h1 className="text-2xl font-bold text-destructive uppercase tracking-tighter">Bill Search Failed</h1>
                <p className="text-muted-foreground mt-2 max-w-sm font-medium">{error || "The requested consolidated receipt could not be located."}</p>
                 <Button onClick={() => window.close()} className="mt-6 w-full font-bold uppercase tracking-widest">Close View</Button>
            </div>
        </div>
    );
  }

  return (
    <div className="bg-gray-100 min-h-screen">
       <PrintHeader title={`Outflow Bill #${pattiNo || records[0].id}`} filename={`outflow-bill-${pattiNo || records[0].id}.pdf`} />
       <main className="p-4 sm:p-8 flex justify-center printable-area">
        <OutflowReceipt 
            records={records} 
            customer={customer}
            warehouseInfo={warehouseInfo}
            pattiNo={pattiNo || String(records[0].id)}
            paidNow={paidNowFromUrl}
            outstandingRent={outstandingDues.rent}
            outstandingHamali={outstandingDues.hamali}
        />
      </main>
    </div>
  );
}
