'use client';

import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useCollection } from "@/firebase/firestore/use-collection";
import { collection } from "firebase/firestore";
import { useFirestore } from "@/firebase/provider";
import { useMemoFirebase } from "@/hooks/use-memo-firebase";
import type { StorageRecord, Lot } from "@/lib/definitions";
import { useMemo, useState, useEffect } from "react";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Package, TrendingUp, Warehouse } from "lucide-react";
import { StorageTable } from "@/components/dashboard/storage-table";

function DashboardHeader({ activeRecordsCount, occupancy }: { activeRecordsCount: number; occupancy: number }) {
    const [greeting, setGreeting] = useState("Good Day, Team!");
    
    useEffect(() => {
        const hour = new Date().getHours();
        if (hour < 12) setGreeting("Good Morning, Team!");
        else if (hour < 18) setGreeting("Good Afternoon, Team!");
        else setGreeting("Good Evening, Team!");
    }, []);

    return (
        <Card className="mb-6">
            <CardContent className="p-4 md:p-6 flex flex-col md:flex-row items-center gap-4 md:gap-6">
                <div className="flex-1">
                    <p className="text-sm font-medium text-primary flex items-center gap-2">
                        <Package size={16} />
                        SRI LAKSHMI WAREHOUSE
                    </p>
                    <h2 className="text-2xl font-bold mt-2">{greeting}</h2>
                    <p className="text-muted-foreground mt-2 max-w-md">
                        Here's what's happening in your warehouse today. You have {activeRecordsCount} active records and
                        your storage is {occupancy.toFixed(1)}% full.
                    </p>
                </div>
                <div className="grid w-full grid-cols-2 items-center gap-4 md:w-auto">
                    <Card className="p-4 bg-background/50">
                        <CardHeader className="p-0 flex-row items-center gap-2 text-muted-foreground">
                            <TrendingUp size={16} />
                            <CardTitle>Active Records</CardTitle>
                        </CardHeader>
                        <CardContent className="p-0 mt-2">
                            <p className="text-3xl font-bold">{activeRecordsCount}</p>
                        </CardContent>
                    </Card>
                    <Card className="p-4 bg-background/50">
                        <CardHeader className="p-0 flex-row items-center gap-2 text-muted-foreground">
                            <Warehouse size={16} />
                            <CardTitle>Occupancy</CardTitle>
                        </CardHeader>
                        <CardContent className="p-0 mt-2">
                            <p className="text-3xl font-bold">{occupancy.toFixed(1)}%</p>
                            <Progress value={occupancy} className="h-1.5 mt-2" />
                        </CardContent>
                    </Card>
                </div>
            </CardContent>
        </Card>
    );
}

function DashboardHeaderSkeleton() {
    return (
         <Card className="mb-6">
            <CardContent className="p-4 md:p-6 flex flex-col md:flex-row items-center gap-6">
                <div className="flex-1 space-y-2">
                    <Skeleton className="h-5 w-48" />
                    <Skeleton className="h-8 w-64" />
                    <Skeleton className="h-5 w-full max-w-md" />
                </div>
                <div className="flex items-center gap-4">
                    <Skeleton className="h-[98px] w-[150px]" />
                    <Skeleton className="h-[98px] w-[150px]" />
                </div>
            </CardContent>
        </Card>
    )
}

export default function DashboardPage() {
    const firestore = useFirestore();

    const recordsQuery = useMemoFirebase(
      () => (firestore ? collection(firestore, 'storageRecords') : null),
      [firestore]
    );
    const { data: allRecords, loading: loadingRecords } = useCollection<StorageRecord>(recordsQuery);
  
    const lotsQuery = useMemoFirebase(
      () => (firestore ? collection(firestore, 'lots') : null),
      [firestore]
    );
    const { data: allLots, loading: loadingLots } = useCollection<Lot>(lotsQuery);

    const { activeRecordsCount, occupancy } = useMemo(() => {
        if (!allRecords || !allLots) {
            return { activeRecordsCount: 0, occupancy: 0 };
        }

        const activeRecords = allRecords.filter(r => !r.storageEndDate && r.bagsStored > 0);
        const activeRecordsCount = activeRecords.length;

        const totalBagsInStock = activeRecords.reduce((acc, record) => acc + record.bagsStored, 0);
        const totalCapacity = allLots.reduce((acc, lot) => acc + (lot.capacity || 0), 0);
        
        const occupancy = totalCapacity > 0 ? (totalBagsInStock / totalCapacity) * 100 : 0;

        return { activeRecordsCount, occupancy };
    }, [allRecords, allLots]);
    
    return (
        <AppLayout>
          {loadingRecords || loadingLots ? (
              <DashboardHeaderSkeleton />
          ) : (
              <DashboardHeader activeRecordsCount={activeRecordsCount} occupancy={occupancy} />
          )}
          <Card>
            <CardHeader>
                <CardTitle>Customer Storage Summary</CardTitle>
                <CardDescription>A summary of active stock held by each customer.</CardDescription>
            </CardHeader>
            <CardContent>
                <StorageTable />
            </CardContent>
          </Card>
        </AppLayout>
      );
}
