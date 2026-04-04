
'use client';
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAppUser } from "@/firebase/auth/use-user";
import type { LucideIcon } from 'lucide-react';
import Link from 'next/link';
import {
  ArrowDownToDot,
  ArrowUpFromDot,
  Archive,
  IndianRupee,
  Users,
  FileText,
  Scale,
  Settings,
  Wind,
  ArrowDownFromLine,
  LayoutDashboard
} from 'lucide-react';
import { StorageTable } from "@/components/dashboard/storage-table";
import { useCollection } from "@/firebase/firestore/use-collection";
import { collection } from "firebase/firestore";
import { useFirestore } from "@/firebase/provider";
import { useMemoFirebase } from "@/hooks/use-memo-firebase";
import { useMemo, useState, useEffect } from "react";
import type { StorageRecord, Lot } from "@/lib/definitions";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Package, TrendingUp, Warehouse } from "lucide-react";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  description: string;
  roles: ('owner' | 'supervisor' | 'biller')[];
};

const navItems: NavItem[] = [
    { href: '/inflow', label: 'Inflow', icon: ArrowDownToDot, description: 'Record new items arriving for storage.', roles: ['owner', 'supervisor', 'biller'] },
    { href: '/unloading', label: 'Unloading Process', icon: ArrowDownFromLine, description: 'Manage goods unloaded from vehicles.', roles: ['owner', 'supervisor', 'biller'] },
    { href: '/drying', label: 'Drying Process', icon: Wind, description: 'Manage items in the drying plot and finalize them into storage.', roles: ['owner', 'supervisor', 'biller'] },
    { href: '/outflow', label: 'Outflow', icon: ArrowUpFromDot, description: 'Process withdrawals and generate final bills.', roles: ['owner', 'supervisor', 'biller'] },
    { href: '/storage', label: 'Storage', icon: Archive, description: 'View all active inventory and stock.', roles: ['owner', 'supervisor', 'biller'] },
    { href: '/payments/pending', label: 'Payments', icon: IndianRupee, description: 'View and manage pending payments.', roles: ['owner', 'biller'] },
    { href: '/customers', label: 'Customers', icon: Users, description: 'Manage customer information.', roles: ['owner', 'supervisor', 'biller'] },
    { href: '/reports', label: 'Reports', icon: FileText, description: 'Generate detailed business reports.', roles: ['owner', 'supervisor'] },
    { href: '/expenses', label: 'Profit & Loss', icon: Scale, description: 'Track income, expenses, and profitability.', roles: ['owner'] },
    { href: '/settings', label: 'Settings', icon: Settings, description: 'Configure application settings.', roles: ['owner', 'supervisor', 'biller'] },
];

function NavCard({ href, label, icon: Icon, description }: Omit<NavItem, 'roles'>) {
    return (
        <Link href={href}>
            <Card className="h-full hover:bg-muted/50 transition-colors hover:border-primary/50">
                <CardHeader className="flex-row items-center gap-4 space-y-0">
                    <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
                        <Icon className="h-6 w-6" />
                    </div>
                    <CardTitle>{label}</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground">{description}</p>
                </CardContent>
            </Card>
        </Link>
    );
}

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
    const appUser = useAppUser();
    const firestore = useFirestore();

    const accessibleNavItems = navItems.filter(item => appUser && item.roles.includes(appUser.role));

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
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 mb-6">
                {accessibleNavItems.map((item) => (
                    <NavCard key={item.href} {...item} />
                ))}
            </div>

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
