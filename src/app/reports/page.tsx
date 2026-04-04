
'use client';
import { AppLayout } from "@/components/layout/app-layout";
import { CustomReportGenerator } from "@/components/reports/custom-report-generator";
import type { Customer, StorageRecord, UnloadingRecord, Expense, WarehouseInfo, Borrowing, Lending, OtherIncome } from "@/lib/definitions";
import { useCollection } from "@/firebase/firestore/use-collection";
import { collection, doc } from "firebase/firestore";
import { useFirestore } from "@/firebase/provider";
import { useMemoFirebase } from "@/hooks/use-memo-firebase";
import { useSearchParams } from "next/navigation";
import { useDoc } from "@/firebase/firestore/use-doc";
import { useAppUser } from "@/firebase/auth/use-user";

export default function ReportsPage() {
    const firestore = useFirestore();
    const appUser = useAppUser();
    const searchParams = useSearchParams();

    const initialReport = searchParams.get('report') || undefined;
    const initialCustomerId = searchParams.get('customerId') || undefined;

    const recordsQuery = useMemoFirebase(() => (firestore && appUser?.warehouseId ? collection(firestore, 'managedWarehouses', appUser.warehouseId, 'storageRecords') : null), [firestore, appUser]);
    const { data: allRecords, loading: loadingRecords } = useCollection<StorageRecord>(recordsQuery);

    const customersQuery = useMemoFirebase(() => (firestore && appUser?.warehouseId ? collection(firestore, 'managedWarehouses', appUser.warehouseId, 'customers') : null), [firestore, appUser]);
    const { data: allCustomers, loading: loadingCustomers } = useCollection<Customer>(customersQuery);

    const unloadingRecordsQuery = useMemoFirebase(() => (firestore && appUser?.warehouseId ? collection(firestore, 'managedWarehouses', appUser.warehouseId, 'unloadingRecords') : null), [firestore, appUser]);
    const { data: allUnloadingRecords, loading: loadingUnloadingRecords } = useCollection<UnloadingRecord>(unloadingRecordsQuery);
    
    const expensesQuery = useMemoFirebase(() => (firestore && appUser?.warehouseId ? collection(firestore, 'managedWarehouses', appUser.warehouseId, 'expenses') : null), [firestore, appUser]);
    const { data: allExpenses, loading: loadingExpenses } = useCollection<Expense>(expensesQuery);

    const warehouseInfoRef = useMemoFirebase(() => (firestore && appUser?.warehouseId ? doc(firestore, 'managedWarehouses', appUser.warehouseId, 'settings', 'main') : null), [firestore, appUser]);
    const { data: warehouseInfo, loading: loadingWarehouseInfo } = useDoc<WarehouseInfo>(warehouseInfoRef);

    const borrowingsQuery = useMemoFirebase(() => (firestore && appUser?.warehouseId ? collection(firestore, 'managedWarehouses', appUser.warehouseId, 'borrowings') : null), [firestore, appUser]);
    const { data: borrowings, loading: loadingBorrowings } = useCollection<Borrowing>(borrowingsQuery);
    
    const lendingsQuery = useMemoFirebase(() => (firestore && appUser?.warehouseId ? collection(firestore, 'managedWarehouses', appUser.warehouseId, 'lendings') : null), [firestore, appUser]);
    const { data: lendings, loading: loadingLendings } = useCollection<Lending>(lendingsQuery);
    
    const otherIncomesQuery = useMemoFirebase(() => (firestore && appUser?.warehouseId ? collection(firestore, 'managedWarehouses', appUser.warehouseId, 'otherIncomes') : null), [firestore, appUser]);
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
