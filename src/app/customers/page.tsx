
'use client';
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/shared/page-header";
import { AddCustomerDialog } from "@/components/customers/add-customer-dialog";
<<<<<<< HEAD
import type { Customer } from "@/lib/definitions";
import { useCollection } from "@/firebase/firestore/use-collection";
import { collection } from "firebase/firestore";
import { useFirestore } from "@/firebase/provider";
import { useMemoFirebase } from "@/hooks/use-memo-firebase";
import { CustomersTable } from "@/components/customers/customers-table";
=======
import { useCollection } from "@/firebase/firestore/use-collection";
import type { Customer } from "@/lib/definitions";
import { collection } from "firebase/firestore";
import { useFirestore } from "@/firebase";

function CustomersTable() {
  const firestore = useFirestore();
  const { data: customers, loading } = useCollection<Customer>(
    firestore ? collection(firestore, 'customers') : null
  );

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <Card>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Address</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers?.map((customer) => (
              <TableRow key={customer.id}>
                <TableCell className="font-medium">{customer.name}</TableCell>
                <TableCell>{customer.email}</TableCell>
                <TableCell>{customer.phone}</TableCell>
                <TableCell>{customer.address}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

>>>>>>> 493f64cf071699c798704dd512006dc35618f02c

export default function CustomersPage() {
  const firestore = useFirestore();
  
  const customersQuery = useMemoFirebase(
    () => (firestore ? collection(firestore, 'customers') : null),
    [firestore]
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
