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
import { useCollection } from "@/firebase/firestore/use-collection";
import { collection, query, where } from "firebase/firestore";
import { useFirestore } from "@/firebase";
import type { Customer, StorageRecord } from "@/lib/definitions";

export function StorageTable() {
  const firestore = useFirestore();

  const activeRecordsQuery = firestore
    ? query(collection(firestore, 'storageRecords'), where('storageEndDate', '==', null))
    : null;
    
  const { data: activeRecords, loading: recordsLoading } = useCollection<StorageRecord>(activeRecordsQuery);
  const { data: allCustomers, loading: customersLoading } = useCollection<Customer>(
    firestore ? collection(firestore, 'customers') : null
  );

  const loading = recordsLoading || customersLoading;

  const getCustomerName = (customerId: string) => {
    if (!allCustomers) return 'Unknown';
    return allCustomers.find(c => c.id === customerId)?.name ?? 'Unknown';
  };

  if (loading) {
    return <div>Loading table...</div>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Customer</TableHead>
          <TableHead>Commodity</TableHead>
          <TableHead>Location</TableHead>
          <TableHead className="text-right">Bags</TableHead>
          <TableHead>Start Date</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Amount Paid</TableHead>
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
                <TableCell>{record.location}</TableCell>
                <TableCell className="text-right">{record.bagsStored}</TableCell>
                <TableCell>{startDate ? format(startDate, 'dd MMM yyyy') : 'N/A'}</TableCell>
                <TableCell>
                  <Badge variant="secondary" className="bg-green-100 text-green-800">
                    Active
                  </Badge>
                </TableCell>
                <TableCell className="text-right">{formatCurrency(amountPaid)}</TableCell>
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
