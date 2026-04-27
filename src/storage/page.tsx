
'use client';

import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowDown, ArrowUp, Warehouse, IndianRupee } from "lucide-react";
import { calculateFinalRent } from "@/lib/billing";
import { formatCurrency } from "@/lib/utils";
import { useMemo } from "react";
import type { StorageRecord, Commodity, Customer } from "@/lib/definitions";
import { useCollection } from "@/firebase/firestore/use-collection";
import { useFirestore } from "@/firebase/provider";
import { collection, query, where } from "firebase/firestore";
import { useMemoFirebase } from "@/hooks/use-memo-firebase";
import { AllRecordsTable } from "@/components/reports/all-records-table";
import { useAppUser } from "@/firebase/auth/use-user";

export default function StoragePage() {
  const firestore = useFirestore();
  const appUser = useAppUser();

  const recordsQuery = useMemoFirebase(
    () => (firestore && appUser?.warehouseId ? query(collection(firestore, 'storageRecords'), where('warehouseId', '==', appUser.warehouseId)) : null),
    [firestore, appUser]
  );
  const { data: allRecords, loading: loadingRecords } = useCollection<StorageRecord>(recordsQuery);

  const commoditiesQuery = useMemoFirebase(
    () => (firestore && appUser?.warehouseId ? query(collection(firestore, 'commodities'), where('warehouseId', '==', appUser.warehouseId)) : null),
    [firestore, appUser]
  );
  const { data: allCommodities, loading: loadingCommodities } = useCollection<Commodity>(commoditiesQuery);

  const customersQuery = useMemoFirebase(
    () => (firestore && appUser?.warehouseId ? query(collection(firestore, 'customers'), where('warehouseId', '==', appUser.warehouseId)) : null),
    [firestore, appUser]
  );
  const { data: allCustomers, loading: loadingCustomers } = useCollection<Customer>(customersQuery);

  const stats = useMemo(() => {
    if (!allRecords || !allCommodities) return { totalInflow: 0, totalOutflow: 0, balanceStock: 0, estimatedRent: 0 };
    
    let totalInflow = 0;
    let totalOutflow = 0;

    for (const record of allRecords) {
        const bagsOutFromOutflows = (record.outflows || []).reduce((s, o) => s + o.bagsWithdrawn, 0);
        const bagsOutForRecord = record.bagsOut ?? bagsOutFromOutflows;
        const bagsInForRecord = record.bagsIn ?? (record.bagsStored + bagsOutForRecord);

        totalInflow += bagsInForRecord;
        totalOutflow += bagsOutForRecord;
    }

    const activeRecords = allRecords.filter(r => !r.storageEndDate && r.bagsStored > 0);
    const balanceStock = activeRecords.reduce((acc, record) => acc + record.bagsStored, 0);

    const estimatedRent = activeRecords.reduce((total, record) => {
      let recordWithRates = { ...record };
      if (record.rate6Months === undefined || record.rate1Year === undefined) {
        const commodity = allCommodities.find(c => c.name === record.commodityDescription);
        if (commodity) {
            recordWithRates.rate6Months = commodity.rate6Months;
            recordWithRates.rate1Year = commodity.rate1Year;
        }
      }
      const { rent } = calculateFinalRent(recordWithRates, new Date(), record.bagsStored);
      return total + rent;
    }, 0);

    return { totalInflow, totalOutflow, balanceStock, estimatedRent };

  }, [allRecords, allCommodities]);
  
  const loading = loadingRecords || loadingCommodities || loadingCustomers;

  if (loading) {
    return (
      <AppLayout>
        <PageHeader
          title="Storage Records"
          description="View and manage all storage records."
        />
        <div>Loading...</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <PageHeader
        title="Storage Records"
        description="View and manage all storage records."
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
          <CardTitle>All Storage Records</CardTitle>
        </CardHeader>
        <CardContent>
          <AllRecordsTable allRecords={allRecords || []} allCustomers={allCustomers || []} />
        </CardContent>
      </Card>
    </AppLayout>
  );
}
