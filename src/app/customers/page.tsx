
'use client';
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/shared/page-header";
import { AddCustomerDialog } from "@/components/customers/add-customer-dialog";
import type { Customer } from "@/lib/definitions";
import { useCollection } from "@/firebase/firestore/use-collection";
import { collection } from "firebase/firestore";
import { useFirestore } from "@/firebase/provider";
import { useMemoFirebase } from "@/hooks/use-memo-firebase";
import { CustomersTable } from "@/components/customers/customers-table";
import { useAppUser } from "@/firebase/auth/use-user";

export default function CustomersPage() {
  const firestore = useFirestore();
  const appUser = useAppUser();
  
  const customersQuery = useMemoFirebase(
    () => (firestore && appUser?.warehouseId ? collection(firestore, 'managedWarehouses', appUser.warehouseId, 'customers') : null),
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
        <AddCustomerDialog />
      </PageHeader>
      <CustomersTable customers={customers || []} />
    </AppLayout>
  );
}
