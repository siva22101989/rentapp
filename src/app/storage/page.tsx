
'use client';

import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowDown, ArrowUp, Warehouse, IndianRupee } from "lucide-react";
import { calculateFinalRent } from "@/lib/billing";
import { formatCurrency, toDate } from "@/lib/utils";
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

    const today = new Date();
    const estimatedRent = activeRecords.reduce((total, record) => {
      // Robust commodity fallback matching
      const commodity = allCommodities.find(c => c.name.trim().toLowerCase() === record.commodityDescription.trim().toLowerCase());
      
      const recordWithRates: StorageRecord = {
          ...record,
          billingType: record.billingType || commodity?.billingType || 'slab',
          monthlyRate: record.monthlyRate ?? commodity?.monthlyRate ?? 0,
          minBillingMonths: record.minBillingMonths ?? commodity?.minBillingMonths ?? 0,
          insuranceRate: record.insuranceRate ?? commodity?.insuranceRate ?? 0,
          rate6Months: record.rate6Months ?? commodity?.rate6Months ?? 0,
          rate1Year: record.rate1Year ?? commodity?.rate1Year ?? 0,
      };

      // Accurate Outstanding Balance Calculation:
      // (Rent on currently held bags) + (Billed Rent on past outflows) + (Hamali + Khata) - (Total Paid)
      const { rent: currentStockRent } = calculateFinalRent({ ...recordWithRates, storageStartDate: toDate(recordWithRates.storageStartDate) }, today, record.bagsStored);
      const billedRentOnOutflows = (record.outflows || []).reduce((acc, o) => acc + (o.rentBilled || 0), 0);
      const totalLiabilities = currentStockRent + billedRentOnOutflows + (record.hamaliPayable || 0) + (record.khataAmount || 0);
      const totalPaymentsReceived = (record.payments || []).reduce((acc, p) => acc + p.amount, 0);

      const recordDue = Math.max(0, totalLiabilities - totalPaymentsReceived);
      return total + recordDue;
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
        <div className="flex items-center justify-center p-12">Loading storage data...</div>
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
                <p className="text-xs text-muted-foreground">Historically received</p>
            </CardContent>
        </Card>
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Outflow</CardTitle>
                <ArrowUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{stats.totalOutflow} bags</div>
                <p className="text-xs text-muted-foreground">Historically withdrawn</p>
            </CardContent>
        </Card>
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Balance Stock</CardTitle>
                <Warehouse className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{stats.balanceStock} bags</div>
                <p className="text-xs text-muted-foreground">Currently in godown</p>
            </CardContent>
        </Card>
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Outstanding Balance</CardTitle>
                <IndianRupee className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold text-primary">{formatCurrency(stats.estimatedRent)}</div>
                <p className="text-xs text-muted-foreground">
                    Money Owed on active stock
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
