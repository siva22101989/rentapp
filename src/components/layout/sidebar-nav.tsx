
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from '@/components/ui/sidebar';
import { useAppUser } from '@/firebase/auth/use-user';
import type { LucideIcon } from 'lucide-react';
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
  Hammer
} from 'lucide-react';

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  roles: ('super-admin' | 'owner' | 'supervisor' | 'biller')[];
};

const navItems: NavItem[] = [
    { href: '/', label: 'Dashboard', icon: LayoutDashboard, roles: ['super-admin', 'owner', 'supervisor', 'biller'] },
    { href: '/inflow', label: 'Inflow', icon: ArrowDownToDot, roles: ['super-admin', 'owner', 'supervisor', 'biller'] },
    { href: '/unloading', label: 'Unloading Process', icon: ArrowDownFromLine, roles: ['super-admin', 'owner', 'supervisor', 'biller'] },
    { href: '/drying', label: 'Drying Process', icon: Wind, roles: ['super-admin', 'owner', 'supervisor', 'biller'] },
    { href: '/outflow', label: 'Outflow', icon: ArrowUpFromDot, roles: ['super-admin', 'owner', 'supervisor', 'biller'] },
    { href: '/storage', label: 'Storage', icon: Archive, roles: ['super-admin', 'owner', 'supervisor', 'biller'] },
    { href: '/payments/pending', label: 'Payments', icon: IndianRupee, roles: ['super-admin', 'owner', 'biller'] },
    { href: '/customers', label: 'Customers', icon: Users, roles: ['super-admin', 'owner', 'supervisor', 'biller'] },
    { href: '/reports', label: 'Reports', icon: FileText, roles: ['super-admin', 'owner', 'supervisor'] },
    { href: '/expenses', label: 'Profit & Loss', icon: Scale, roles: ['super-admin', 'owner'] },
    { href: '/hamali', label: 'Hamali Payments', icon: Hammer, roles: ['super-admin', 'owner'] },
];

const settingsNav: NavItem = { href: '/settings', label: 'Settings', icon: Settings, roles: ['super-admin', 'owner', 'supervisor', 'biller'] };


export function SidebarNav() {
  const pathname = usePathname();
  const appUser = useAppUser();

  if (!appUser) {
    return null; // Or a loading state
  }

  const accessibleNavItems = navItems.filter(item => item.roles.includes(appUser.role));
  const canAccessSettings = settingsNav.roles.includes(appUser.role);

  return (
    <>
        <SidebarMenu>
            {accessibleNavItems.map((item) => (
            <SidebarMenuItem key={item.href}>
                <Link href={item.href}>
                <SidebarMenuButton
                    isActive={pathname === item.href}
                    tooltip={item.label}
                >
                    <item.icon />
                    <span>{item.label}</span>
                </SidebarMenuButton>
                </Link>
            </SidebarMenuItem>
            ))}
        </SidebarMenu>
        
        {canAccessSettings && (
             <SidebarMenu>
                <SidebarMenuItem>
                    <Link href={settingsNav.href}>
                        <SidebarMenuButton
                            isActive={pathname.startsWith(settingsNav.href)}
                            tooltip={settingsNav.label}
                        >
                            <settingsNav.icon />
                            <span>{settingsNav.label}</span>
                        </SidebarMenuButton>
                    </Link>
                </SidebarMenuItem>
             </SidebarMenu>
        )}
    </>
  );
}
