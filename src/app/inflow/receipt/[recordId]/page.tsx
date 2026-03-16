
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
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Download, Loader2, Printer } from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

export default function InflowReceiptPage() {
  const params = useParams();
  const recordId = params.recordId as string;
  const firestore = useFirestore();

  const [unloadingRecord, setUnloadingRecord] = useState<UnloadingRecord | null>(null);
  const [loadingUnloading, setLoadingUnloading] = useState(true);
  const receiptRef = useRef<HTMLDivElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);

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
      pdf.save(`receipt-${recordId}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePrint = () => {
    window.print();
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
        <InflowReceipt ref={receiptRef} record={record} customer={customer} warehouseInfo={warehouseInfo} unloadingRecord={unloadingRecord || undefined} />
      </div>
    </AppLayout>
  );
}
