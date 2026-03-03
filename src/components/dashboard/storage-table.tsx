
'use client';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Customer, StorageRecord } from "@/lib/definitions";
import { useCollection } from "@/firebase/firestore/use-collection";
import { collection } from "firebase/firestore";
import { useFirestore } from "@/firebase/provider";
import { useMemoFirebase } from "@/hooks/use-memo-firebase";
import { useMemo } from "react";

export function StorageTable() {
  const firestore = useFirestore();

  const allRecordsQuery = useMemoFirebase(
    () => (firestore ? collection(firestore, 'storageRecords') : null),
    [firestore]
  );
  const { data: allRecords, loading: loadingRecords } = useCollection<StorageRecord>(allRecordsQuery);

  const customersQuery = useMemoFirebase(
    () => (firestore ? collection(firestore, 'customers') : null),
    [firestore]
  );
  const { data: allCustomers, loading: loadingCustomers } = useCollection<Customer>(customersQuery);
  
  const customerStorageSummary = useMemo(() => {
    if (!allRecords || !allCustomers) return [];

    const activeRecords = allRecords.filter(r => !r.storageEndDate && r.bagsStored > 0);
    
    const summary: { [customerId: string]: { totalBags: number, recordCount: number } } = {};

    activeRecords.forEach(record => {
        if (!summary[record.customerId]) {
            summary[record.customerId] = { totalBags: 0, recordCount: 0 };
        }
        summary[record.customerId].totalBags += record.bagsStored;
        summary[record.customerId].recordCount++;
    });

    const customerMap = new Map(allCustomers.map(c => [c.id, c.name]));

    return Object.entries(summary)
        .map(([customerId, data]) => ({
            customerId,
            customerName: customerMap.get(customerId) || 'Unknown',
            ...data
        }))
        .sort((a,b) => b.totalBags - a.totalBags);

  }, [allRecords, allCustomers]);


  if (loadingRecords || loadingCustomers) {
    return <div>Loading table...</div>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Customer</TableHead>
          <TableHead className="hidden sm:table-cell text-center">Active Records</TableHead>
          <TableHead className="text-right">Total Active Bags</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {customerStorageSummary.map((summary) => (
            <TableRow key={summary.customerId}>
                <TableCell className="font-medium">{summary.customerName}</TableCell>
                <TableCell className="hidden sm:table-cell text-center">{summary.recordCount}</TableCell>
                <TableCell className="text-right font-mono font-bold">{summary.totalBags}</TableCell>
            </TableRow>
        ))}
         {customerStorageSummary.length === 0 && (
            <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground">
                    No active storage records found.
                </TableCell>
            </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
