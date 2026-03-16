
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
import { Download, Loader2, Printer } from "lucide-react";
import { useRef, useState } from "react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

export default function OutflowReceiptPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const recordId = params.recordId as string;
  const firestore = useFirestore();

  const receiptRef = useRef<HTMLDivElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);

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


  const latestOutflow = record?.outflows && record.outflows.length > 0
    ? record.outflows[record.outflows.length - 1]
    : null;
  
  const deliveryOrderNo = record?.outflows && record.outflows.length > 0
    ? `${record.id}-${record.outflows.length}`
    : `${record.id}-1`;

  const deliveryOrderDate = latestOutflow ? toDate(latestOutflow.date) : new Date();

  const handleDownloadPdf = async () => {
    const element = receiptRef.current;
    if (!element) return;

    setIsGenerating(true);

    try {
      const canvas = await html2canvas(element, { 
        scale: 2, 
        useCORS: true, 
        backgroundColor: '#ffffff',
        windowWidth: element.scrollWidth,
        windowHeight: element.scrollHeight
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = imgWidth / imgHeight;
      let widthInPdf = pdfWidth - 20;
      let heightInPdf = widthInPdf / ratio;

      if (heightInPdf > pdfHeight - 20) {
        heightInPdf = pdfHeight - 20;
        widthInPdf = heightInPdf * ratio;
      }

      const x = (pdfWidth - widthInPdf) / 2;
      const y = 10;

      pdf.addImage(imgData, 'PNG', x, y, widthInPdf, heightInPdf);
      pdf.save(`outflow-bill-${deliveryOrderNo}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePrint = () => {
    window.print();
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
        title="Outflow Receipt"
        description={`Final bill for storage record ${record.id}`}
      >
        <Button variant="outline" onClick={handlePrint}>
            <Printer className="mr-2 h-4 w-4" />
            Print
        </Button>
        <Button onClick={handleDownloadPdf} disabled={isGenerating}>
            {isGenerating ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>
            ) : (
                <><Download className="mr-2 h-4 w-4" /> Save as PDF</>
            )}
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
