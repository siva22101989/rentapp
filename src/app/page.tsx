
'use client';
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
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
  Wind,
  ArrowDownFromLine,
  ArrowRight,
  Warehouse,
} from 'lucide-react';
import { useCollection } from "@/firebase/firestore/use-collection";
import { doc, collection, query, where } from "firebase/firestore";
import { useFirestore } from "@/firebase/provider";
import { useMemoFirebase } from "@/hooks/use-memo-firebase";
import { useMemo, useState, useEffect } from "react";
import type { StorageRecord, Lot, WarehouseInfo, AppUser } from "@/lib/definitions";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useDoc } from "@/firebase/firestore/use-doc";
import { SuperAdminDashboard } from "@/components/super-admin/super-admin-dashboard";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  description: string;
  roles: ('owner' | 'supervisor' | 'biller' | 'super-admin')[];
  color: string;
};

const navItems: NavItem[] = [
    { href: '/inflow', label: 'Add Inflow', icon: ArrowDownToDot, description: 'Record new items arriving for storage.', roles: ['owner', 'supervisor', 'biller', 'super-admin'], color: 'text-emerald-600 bg-emerald-50' },
    { href: '/unloading', label: 'Unloading', icon: ArrowDownFromLine, description: 'Manage goods unloaded from vehicles.', roles: ['owner', 'supervisor', 'biller', 'super-admin'], color: 'text-sky-600 bg-sky-50' },
    { href: '/drying', label: 'Drying Plot', icon: Wind, description: 'Manage items in the drying plot.', roles: ['owner', 'supervisor', 'biller', 'super-admin'], color: 'text-amber-600 bg-amber-50' },
    { href: '/outflow', label: 'Outflow', icon: ArrowUpFromDot, description: 'Process withdrawals and generate final bills.', roles: ['owner', 'supervisor', 'biller', 'super-admin'], color: 'text-orange-600 bg-orange-50' },
    { href: '/storage', label: 'Inventory', icon: Archive, description: 'View all active inventory and stock.', roles: ['owner', 'supervisor', 'biller', 'super-admin'], color: 'text-indigo-600 bg-indigo-50' },
    { href: '/payments/pending', label: 'Pending Dues', icon: IndianRupee, description: 'View and manage pending payments.', roles: ['owner', 'biller', 'super-admin'], color: 'text-rose-600 bg-rose-50' },
    { href: '/customers', label: 'Customers', icon: Users, description: 'Manage customer information.', roles: ['owner', 'supervisor', 'biller', 'super-admin'], color: 'text-violet-600 bg-violet-50' },
    { href: '/reports', label: 'Reports', icon: FileText, description: 'Generate detailed business reports.', roles: ['owner', 'supervisor', 'super-admin'], color: 'text-slate-600 bg-slate-50' },
    { href: '/expenses', label: 'Profit & Loss', icon: Scale, description: 'Track income, expenses, and profitability.', roles: ['owner', 'super-admin'], color: 'text-cyan-600 bg-cyan-50' },
];

function NavCard({ href, label, icon: Icon, description, color }: Omit<NavItem, 'roles'>) {
    return (
        <Card className="stylish-card h-full flex flex-col hover:border-primary/50 group">
            <CardHeader className="p-5 pb-2">
                <div className="flex justify-between items-start">
                    <div className={`p-2.5 rounded-xl ${color} transition-colors group-hover:scale-110 duration-200`}>
                        <Icon className="h-5 w-5" />
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" />
                </div>
                <CardTitle className="text-base font-bold mt-4">{label}</CardTitle>
            </CardHeader>
            <CardContent className="p-5 pt-0 flex-grow">
                <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
            </CardContent>
            <CardFooter className="p-5">
                <Button asChild variant="default" size="sm" className="w-full text-xs h-9 font-bold tracking-tight uppercase">
                    <Link href={href}>{label}</Link>
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
        <Card className="stylish-card mb-8 border-none bg-primary text-primary-foreground overflow-hidden">
            <CardContent className="p-0 flex flex-col md:flex-row items-stretch">
                <div className="flex-1 p-6 md:p-8 space-y-4">
                    <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="bg-white/10 text-white border-white/20 uppercase text-[10px] tracking-widest font-black px-3 py-1">
                            {appUser?.role} Control
                        </Badge>
                        <span className="text-white/40 text-xs font-medium">|</span>
                        <p className="text-sm font-bold flex items-center gap-2 text-white/80">
                            <Warehouse size={16} />
                            {warehouseInfo?.name || 'Sri Lakshmi Warehouse'}
                        </p>
                    </div>
                    <div>
                        <h2 className="text-3xl md:text-4xl font-black tracking-tighter">{greeting}</h2>
                        <p className="text-white/70 text-sm font-medium mt-2 max-w-lg leading-relaxed">
                            Overview of current Godown operations. You have <span className="text-white font-bold underline underline-offset-4">{activeRecordsCount} active records</span> under management today.
                        </p>
                    </div>
                </div>
                <div className="bg-black/10 p-6 md:p-8 flex flex-col justify-center gap-4 min-w-[300px]">
                    <div className="space-y-1.5">
                        <div className="flex justify-between items-end">
                            <p className="text-[10px] font-black uppercase tracking-widest text-white/60">Godown Occupancy</p>
                            <p className="text-xl font-black">{occupancy.toFixed(1)}%</p>
                        </div>
                        <Progress value={occupancy} className="h-2 bg-white/20" />
                    </div>
                    <div className="flex items-center gap-4 pt-2">
                        <div className="flex-1">
                             <p className="text-[10px] font-black uppercase tracking-widest text-white/60">Active Records</p>
                             <p className="text-2xl font-black">{activeRecordsCount}</p>
                        </div>
                        <div className="h-10 w-px bg-white/10" />
                        <div className="flex-1">
                             <p className="text-[10px] font-black uppercase tracking-widest text-white/60">System Status</p>
                             <div className="flex items-center gap-2 mt-1">
                                <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                                <span className="text-xs font-bold uppercase">Online</span>
                             </div>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

function DashboardHeaderSkeleton() {
    return (
         <Card className="mb-8 stylish-card">
            <CardContent className="p-6 md:p-8 flex flex-col md:flex-row items-center gap-8">
                <div className="flex-1 space-y-4">
                    <Skeleton className="h-6 w-32" />
                    <Skeleton className="h-12 w-64" />
                    <Skeleton className="h-4 w-full max-w-md" />
                </div>
                <div className="flex items-center gap-4">
                    <Skeleton className="h-[100px] w-[140px]" />
                    <Skeleton className="h-[100px] w-[140px]" />
                </div>
            </CardContent>
        </Card>
    )
}

export default function DashboardPage() {
    const appUser = useAppUser();
    const firestore = useFirestore();

    const accessibleNavItems = navItems.filter(item => {
        if (!appUser) return false;
        if (appUser.role === 'super-admin') return false; 
        return item.roles.includes(appUser.role);
    });

    const recordsQuery = useMemoFirebase(
      () => (firestore && appUser?.warehouseId ? query(collection(firestore, 'storageRecords'), where('warehouseId', '==', appUser.warehouseId)) : null),
      [firestore, appUser]
    );
    const { data: allRecords, loading: loadingRecords } = useCollection<StorageRecord>(recordsQuery);
  
    const lotsQuery = useMemoFirebase(
      () => (firestore && appUser?.warehouseId ? query(collection(firestore, 'lots'), where('warehouseId', '==', appUser.warehouseId)) : null),
      [firestore, appUser]
    );
    const { data: allLots, loading: loadingLots } = useCollection<Lot>(lotsQuery);

    const warehouseInfoRef = useMemoFirebase(
        () => (firestore && appUser?.warehouseId ? doc(firestore, 'warehouses', appUser.warehouseId) : null),
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
                <SuperAdminDashboard />
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
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 mb-8">
                {accessibleNavItems.map((item) => (
                    <NavCard key={item.href} {...item} />
                ))}
            </div>
        </AppLayout>
    );
}
