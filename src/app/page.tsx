'use client';

import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowRight, Users, Warehouse, IndianRupee, FileText, ArrowDownToDot, ArrowUpFromDot, CreditCard, Settings, Wind, ShieldAlert, Wheat, ArrowDownFromLine } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useUser } from "@/firebase/auth/use-user";
import { useCollection } from "@/firebase/firestore/use-collection";
import { useFirestore } from "@/firebase";
import { collection } from "firebase/firestore";
import { useMemoFirebase } from "@/hooks/use-memo-firebase";
import type { Customer, StorageRecord } from "@/lib/definitions";
import { useMemo } from "react";
import { calculateFinalRent } from "@/lib/billing";
import { formatCurrency } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
};

const navItems: NavItem[] = [
  { href: '/inflow', label: 'Inflow', description: 'Add new items to storage.', icon: ArrowDownToDot },
  { href: '/unloading', label: 'Unloading Process', description: 'Manage item unloading.', icon: ArrowDownFromLine },
  { href: '/drying', label: 'Drying Process', description: 'Manage item drying.', icon: Wind },
  { href: '/outflow', label: 'Outflow', description: 'Process item withdrawals.', icon: ArrowUpFromDot },
  { href: '/storage', label: 'Storage', description: 'View all active storage.', icon: Warehouse },
  { href: '/payments/pending', label: 'Payments', description: 'Manage pending payments.', icon: IndianRupee },
  { href: '/customers', label: 'Customers', description: 'View and manage customers.', icon: Users },
  { href: '/commodities', label: 'Commodities & Lots', description: 'Manage commodity types, rents, and warehouse locations.', icon: Wheat },
  { href: '/reports', label: 'Reports', description: 'See all transactions.', icon: FileText },
  { href: '/expenses', label: 'Expenses', description: 'Track and manage expenses.', icon: CreditCard },
  { href: '/settings', label: 'Settings', description: 'Manage database operations.', icon: Settings },
  { href: '/anomaly-detection', label: 'Anomaly Detection', description: 'Use AI to find unusual patterns.', icon: ShieldAlert },
];


function NavCard({ item }: { item: NavItem }) {
  return (
    <Card className="flex flex-col transition-all hover:shadow-md hover:-translate-y-1">
      <CardHeader className="flex flex-row items-center justify-between p-4 pb-2">
        <CardTitle className="text-base font-medium leading-tight">{item.label}</CardTitle>
        <item.icon className="h-5 w-5 text-muted-foreground" />
      </CardHeader>
      <CardContent className="flex flex-1 flex-col p-4 pt-0">
        <p className="flex-1 text-xs text-muted-foreground mb-4">{item.description}</p>
        <Button asChild size="sm" className="w-full mt-auto">
          <Link href={item.href}>
            Open
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}


export default function DashboardPage() {
  const { user } = useUser();
  const firestore = useFirestore();

  const customersQuery = useMemoFirebase(
    () => (firestore ? collection(firestore, 'customers') : null),
    [firestore]
  );
  const { data: customers, loading: loadingCustomers } = useCollection<Customer>(customersQuery);
  
  const recordsQuery = useMemoFirebase(
    () => (firestore ? collection(firestore, 'storageRecords') : null),
    [firestore]
  );
  const { data: allRecords, loading: loadingRecords } = useCollection<StorageRecord>(recordsQuery);

  const stats = useMemo(() => {
    if (!allRecords || !customers) return { totalCustomers: 0, balanceStock: 0, estimatedRent: 0 };
    
    const balanceStock = allRecords.reduce((acc, record) => acc + record.bagsStored, 0);

    const activeRecords = allRecords.filter(r => !r.storageEndDate);
    const estimatedRent = activeRecords.reduce((total, record) => {
      const { rent } = calculateFinalRent(record, new Date(), record.bagsStored);
      return total + rent;
    }, 0);

    return { totalCustomers: customers.length, balanceStock, estimatedRent };

  }, [allRecords, customers]);

  const isLoading = loadingCustomers || loadingRecords;

  return (
    <AppLayout>
      <div>
        <div className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight font-headline">Welcome back, {user?.displayName || user?.email}!</h1>
            <p className="text-muted-foreground">Here's a snapshot of your warehouse activity.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-3 mb-8">
          <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Balance Stock</CardTitle>
                  <Warehouse className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                  {isLoading ? <div className="h-8 w-24 bg-muted rounded-md animate-pulse" /> : <div className="text-2xl font-bold">{stats.balanceStock} bags</div> }
                  <p className="text-xs text-muted-foreground">
                      Total bags currently in storage.
                  </p>
              </CardContent>
          </Card>
           <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Estimated Rent Due</CardTitle>
                  <IndianRupee className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                  {isLoading ? <div className="h-8 w-32 bg-muted rounded-md animate-pulse" /> : <div className="text-2xl font-bold">{formatCurrency(stats.estimatedRent)}</div>}
                  <p className="text-xs text-muted-foreground">
                      Based on current active stock.
                  </p>
              </CardContent>
          </Card>
          <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                  {isLoading ? <div className="h-8 w-16 bg-muted rounded-md animate-pulse" /> : <div className="text-2xl font-bold">{stats.totalCustomers}</div>}
                   <p className="text-xs text-muted-foreground">
                      Total customers registered.
                  </p>
              </CardContent>
          </Card>
        </div>
        
        <div>
          <h2 className="text-2xl font-bold tracking-tight font-headline mb-4">Management Sections</h2>
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {navItems.map((item) => (
              <NavCard key={item.href} item={item} />
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
