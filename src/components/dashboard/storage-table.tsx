
'use client';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from 'date-fns';
import { ActionsMenu } from "./actions-menu";
import { formatCurrency, toDate } from "@/lib/utils";
import type { Customer, StorageRecord } from "@/lib/definitions";
import { useCollection } from "@/firebase/firestore/use-collection";
import { collection, query, where } from "firebase/firestore";
import { useFirestore } from "@/firebase";
import { useMemoFirebase } from "@/hooks/use-memo-firebase";

export function StorageTable() {
  const firestore = useFirestore();

  const activeRecordsQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'storageRecords'), where('storageEndDate', '==', null)) : null),
    [firestore]
  );
  const { data: activeRecords, loading: loadingRecords } = useCollection<StorageRecord>(activeRecordsQuery);

  const customersQuery = useMemoFirebase(
    () => (firestore ? collection(firestore, 'customers') : null),
    [firestore]
  );
  const { data: allCustomers, loading: loadingCustomers } = useCollection<Customer>(customersQuery);

  const getCustomerName = (customerId: string) => {
    return allCustomers?.find(c => c.id === customerId)?.name ?? 'Unknown';
  };

  if (loadingRecords || loadingCustomers) {
    return <div>Loading table...</div>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Customer</TableHead>
          <TableHead>Commodity</TableHead>
          <TableHead className="hidden lg:table-cell">Location</TableHead>
          <TableHead className="text-right">Bags</TableHead>
          <TableHead className="hidden md:table-cell">Start Date</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right hidden lg:table-cell">Amount Paid</TableHead>
          <TableHead className="w-[50px]"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {activeRecords && allCustomers && activeRecords.map((record) => {
            const customerName = getCustomerName(record.customerId);
            const amountPaid = (record.payments || []).reduce((acc, p) => acc + p.amount, 0);
            const startDate = toDate(record.storageStartDate);
            return (
              <TableRow key={record.id}>
                <TableCell className="font-medium">{customerName}</TableCell>
                <TableCell>{record.commodityDescription}</TableCell>
                <TableCell className="hidden lg:table-cell">{record.location}</TableCell>
                <TableCell className="text-right">{record.bagsStored}</TableCell>
                <TableCell className="hidden md:table-cell">{startDate ? format(startDate, 'dd MMM yyyy') : 'N/A'}</TableCell>
                <TableCell>
                  <Badge variant="secondary" className="bg-green-100 text-green-800">
                    Active
                  </Badge>
                </TableCell>
                <TableCell className="text-right hidden lg:table-cell">{formatCurrency(amountPaid)}</TableCell>
                <TableCell>
                    <ActionsMenu record={record} customers={allCustomers} />
                </TableCell>
              </TableRow>
            )
        })}
      </TableBody>
    </Table>
  );
}
