
'use client';
import { AppLayout } from "@/components/layout/app-layout";
import { CustomReportGenerator } from "@/components/reports/custom-report-generator";
import type { Customer, StorageRecord, UnloadingRecord, Expense, WarehouseInfo, Borrowing, Lending, OtherIncome, Commodity, Lot, DryingRecord } from "@/lib/definitions";
import { useCollection } from "@/firebase/firestore/use-collection";
import { collection, doc, query, where } from "firebase/firestore";
import { useFirestore } from "@/firebase/provider";
import { useMemoFirebase } from "@/hooks/use-memo-firebase";
import { useSearchParams } from "next/navigation";
import { useDoc } from "@/firebase/firestore/use-doc";
import { useAppUser } from "@/firebase/auth/use-user";

export default function ReportsPage() {
    const firestore = useFirestore();
    const searchParams = useSearchParams();
    const appUser = useAppUser();

    const initialReport = searchParams.get('report') || undefined;
    const initialCustomerId = searchParams.get('customerId') || undefined;

    const recordsQuery = useMemoFirebase(() => (firestore && appUser?.warehouseId ? query(collection(firestore, 'storageRecords'), where('warehouseId', '==', appUser.warehouseId)) : null), [firestore, appUser]);
    const { data: allRecords, loading: loadingRecords } = useCollection<StorageRecord>(recordsQuery);

    const customersQuery = useMemoFirebase(() => (firestore && appUser?.warehouseId ? query(collection(firestore, 'customers'), where('warehouseId', '==', appUser.warehouseId)) : null), [firestore, appUser]);
    const { data: allCustomers, loading: loadingCustomers } = useCollection<Customer>(customersQuery);

    const unloadingRecordsQuery = useMemoFirebase(() => (firestore && appUser?.warehouseId ? query(collection(firestore, 'unloadingRecords'), where('warehouseId', '==', appUser.warehouseId)) : null), [firestore, appUser]);
    const { data: allUnloadingRecords, loading: loadingUnloadingRecords } = useCollection<UnloadingRecord>(unloadingRecordsQuery);
    
    const expensesQuery = useMemoFirebase(() => (firestore && appUser?.warehouseId ? query(collection(firestore, 'expenses'), where('warehouseId', '==', appUser.warehouseId)) : null), [firestore, appUser]);
    const { data: allExpenses, loading: loadingExpenses } = useCollection<Expense>(expensesQuery);

    const warehouseInfoRef = useMemoFirebase(() => (firestore && appUser?.warehouseId ? doc(firestore, 'warehouses', appUser.warehouseId) : null), [firestore, appUser]);
    const { data: warehouseInfo, loading: loadingWarehouseInfo } = useDoc<WarehouseInfo>(warehouseInfoRef);

    const borrowingsQuery = useMemoFirebase(() => (firestore && appUser?.warehouseId ? query(collection(firestore, 'borrowings'), where('warehouseId', '==', appUser.warehouseId)) : null), [firestore, appUser]);
    const { data: borrowings, loading: loadingBorrowings } = useCollection<Borrowing>(borrowingsQuery);
    
    const lendingsQuery = useMemoFirebase(() => (firestore && appUser?.warehouseId ? query(collection(firestore, 'lendings'), where('warehouseId', '==', appUser.warehouseId)) : null), [firestore, appUser]);
    const { data: lendings, loading: loadingLendings } = useCollection<Lending>(lendingsQuery);
    
    const otherIncomesQuery = useMemoFirebase(() => (firestore && appUser?.warehouseId ? query(collection(firestore, 'otherIncomes'), where('warehouseId', '==', appUser.warehouseId)) : null), [firestore, appUser]);
    const { data: otherIncomes, loading: loadingOtherIncomes } = useCollection<OtherIncome>(otherIncomesQuery);

    const commoditiesQuery = useMemoFirebase(() => (firestore && appUser?.warehouseId ? query(collection(firestore, 'commodities'), where('warehouseId', '==', appUser.warehouseId)) : null), [firestore, appUser]);
    const { data: allCommodities, loading: loadingCommodities } = useCollection<Commodity>(commoditiesQuery);

    const lotsQuery = useMemoFirebase(() => (firestore && appUser?.warehouseId ? query(collection(firestore, 'lots'), where('warehouseId', '==', appUser.warehouseId)) : null), [firestore, appUser]);
    const { data: lots, loading: loadingLots } = useCollection<Lot>(lotsQuery);

    const dryingRecordsQuery = useMemoFirebase(() => (firestore && appUser?.warehouseId ? query(collection(firestore, 'dryingRecords'), where('warehouseId', '==', appUser.warehouseId)) : null), [firestore, appUser]);
    const { data: dryingRecords, loading: loadingDryingRecords } = useCollection<DryingRecord>(dryingRecordsQuery);


    if (loadingRecords || loadingCustomers || loadingUnloadingRecords || loadingExpenses || loadingWarehouseInfo || loadingBorrowings || loadingLendings || loadingOtherIncomes || loadingCommodities || loadingLots || loadingDryingRecords) {
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
        commodities={allCommodities || []}
        initialReport={initialReport}
        initialCustomerId={initialCustomerId}
        dryingRecords={dryingRecords || []}
        lots={lots || []}
      />
    </AppLayout>
  );
}
