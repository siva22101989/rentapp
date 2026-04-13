
'use client';
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/shared/page-header";
import type { Customer, StorageRecord, UnloadingRecord, Expense } from "@/lib/definitions";
import { useCollection } from "@/firebase/firestore/use-collection";
import { collection } from "firebase/firestore";
import { useFirestore } from "@/firebase/provider";
import { useMemoFirebase } from "@/hooks/use-memo-firebase";
import { useAppUser } from "@/firebase/auth/use-user";
import { HamaliReport } from "@/components/reports/hamali-report";
import { RecordHamaliPaymentDialog } from "@/components/hamali/record-payment-dialog";
import { Button } from "@/components/ui/button";
import { Hammer } from "lucide-react";

export default function HamaliPage() {
    const firestore = useFirestore();
    const appUser = useAppUser();

    const recordsQuery = useMemoFirebase(() => (firestore && appUser ? collection(firestore, 'storageRecords') : null), [firestore, appUser]);
    const { data: allRecords, loading: loadingRecords } = useCollection<StorageRecord>(recordsQuery);

    const customersQuery = useMemoFirebase(() => (firestore && appUser ? collection(firestore, 'customers') : null), [firestore, appUser]);
    const { data: allCustomers, loading: loadingCustomers } = useCollection<Customer>(customersQuery);

    const unloadingRecordsQuery = useMemoFirebase(() => (firestore && appUser ? collection(firestore, 'unloadingRecords') : null), [firestore, appUser]);
    const { data: allUnloadingRecords, loading: loadingUnloadingRecords } = useCollection<UnloadingRecord>(unloadingRecordsQuery);
    
    const expensesQuery = useMemoFirebase(() => (firestore && appUser ? collection(firestore, 'expenses') : null), [firestore, appUser]);
    const { data: allExpenses, loading: loadingExpenses } = useCollection<Expense>(expensesQuery);


    if (loadingRecords || loadingCustomers || loadingUnloadingRecords || loadingExpenses) {
        return <AppLayout><div>Loading...</div></AppLayout>;
    }
    
  return (
    <AppLayout>
        <PageHeader
            title="Hamali Management"
            description="Track hamali payable to workers and record payments made."
        >
            <RecordHamaliPaymentDialog customers={allCustomers || []}>
                <Button>
                    <Hammer className="mr-2" />
                    Record Hamali Payment
                </Button>
            </RecordHamaliPaymentDialog>
        </PageHeader>
        <HamaliReport 
            records={allRecords || []} 
            customers={allCustomers || []} 
            unloadingRecords={allUnloadingRecords || []} 
            expenses={allExpenses || []}
        />
    </AppLayout>
  );
}
