
'use client';

import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowRight, Users, Warehouse, IndianRupee, FileText, ArrowDownToDot, ArrowUpFromDot, Scale, Settings, Wind, ShieldAlert, Wheat, ArrowDownFromLine, Archive } from "lucide-react";
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
  { href: '/storage', label: 'Storage', description: 'View all active storage.', icon: Archive },
  { href: '/payments/pending', label: 'Payments', description: 'Manage pending payments.', icon: IndianRupee },
  { href: '/customers', label: 'Customers', description: 'View and manage customers.', icon: Users },
  { href: '/commodities', label: 'Commodities & Lots', description: 'Manage commodity types, rents, and warehouse locations.', icon: Wheat },
  { href: '/reports', label: 'Reports', description: 'See all transactions.', icon: FileText },
  { href: '/expenses', label: 'Profit & Loss', description: 'Track income, expenses, and net profit.', icon: Scale },
  { href: '/settings', label: 'Settings', description: 'Manage database operations.', icon: Settings },
];


function NavCard({ item }: { item: NavItem }) {
  return (
    <Card className="flex flex-col transition-all hover:shadow-lg hover:-translate-y-0.5">
      <CardHeader className="flex-row items-start justify-between p-4 pb-2">
        <div>
          <CardTitle className="text-lg">{item.label}</CardTitle>
          <CardDescription className="pt-1 text-sm min-h-[40px]">{item.description}</CardDescription>
        </div>
        <item.icon className="h-6 w-6 text-muted-foreground shrink-0" />
      </CardHeader>
      <CardContent className="flex flex-1 items-end p-4 pt-0">
        <Button asChild size="lg" className="w-full">
          <Link href={item.href}>
            Go to {item.label.split(' ')[0]}
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
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {navItems.map((item) => (
          <NavCard key={item.href} item={item} />
        ))}
      </div>
    </AppLayout>
  );
}
