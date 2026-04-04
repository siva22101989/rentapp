
'use client';

import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowDown, ArrowUp, Warehouse, IndianRupee } from "lucide-react";
import { calculateFinalRent } from "@/lib/billing";
import { formatCurrency } from "@/lib/utils";
import { useMemo } from "react";
import type { StorageRecord } from "@/lib/definitions";
import { useCollection } from "@/firebase/firestore/use-collection";
import { useFirestore } from "@/firebase/provider";
import { collection } from "firebase/firestore";
import { useMemoFirebase } from "@/hooks/use-memo-firebase";
import { StorageTable } from "@/components/dashboard/storage-table";

export default function StoragePage() {
  const firestore = useFirestore();

  const recordsQuery = useMemoFirebase(
    () => (firestore ? collection(firestore, 'storageRecords') : null),
    [firestore]
  );
  const { data: allRecords, loading } = useCollection<StorageRecord>(recordsQuery);

  const stats = useMemo(() => {
    if (!allRecords) return { totalInflow: 0, totalOutflow: 0, balanceStock: 0, estimatedRent: 0 };
    
    const totalInflow = allRecords.reduce((acc, record) => acc + (record.bagsIn || 0), 0);
    const totalOutflow = allRecords.reduce((acc, record) => acc + (record.bagsOut || 0), 0);
    const balanceStock = allRecords.reduce((acc, record) => acc + record.bagsStored, 0);

    const activeRecords = allRecords.filter(r => !r.storageEndDate);
    const estimatedRent = activeRecords.reduce((total, record) => {
      const { rent } = calculateFinalRent(record, new Date(), record.bagsStored);
      return total + rent;
    }, 0);

    return { totalInflow, totalOutflow, balanceStock, estimatedRent };

  }, [allRecords]);

  if (loading) {
    return (
      <AppLayout>
        <PageHeader
          title="Storage Overview"
          description="A high-level summary of your warehouse inventory."
        />
        <div>Loading...</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <PageHeader
        title="Storage Overview"
        description="A high-level summary of your warehouse inventory."
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Inflow</CardTitle>
                <ArrowDown className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{stats.totalInflow} bags</div>
            </CardContent>
        </Card>
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Outflow</CardTitle>
                <ArrowUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{stats.totalOutflow} bags</div>
            </CardContent>
        </Card>
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Balance Stock</CardTitle>
                <Warehouse className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{stats.balanceStock} bags</div>
            </CardContent>
        </Card>
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Estimated Rent Due</CardTitle>
                <IndianRupee className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(stats.estimatedRent)}</div>
                <p className="text-xs text-muted-foreground">
                    Based on current active stock
                </p>
            </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Customer Storage Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <StorageTable />
        </CardContent>
      </Card>
    </AppLayout>
  );
}
