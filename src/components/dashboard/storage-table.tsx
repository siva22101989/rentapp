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
import type { Customer, StorageRecord } from "@/lib/definitions";
import { useCollection } from "@/firebase/firestore/use-collection";
import { collection } from "firebase/firestore";
import { useFirestore } from "@/firebase/provider";
import { useMemoFirebase } from "@/hooks/use-memo-firebase";
import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAppUser } from "@/firebase/auth/use-user";

export function StorageTable() {
  const firestore = useFirestore();
  const appUser = useAppUser();
  const router = useRouter();

  const allRecordsQuery = useMemoFirebase(
    () => (firestore && appUser ? collection(firestore, 'storageRecords') : null),
    [firestore, appUser]
  );
  const { data: allRecords, loading: loadingRecords } = useCollection<StorageRecord>(allRecordsQuery);

  const customersQuery = useMemoFirebase(
    () => (firestore && appUser ? collection(firestore, 'customers') : null),
    [firestore, appUser]
  );
  const { data: allCustomers, loading: loadingCustomers } = useCollection<Customer>(customersQuery);
  
  const { summary, totalBags } = useMemo(() => {
    if (!allRecords || !allCustomers) return { summary: [], totalBags: 0 };

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
