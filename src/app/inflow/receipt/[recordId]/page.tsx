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
import { Button } from "@/components/ui/button";
import { Loader2, MessageSquare } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function InflowReceiptPage() {
  const params = useParams();
  const recordId = params.recordId as string;
  const firestore = useFirestore();

  const { toast } = useToast();
  const [unloadingRecord, setUnloadingRecord] = useState<UnloadingRecord | null>(null);
  const [loadingUnloading, setLoadingUnloading] = useState(true);
  const [isSendingSms, setIsSendingSms] = useState(false);

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

  const handleSendSms = async () => {
    if (!customer?.phone) {
      toast({
        variant: 'destructive',
        title: 'No Phone Number',
        description: 'This customer does not have a phone number on file.',
      });
      return;
    }
    setIsSendingSms(true);
    // Simulate sending SMS. In a real app, you'd call a server action here.
    await new Promise(resolve => setTimeout(resolve, 1500));
    setIsSendingSms(false);
    toast({
      title: 'SMS Sent',
      description: `An SMS notification has been sent to ${customer.phone}.`,
    });
  };

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
      >
        <Button variant="outline" onClick={handleSendSms} disabled={isSendingSms}>
            {isSendingSms ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending...</>
            ) : (
                <><MessageSquare className="mr-2 h-4 w-4" /> Send SMS</>
            )}
        </Button>
      </PageHeader>
      <div className="flex justify-center">
        <InflowReceipt record={record} customer={customer} warehouseInfo={warehouseInfo} unloadingRecord={unloadingRecord || undefined} />
      </div>
    </AppLayout>
  );
}
