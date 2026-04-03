'use client';
import { AppLayout } from "@/components/layout/app-layout";
<<<<<<< HEAD
import { CustomReportGenerator } from "@/components/reports/custom-report-generator";
import type { Customer, StorageRecord, UnloadingRecord, Expense, WarehouseInfo, Borrowing, Lending, OtherIncome } from "@/lib/definitions";
import { useCollection } from "@/firebase/firestore/use-collection";
import { collection, doc } from "firebase/firestore";
import { useFirestore } from "@/firebase/provider";
import { useMemoFirebase } from "@/hooks/use-memo-firebase";
import { useSearchParams } from "next/navigation";
import { useDoc } from "@/firebase/firestore/use-doc";

export default function ReportsPage() {
    const firestore = useFirestore();
    const searchParams = useSearchParams();
=======
import { PageHeader } from "@/components/shared/page-header";
import { ReportClient } from "@/components/reports/report-client";
import type { Customer, StorageRecord } from "@/lib/definitions";
import { useCollection } from "@/firebase/firestore/use-collection";
import { collection } from "firebase/firestore";
import { useFirestore } from "@/firebase";

export default function ReportsPage() {
    const firestore = useFirestore();
    const { data: allRecords, loading: recordsLoading } = useCollection<StorageRecord>(
      firestore ? collection(firestore, 'storageRecords') : null
    );
    const { data: allCustomers, loading: customersLoading } = useCollection<Customer>(
      firestore ? collection(firestore, 'customers') : null
    );
    
    const loading = recordsLoading || customersLoading;
>>>>>>> 493f64cf071699c798704dd512006dc35618f02c

    const initialReport = searchParams.get('report') || undefined;
    const initialCustomerId = searchParams.get('customerId') || undefined;

    // Existing queries
    const recordsQuery = useMemoFirebase(() => (firestore ? collection(firestore, 'storageRecords') : null), [firestore]);
    const { data: allRecords, loading: loadingRecords } = useCollection<StorageRecord>(recordsQuery);

    const customersQuery = useMemoFirebase(() => (firestore ? collection(firestore, 'customers') : null), [firestore]);
    const { data: allCustomers, loading: loadingCustomers } = useCollection<Customer>(customersQuery);

    const unloadingRecordsQuery = useMemoFirebase(() => (firestore ? collection(firestore, 'unloadingRecords') : null), [firestore]);
    const { data: allUnloadingRecords, loading: loadingUnloadingRecords } = useCollection<UnloadingRecord>(unloadingRecordsQuery);
    
    const expensesQuery = useMemoFirebase(() => (firestore ? collection(firestore, 'expenses') : null), [firestore]);
    const { data: allExpenses, loading: loadingExpenses } = useCollection<Expense>(expensesQuery);

    // New queries
    const warehouseInfoRef = useMemoFirebase(() => (firestore ? doc(firestore, 'settings', 'main') : null), [firestore]);
    const { data: warehouseInfo, loading: loadingWarehouseInfo } = useDoc<WarehouseInfo>(warehouseInfoRef);

    const borrowingsQuery = useMemoFirebase(() => (firestore ? collection(firestore, 'borrowings') : null), [firestore]);
    const { data: borrowings, loading: loadingBorrowings } = useCollection<Borrowing>(borrowingsQuery);
    
    const lendingsQuery = useMemoFirebase(() => (firestore ? collection(firestore, 'lendings') : null), [firestore]);
    const { data: lendings, loading: loadingLendings } = useCollection<Lending>(lendingsQuery);
    
    const otherIncomesQuery = useMemoFirebase(() => (firestore ? collection(firestore, 'otherIncomes') : null), [firestore]);
    const { data: otherIncomes, loading: loadingOtherIncomes } = useCollection<OtherIncome>(otherIncomesQuery);


    if (loadingRecords || loadingCustomers || loadingUnloadingRecords || loadingExpenses || loadingWarehouseInfo || loadingBorrowings || loadingLendings || loadingOtherIncomes) {
        return <AppLayout><div>Loading...</div></AppLayout>;
    }
    
  return (
    <AppLayout>
      <CustomReportGenerator 
        records={allRecords || []} 
        customers={allCustomers || []} 
        unloadingRecords={allUnloadingRecords || []} 
        expenses={allExpenses || []}
        warehouseInfo={warehouseInfo}
        borrowings={borrowings || []}
        lendings={lendings || []}
        otherIncomes={otherIncomes || []}
        initialReport={initialReport}
        initialCustomerId={initialCustomerId}
      />
    </AppLayout>
  );
}
