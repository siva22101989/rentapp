
'use client';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "@/components/ui/table";
<<<<<<< HEAD
=======
import { Badge } from "@/components/ui/badge";
import { format } from 'date-fns';
import { ActionsMenu } from "./actions-menu";
import { formatCurrency, toDate } from "@/lib/utils";
import { useCollection } from "@/firebase/firestore/use-collection";
import { collection, query, where } from "firebase/firestore";
import { useFirestore } from "@/firebase";
>>>>>>> 493f64cf071699c798704dd512006dc35618f02c
import type { Customer, StorageRecord } from "@/lib/definitions";
import { useCollection } from "@/firebase/firestore/use-collection";
import { collection } from "firebase/firestore";
import { useFirestore } from "@/firebase/provider";
import { useMemoFirebase } from "@/hooks/use-memo-firebase";
import { useMemo } from "react";
import { useRouter } from "next/navigation";

export function StorageTable() {
  const firestore = useFirestore();
<<<<<<< HEAD
  const router = useRouter();

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
  
  const { summary, totalBags } = useMemo(() => {
    if (!allRecords || !allCustomers) return { summary: [], totalBags: 0 };
=======

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
>>>>>>> 493f64cf071699c798704dd512006dc35618f02c

    const activeRecords = allRecords.filter(r => !r.storageEndDate && r.bagsStored > 0);
    
    const customerSummary: { [customerId: string]: { totalBags: number, recordCount: number } } = {};

    activeRecords.forEach(record => {
        if (!customerSummary[record.customerId]) {
            customerSummary[record.customerId] = { totalBags: 0, recordCount: 0 };
        }
        customerSummary[record.customerId].totalBags += record.bagsStored;
        customerSummary[record.customerId].recordCount++;
    });

    const customerMap = new Map(allCustomers.map(c => [c.id, c.name]));

    const summaryArray = Object.entries(customerSummary)
        .map(([customerId, data]) => ({
            customerId,
            customerName: customerMap.get(customerId) || 'Unknown',
            ...data
        }))
        .sort((a,b) => b.totalBags - a.totalBags);
        
    const total = summaryArray.reduce((acc, item) => acc + item.totalBags, 0);

    return { summary: summaryArray, totalBags: total };

  }, [allRecords, allCustomers]);


  if (loadingRecords || loadingCustomers) {
    return <div>Loading table...</div>;
  }

  const handleRowClick = (customerId: string) => {
    router.push(`/reports?report=customer-statement&customerId=${customerId}`);
  };

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
        {summary.map((summaryItem) => (
            <TableRow
              key={summaryItem.customerId}
              onClick={() => handleRowClick(summaryItem.customerId)}
              className="cursor-pointer hover:bg-muted/50"
            >
                <TableCell className="font-medium">{summaryItem.customerName}</TableCell>
                <TableCell className="hidden sm:table-cell text-center">{summaryItem.recordCount}</TableCell>
                <TableCell className="text-right font-mono font-bold">{summaryItem.totalBags}</TableCell>
            </TableRow>
        ))}
         {summary.length === 0 && (
            <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground">
                    No active storage records found.
                </TableCell>
            </TableRow>
        )}
      </TableBody>
       <TableFooter>
        <TableRow>
            <TableCell colSpan={2} className="text-right font-bold text-lg">Total Bags in Stock</TableCell>
            <TableCell className="text-right font-mono font-bold text-lg">{totalBags}</TableCell>
        </TableRow>
      </TableFooter>
    </Table>
  );
}
