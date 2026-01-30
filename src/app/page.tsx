
'use client';

import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowRight, Users, FileText, IndianRupee, ArrowDownToDot, ArrowUpFromDot, Warehouse, CreditCard, Database, ArrowDownFromLine, Wind, Settings, Wheat, ShieldAlert, Boxes } from "lucide-react";
import type { LucideIcon } from "lucide-react";

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
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg font-medium">{item.label}</CardTitle>
        <item.icon className="h-6 w-6 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-4">{item.description}</p>
        <Button asChild size="sm">
          <Link href={item.href}>
            Go to {item.label}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}


export default function DashboardPage() {
  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight font-headline">Welcome to BagBill</h1>
        <p className="mt-1 text-muted-foreground">Your central hub for managing warehouse storage and billing.</p>
      </div>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {navItems.map((item) => (
          <NavCard key={item.href} item={item} />
        ))}
      </div>
    </AppLayout>
  );
}
