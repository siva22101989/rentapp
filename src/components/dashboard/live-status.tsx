'use client';

import { useMemo, useState, useEffect } from 'react';
import { useCollection } from '@/firebase/firestore/use-collection';
import { useFirestore } from '@/firebase';
import { collection } from 'firebase/firestore';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import type { StorageRecord } from '@/lib/definitions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Warehouse, IndianRupee, AlertCircle, Server } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';

function LiveStatusCard({ icon: Icon, title, value, footer, loading }: { icon: React.ElementType, title: string, value: string | number, footer: string, loading: boolean }) {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{title}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                {loading ? (
                    <>
                        <Skeleton className="h-8 w-3/4" />
                        <Skeleton className="h-4 w-1/2 mt-1" />
                    </>
                ) : (
                    <>
                        <div className="text-2xl font-bold">{value}</div>
                        <p className="text-xs text-muted-foreground">{footer}</p>
                    </>
                )}
            </CardContent>
        </Card>
    );
}

export function LiveStatus() {
    const firestore = useFirestore();
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

    const recordsQuery = useMemoFirebase(
        () => (firestore ? collection(firestore, 'storageRecords') : null),
        [firestore]
    );
    const { data: allRecords, loading } = useCollection<StorageRecord>(recordsQuery);

    const { activeRecords, totalBagsStored, pendingPaymentsCount } = useMemo(() => {
        if (!allRecords) return { activeRecords: 0, totalBagsStored: 0, pendingPaymentsCount: 0 };
        
        const active = allRecords.filter(r => !r.storageEndDate);

        const bags = active.reduce((acc, record) => acc + record.bagsStored, 0);

        const pending = allRecords.filter(record => {
            const totalBilled = (record.hamaliPayable || 0) + (record.totalRentBilled || 0);
            const totalPaid = (record.payments || []).reduce((acc, p) => acc + p.amount, 0);
            return totalBilled - totalPaid > 0.5;
        }).length;

        return {
            activeRecords: active.length,
            totalBagsStored: bags,
            pendingPaymentsCount: pending,
        };
    }, [allRecords]);

    useEffect(() => {
        setLastUpdated(new Date());
        const timer = setInterval(() => setLastUpdated(new Date()), 5000); // Update every 5 seconds
        return () => clearInterval(timer);
    }, []);

    return (
        <div className="mb-6">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                    <div className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                    </div>
                    Live Status
                </h2>
                <div className="text-xs text-muted-foreground">
                    {lastUpdated ? `Last updated: ${format(lastUpdated, 'hh:mm:ss a')}` : 'Loading...'}
                </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <LiveStatusCard 
                    icon={Server}
                    title="Active Storage Records"
                    value={activeRecords}
                    footer="Currently stored items"
                    loading={loading}
                />
                 <LiveStatusCard 
                    icon={Warehouse}
                    title="Total Bags in Stock"
                    value={totalBagsStored.toLocaleString()}
                    footer="Across all active records"
                    loading={loading}
                />
                <LiveStatusCard 
                    icon={IndianRupee}
                    title="Pending Payments"
                    value={pendingPaymentsCount}
                    footer="Records with an outstanding balance"
                    loading={loading}
                />
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">System Health</CardTitle>
                        <AlertCircle className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                         <div className="text-2xl font-bold text-green-600">Online</div>
                        <p className="text-xs text-muted-foreground">No system issues reported</p>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
