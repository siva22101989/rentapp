'use client';

import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowRight, Users, Warehouse, IndianRupee, FileText, ArrowDownToDot, ArrowUpFromDot, CreditCard, Settings, Wind, ShieldAlert, Wheat, ArrowDownFromLine } from "lucide-react";
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
  return (
    <AppLayout>
      <div className="space-y-8">
        <div>
          <h2 className="text-xl font-bold tracking-tight font-headline mb-4">Management Sections</h2>
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
