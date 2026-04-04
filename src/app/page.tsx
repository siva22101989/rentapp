'use client';
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
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
  LayoutDashboard,
  ArrowRight,
  TrendingUp,
  Warehouse,
  Wheat
} from 'lucide-react';
import { StorageTable } from "@/components/dashboard/storage-table";
import { useCollection } from "@/firebase/firestore/use-collection";
import { doc, collection } from "firebase/firestore";
import { useFirestore } from "@/firebase/provider";
import { useMemoFirebase } from "@/hooks/use-memo-firebase";
import { useMemo, useState, useEffect } from "react";
import type { StorageRecord, Lot, WarehouseInfo, AppUser } from "@/lib/definitions";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useDoc } from "@/firebase/firestore/use-doc";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  description: string;
  roles: ('owner' | 'supervisor' | 'biller' | 'super-admin')[];
};

const navItems: NavItem[] = [
    { href: '/inflow', label: 'Inflow', icon: ArrowDownToDot, description: 'Record new items arriving for storage.', roles: ['owner', 'supervisor', 'biller', 'super-admin'] },
    { href: '/unloading', label: 'Unloading Process', icon: ArrowDownFromLine, description: 'Manage goods unloaded from vehicles.', roles: ['owner', 'supervisor', 'biller', 'super-admin'] },
    { href: '/drying', label: 'Drying Process', icon: Wind, description: 'Manage items in the drying plot and finalize them into storage.', roles: ['owner', 'supervisor', 'biller', 'super-admin'] },
    { href: '/outflow', label: 'Outflow', icon: ArrowUpFromDot, description: 'Process withdrawals and generate final bills.', roles: ['owner', 'supervisor', 'biller', 'super-admin'] },
    { href: '/storage', label: 'Storage', icon: Archive, description: 'View all active inventory and stock.', roles: ['owner', 'supervisor', 'biller', 'super-admin'] },
    { href: '/payments/pending', label: 'Payments', icon: IndianRupee, description: 'View and manage pending payments.', roles: ['owner', 'biller', 'super-admin'] },
    { href: '/customers', label: 'Customers', icon: Users, description: 'Manage customer information.', roles: ['owner', 'supervisor', 'biller', 'super-admin'] },
    { href: '/reports', label: 'Reports', icon: FileText, description: 'Generate detailed business reports.', roles: ['owner', 'supervisor', 'super-admin'] },
    { href: '/expenses', label: 'Profit & Loss', icon: Scale, description: 'Track income, expenses, and profitability.', roles: ['owner', 'super-admin'] },
];

function NavCard({ href, label, icon: Icon, description }: Omit<NavItem, 'roles'>) {
    return (
        <Card className="flex flex-col h-full hover:bg-muted/50 transition-colors hover:border-primary/50">
            <CardHeader>
                <div className="flex justify-between items-start">
                    <CardTitle>{label}</CardTitle>
                    <Icon className="h-6 w-6 text-muted-foreground" />
                </div>
            </CardHeader>
            <CardContent className="flex-grow">
                <p className="text-sm text-muted-foreground">{description}</p>
            </CardContent>
            <CardFooter>
                <Button asChild className="w-full">
                    <Link href={href}>
                        Go to {label}
                        <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                </Button>
            </CardFooter>
        </Card>
    );
}

function DashboardHeader({ activeRecordsCount, occupancy, warehouseInfo, appUser }: { activeRecordsCount: number; occupancy: number; warehouseInfo: WarehouseInfo | null, appUser: AppUser | null }) {
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
                    <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-primary flex items-center gap-2">
                            <Wheat size={16} />
                            {warehouseInfo?.name || 'GrainDost'}
                        </p>
                        {appUser?.role && (
                            <Badge variant="outline" className="capitalize">{appUser.role}</Badge>
                        )}
                    </div>
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
    const router = useRouter();

    useEffect(() => {
        if (appUser?.role === 'super-admin') {
            router.push('/settings');
        }
    }, [appUser, router]);

    const accessibleNavItems = navItems.filter(item => {
        if (!appUser) return false;
        // Super-admin should not see these nav items on this page as they'll be redirected
        if (appUser.role === 'super-admin') return false; 
        return item.roles.includes(appUser.role);
    });

    const recordsQuery = useMemoFirebase(
      () => (firestore && appUser && appUser.role !== 'super-admin' ? collection(firestore, 'storageRecords') : null),
      [firestore, appUser]
    );
    const { data: allRecords, loading: loadingRecords } = useCollection<StorageRecord>(recordsQuery);
  
    const lotsQuery = useMemoFirebase(
      () => (firestore && appUser && appUser.role !== 'super-admin' ? collection(firestore, 'lots') : null),
      [firestore, appUser]
    );
    const { data: allLots, loading: loadingLots } = useCollection<Lot>(lotsQuery);

    const warehouseInfoRef = useMemoFirebase(
        () => (firestore && appUser && appUser.role !== 'super-admin' ? doc(firestore, 'settings', 'main') : null),
        [firestore, appUser]
    );
    const { data: warehouseInfo, loading: loadingWarehouseInfo } = useDoc<WarehouseInfo>(warehouseInfoRef);

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
    
    if (appUser?.role === 'super-admin') {
        return (
            <AppLayout>
                <div className="flex h-full items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="ml-2 text-muted-foreground">Redirecting to Super Admin settings...</p>
                </div>
            </AppLayout>
        );
    }

    return (
        <AppLayout>
            {loadingRecords || loadingLots || loadingWarehouseInfo ? (
                <DashboardHeaderSkeleton />
            ) : (
                <DashboardHeader activeRecordsCount={activeRecordsCount} occupancy={occupancy} warehouseInfo={warehouseInfo} appUser={appUser} />
            )}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 mb-6">
                {accessibleNavItems.map((item) => (
                    <NavCard key={item.href} {...item} />
                ))}
            </div>
        </AppLayout>
    );
}
