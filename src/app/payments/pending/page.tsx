
'use client';
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/shared/page-header";
import type { Customer, StorageRecord, UnloadingRecord, Expense } from "@/lib/definitions";
import { useCollection } from "@/firebase/firestore/use-collection";
import { collection, query, where } from "firebase/firestore";
import { useFirestore } from "@/firebase/provider";
import { useMemoFirebase } from "@/hooks/use-memo-firebase";
import { PendingPaymentsTable } from "@/components/payments/pending-payments-table";
import { CustomerBulkPaymentDialog } from "@/components/payments/customer-bulk-payment-dialog";
import { useAppUser } from "@/firebase/auth/use-user";
import { RecordHamaliPaymentDialog } from "@/components/hamali/record-payment-dialog";
import { Button } from "@/components/ui/button";
import { Hammer } from "lucide-react";
import { SendReminderSmsDialog } from "@/components/payments/send-reminder-sms-dialog";

export default function PendingPaymentsPage() {
    const firestore = useFirestore();
    const appUser = useAppUser();
    const canInteract = appUser?.role !== 'super-admin';

    const recordsQuery = useMemoFirebase(
      () => (firestore && appUser?.warehouseId ? query(collection(firestore, 'storageRecords'), where('warehouseId', '==', appUser.warehouseId)) : null),
      [firestore, appUser]
    );
    const { data: allRecords, loading: loadingRecords } = useCollection<StorageRecord>(recordsQuery);

    const customersQuery = useMemoFirebase(
        () => (firestore && appUser?.warehouseId ? query(collection(firestore, 'customers'), where('warehouseId', '==', appUser.warehouseId)) : null),
        [firestore, appUser]
    );
    const { data: allCustomers, loading: loadingCustomers } = useCollection<Customer>(customersQuery);
    
    const unloadingRecordsQuery = useMemoFirebase(
        () => (firestore && appUser?.warehouseId ? query(collection(firestore, 'unloadingRecords'), where('warehouseId', '==', appUser.warehouseId)) : null),
        [firestore, appUser]
    );
    const { data: allUnloadingRecords, loading: loadingUnloadingRecords } = useCollection<UnloadingRecord>(unloadingRecordsQuery);
    
    const expensesQuery = useMemoFirebase(() => (firestore && appUser?.warehouseId ? query(collection(firestore, 'expenses'), where('warehouseId', '==', appUser.warehouseId)) : null), [firestore, appUser]);
    const { data: allExpenses, loading: loadingExpenses } = useCollection<Expense>(expensesQuery);


    if (loadingRecords || loadingCustomers || loadingUnloadingRecords || loadingExpenses) {
        return <AppLayout><div>Loading...</div></AppLayout>;
    }

    return (
        <AppLayout>
            <PageHeader
                title="Pending Payments"
                description="View all records with an outstanding balance."
            >
              {canInteract && (
                <>
                  <SendReminderSmsDialog 
                      customers={allCustomers || []}
                      storageRecords={allRecords || []}
                      unloadingRecords={allUnloadingRecords || []}
                  />
                  <CustomerBulkPaymentDialog
                      customers={allCustomers || []}
                      storageRecords={allRecords || []}
                      unloadingRecords={allUnloadingRecords || []}
                  />
                  <RecordHamaliPaymentDialog>
                      <Button variant="outline">
                          <Hammer className="mr-2" />
                          Record Hamali Payment
                      </Button>
                  </RecordHamaliPaymentDialog>
                </>
              )}
            </PageHeader>
            <PendingPaymentsTable 
                records={allRecords || []} 
                customers={allCustomers || []} 
                unloadingRecords={allUnloadingRecords || []}
            />
        </AppLayout>
    );
}
