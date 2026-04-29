
'use client';
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/shared/page-header";
import { AddCustomerDialog } from "@/components/customers/add-customer-dialog";
import type { Customer } from "@/lib/definitions";
import { useCollection, useFirestore, useAppUser } from "@/firebase";
import { collection, query, where } from "firebase/firestore";
import { useMemoFirebase } from "@/hooks/use-memo-firebase";
import { CustomersTable } from "@/components/customers/customers-table";

export default function CustomersPage() {
  const firestore = useFirestore();
  const appUser = useAppUser();
  const canAdd = appUser?.role !== 'super-admin';
  
  const customersQuery = useMemoFirebase(
    () => (firestore && appUser?.warehouseId ? query(collection(firestore, 'customers'), where('warehouseId', '==', appUser.warehouseId)) : null),
    [firestore, appUser]
  );
  const { data: customers, loading: loadingCustomers } = useCollection<Customer>(customersQuery);

  if (loadingCustomers) {
    return <AppLayout><div>Loading...</div></AppLayout>;
  }

  return (
    <AppLayout>
      <PageHeader
        title="Customers"
        description="Manage your customers."
      >
        {canAdd && <AddCustomerDialog />}
      </PageHeader>
      <CustomersTable customers={customers || []} />
    </AppLayout>
  );
}
