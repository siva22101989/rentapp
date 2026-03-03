'use client';
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/shared/page-header";
import { CustomReportGenerator } from "@/components/reports/custom-report-generator";
import type { Customer, StorageRecord, UnloadingRecord, Expense } from "@/lib/definitions";
import { useCollection } from "@/firebase/firestore/use-collection";
import { collection } from "firebase/firestore";
import { useFirestore } from "@/firebase/provider";
import { useMemoFirebase } from "@/hooks/use-memo-firebase";
import { useSearchParams } from "next/navigation";

export default function ReportsPage() {
    const firestore = useFirestore();
    const searchParams = useSearchParams();

    const initialReport = searchParams.get('report') || undefined;
    const initialCustomerId = searchParams.get('customerId') || undefined;

    const recordsQuery = useMemoFirebase(
      () => (firestore ? collection(firestore, 'storageRecords') : null),
      [firestore]
    );
    const { data: allRecords, loading: loadingRecords } = useCollection<StorageRecord>(recordsQuery);

    const customersQuery = useMemoFirebase(
        () => (firestore ? collection(firestore, 'customers') : null),
        [firestore]
    );
    const { data: allCustomers, loading: loadingCustomers } = useCollection<Customer>(customersQuery);

    const unloadingRecordsQuery = useMemoFirebase(
      () => (firestore ? collection(firestore, 'unloadingRecords') : null),
      [firestore]
    );
    const { data: allUnloadingRecords, loading: loadingUnloadingRecords } = useCollection<UnloadingRecord>(unloadingRecordsQuery);
    
    const expensesQuery = useMemoFirebase(
      () => (firestore ? collection(firestore, 'expenses') : null),
      [firestore]
    );
    const { data: allExpenses, loading: loadingExpenses } = useCollection<Expense>(expensesQuery);


    if (loadingRecords || loadingCustomers || loadingUnloadingRecords || loadingExpenses) {
        return <AppLayout><div>Loading...</div></AppLayout>;
    }
    
  return (
    <AppLayout>
      <PageHeader
        title="Custom Reports"
        description="Select the report type to generate a detailed analysis."
      />
      <CustomReportGenerator 
        records={allRecords || []} 
        customers={allCustomers || []} 
        unloadingRecords={allUnloadingRecords || []}
        expenses={allExpenses || []}
        initialReport={initialReport}
        initialCustomerId={initialCustomerId}
      />
    </AppLayout>
  );
}
