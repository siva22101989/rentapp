
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
      // Create a merged record object with fallback rates from the commodity definition (Case-Insensitive)
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

      // Calculate Accrued Rent for all bags currently in stock
      const { rent: currentAccruedRent } = calculateFinalRent({ ...recordWithRates, storageStartDate: toDate(recordWithRates.storageStartDate) }, today, record.bagsStored);
      
      // Calculate how much has already been paid towards rent for this patti
      const totalRentPaid = (record.payments || [])
          .filter(p => p.type === 'rent' || p.type === 'other' || !p.type || p.type === 'discount')
          .reduce((acc, p) => acc + p.amount, 0);

      // Due = (Total Accrued on current bags) - (Proportional Payment)
      // Since proportional payment is complex, we'll estimate based on record balance
      // Simplified approach: What is the current outstanding balance of the Patti?
      const totalAccruedForPatti = calculateFinalRent({ ...recordWithRates, storageStartDate: toDate(recordWithRates.storageStartDate) }, today, record.bagsIn).rent;
      const pattiRentDue = Math.max(0, totalAccruedForPatti - totalRentPaid);

      // We only return the due proportional to what's still in stock
      const weight = record.bagsIn > 0 ? (record.bagsStored / record.bagsIn) : 1;
      return total + (pattiRentDue * weight);
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
                <CardTitle className="text-sm font-medium">Estimated Rent Due</CardTitle>
                <IndianRupee className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold text-primary">{formatCurrency(stats.estimatedRent)}</div>
                <p className="text-xs text-muted-foreground">
                    Outstanding on active stock
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
