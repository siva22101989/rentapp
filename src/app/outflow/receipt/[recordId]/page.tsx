
'use client';
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/shared/page-header";
import { OutflowReceipt } from "@/components/outflow/outflow-receipt";
import { notFound, useParams, useSearchParams } from "next/navigation";
import type { Customer, StorageRecord, WarehouseInfo } from "@/lib/definitions";
import { useDoc } from "@/firebase/firestore/use-doc";
import { useFirestore } from "@/firebase/provider";
import { doc } from "firebase/firestore";
import { useMemoFirebase } from "@/hooks/use-memo-firebase";
import { toDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Download, Loader2, Printer, MessageSquare } from "lucide-react";
import { useRef, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { printElement } from "@/lib/print-util";

export default function OutflowReceiptPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const recordId = params.recordId as string;
  const firestore = useFirestore();

  const { toast } = useToast();
  const receiptRef = useRef<HTMLDivElement>(null);
  const [isSendingSms, setIsSendingSms] = useState(false);

  const withdrawnBags = Number(searchParams.get('withdrawn')) || 0;
  const finalRent = Number(searchParams.get('rent')) || 0;
  const paidNow = Number(searchParams.get('paidNow')) || 0;
  const discount = Number(searchParams.get('discount')) || 0;

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


  if (loadingRecord || loadingCustomer || loadingWarehouseInfo) {
    return <AppLayout><div>Loading...</div></AppLayout>;
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
    printElement(element, `Outflow Bill ${deliveryOrderNo}`);
  };

  return (
    <AppLayout>
      <PageHeader
        title="Outflow Receipt"
        description={`Final bill for storage record ${record.id}`}
      >
        <Button variant="outline" onClick={handleSendSms} disabled={isSendingSms}>
            {isSendingSms ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending...</>
            ) : (
                <><MessageSquare className="mr-2 h-4 w-4" /> Send SMS</>
            )}
        </Button>
        <Button variant="outline" onClick={handleGenerate}>
            <Printer className="mr-2 h-4 w-4" />
            Print
        </Button>
        <Button onClick={handleGenerate}>
            <Download className="mr-2 h-4 w-4" />
            Download PDF
        </Button>
      </PageHeader>
      <div className="flex justify-center">
        <OutflowReceipt 
            ref={receiptRef}
            record={record} 
            customer={customer}
            warehouseInfo={warehouseInfo}
            withdrawnBags={withdrawnBags}
            finalRent={finalRent}
            paidNow={paidNow}
            discount={discount}
            deliveryOrderNo={deliveryOrderNo}
            deliveryOrderDate={deliveryOrderDate}
        />
      </div>
    </AppLayout>
  );
}
