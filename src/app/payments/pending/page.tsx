'use client';
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/shared/page-header";
import type { Customer, StorageRecord, UnloadingRecord, Expense, CustomerPayment } from "@/lib/definitions";
import { useCollection } from "@/firebase/firestore/use-collection";
import { collection, query, where } from "firebase/firestore";
import { useFirestore } from "@/firebase/provider";
import { useMemoFirebase } from "@/hooks/use-memo-firebase";
import { PendingPaymentsTable } from "@/components/payments/pending-payments-table";
import { CustomerBulkPaymentDialog } from "@/components/payments/customer-bulk-payment-dialog";
import { useAppUser } from "@/firebase/auth/use-user";
import { RecordHamaliPaymentDialog } from "@/components/hamali/record-payment-dialog";
import { Button } from "@/components/ui/button";
import { Hammer, Loader2 } from "lucide-react";
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

    const customerPaymentsQuery = useMemoFirebase(
      () => (firestore && appUser?.warehouseId ? query(collection(firestore, 'customerPayments'), where('warehouseId', '==', appUser.warehouseId)) : null),
      [firestore, appUser]
    );
    const { data: customerPayments, loading: loadingPayments } = useCollection<CustomerPayment>(customerPaymentsQuery);


    if (loadingRecords || loadingCustomers || loadingUnloadingRecords || loadingExpenses || loadingPayments) {
        return (
            <AppLayout>
                <div className="flex h-[60vh] w-full items-center justify-center">
                    <div className="flex flex-col items-center gap-2">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        <p className="text-muted-foreground font-medium">Synchronizing pending dues...</p>
                    </div>
                </div>
            </AppLayout>
        );
    }

    return (
        <AppLayout>
            <PageHeader
                title="Pending Dues Management"
                description="Monitor and collect outstanding hamali and rent balances."
            >
              {canInteract && (
                <div className="flex items-center gap-2 flex-wrap">
                  <SendReminderSmsDialog 
                      customers={allCustomers || []}
                      storageRecords={allRecords || []}
                      unloadingRecords={allUnloadingRecords || []}
                      customerPayments={customerPayments || []}
                  />
                  <CustomerBulkPaymentDialog
                      customers={allCustomers || []}
                      storageRecords={allRecords || []}
                      unloadingRecords={allUnloadingRecords || []}
                      customerPayments={customerPayments || []}
                  />
                  <RecordHamaliPaymentDialog>
                      <Button variant="outline">
                          <Hammer className="mr-2 h-4 w-4" />
                          Record Hamali Payment
                      </Button>
                  </RecordHamaliPaymentDialog>
                </div>
              )}
            </PageHeader>
            <div className="flex-1 overflow-auto">
                <PendingPaymentsTable 
                    records={allRecords || []} 
                    customers={allCustomers || []} 
                    unloadingRecords={allUnloadingRecords || []}
                    customerPayments={customerPayments || []}
                />
            </div>
        </AppLayout>
    );
}