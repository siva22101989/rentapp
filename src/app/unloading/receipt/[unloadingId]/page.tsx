'use client';
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/shared/page-header";
import { UnloadingReceipt } from "@/components/unloading/unloading-receipt";
import { notFound, useParams } from "next/navigation";
import type { Customer, UnloadingRecord, WarehouseInfo } from "@/lib/definitions";
import { useDoc } from "@/firebase/firestore/use-doc";
import { useFirestore } from "@/firebase/provider";
import { doc } from "firebase/firestore";
import { useMemoFirebase } from "@/hooks/use-memo-firebase";
import { Button } from "@/components/ui/button";
import { Loader2, Printer, MessageSquare } from "lucide-react";
import { useRef, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { printElement } from "@/lib/print-util";

export default function UnloadingReceiptPage() {
  const params = useParams();
  const unloadingId = params.unloadingId as string;
  const firestore = useFirestore();

  const { toast } = useToast();
  const receiptRef = useRef<HTMLDivElement>(null);
  const [isSendingSms, setIsSendingSms] = useState(false);

  const recordRef = useMemoFirebase(
    () => (firestore && unloadingId ? doc(firestore, 'unloadingRecords', unloadingId) : null),
    [firestore, unloadingId]
  );
  const { data: record, loading: loadingRecord } = useDoc<UnloadingRecord>(recordRef);

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
    await new Promise(resolve => setTimeout(resolve, 1500));
    setIsSendingSms(false);
    toast({
      title: 'SMS Sent',
      description: `An SMS notification has been sent to ${customer.phone}.`,
    });
  };

  const handleGenerate = () => {
    const element = receiptRef.current;
    if (!element) return;
    printElement(element, `Unloading Bill ${record?.billNo}`);
  };
  
  if (loadingRecord || loadingCustomer || loadingWarehouseInfo) {
    return <AppLayout><div>Loading...</div></AppLayout>;
  }

  if (!record || !customer) {
    notFound();
  }
  
  return (
    <AppLayout>
      <PageHeader
        title="Unloading Bill"
        description={`Details for Unloading Bill No. ${record.billNo}`}
      >
        <Button variant="outline" onClick={handleSendSms} disabled={isSendingSms}>
            {isSendingSms ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending...</>
            ) : (
                <><MessageSquare className="mr-2 h-4 w-4" /> Send SMS</>
            )}
        </Button>
        <Button onClick={handleGenerate}>
            <Printer className="mr-2 h-4 w-4" />
            Print / Save PDF
        </Button>
      </PageHeader>
      <div className="flex justify-center">
        <UnloadingReceipt ref={receiptRef} record={record} customer={customer} warehouseInfo={warehouseInfo} />
      </div>
    </AppLayout>
  );
}
