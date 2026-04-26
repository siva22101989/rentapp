'use client';
import { useFirestore } from '@/firebase/provider';
import { useCollection } from '@/firebase/firestore/use-collection';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { collection } from 'firebase/firestore';
import type { ManagedWarehouse } from '@/lib/definitions';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { format, addMonths, addYears } from 'date-fns';
import { toDate, formatCurrency } from '@/lib/utils';
import { Badge } from '../ui/badge';
import { AddWarehouseDialog } from '../settings/add-warehouse-dialog';
import { Loader2, Warehouse, Users } from 'lucide-react';
import { WarehouseActionsMenu } from '../settings/warehouse-actions-menu';
import { useMemo } from 'react';
import { PageHeader } from '../shared/page-header';

export function SuperAdminDashboard() {
  const firestore = useFirestore();

  const warehousesQuery = useMemoFirebase(
    () => (firestore ? collection(firestore, 'managedWarehouses') : null),
    [firestore]
  );
  const { data: warehouses, loading: loadingWarehouses } = useCollection<ManagedWarehouse>(warehousesQuery);
  
  const { totalWarehouses, activeSubscriptions } = useMemo(() => {
    if (!warehouses) return { totalWarehouses: 0, activeSubscriptions: 0 };
    return {
        totalWarehouses: warehouses.length,
        activeSubscriptions: warehouses.filter(wh => wh.subscriptionStatus === 'active' || wh.subscriptionStatus === 'trial').length
    }
  }, [warehouses]);

  const loading = loadingWarehouses;

  const getStatusBadge = (status: ManagedWarehouse['subscriptionStatus']) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'trial': return 'bg-yellow-100 text-yellow-800';
      case 'suspended': return 'bg-orange-100 text-orange-800';
      case 'expired': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  }

  return (
    <>
        <PageHeader title="Super Admin Dashboard" description="Overview of all managed warehouses.">
            <AddWarehouseDialog />
        </PageHeader>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Warehouses</CardTitle>
                    <Warehouse className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{loading ? <Loader2 className="h-6 w-6 animate-spin" /> : totalWarehouses}</div>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Active Subscriptions</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{loading ? <Loader2 className="h-6 w-6 animate-spin" /> : activeSubscriptions}</div>
                </CardContent>
            </Card>
        </div>

        <Card>
            <CardHeader>
                <CardTitle>Warehouse Subscriptions</CardTitle>
                <CardDescription>Add, view, and manage warehouse subscriptions.</CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                <TableHeader>
                    <TableRow>
                    <TableHead>Warehouse Name</TableHead>
                    <TableHead>Owner</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Expires On</TableHead>
                    <TableHead className="text-right">Yearly Amount</TableHead>
                    <TableHead className="w-[50px] text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {loading && <TableRow><TableCell colSpan={7} className="text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" /></TableCell></TableRow>}
                    {!loading && warehouses?.map(wh => {
                    const createdAt = toDate(wh.createdAt);
                    let expiresOn: Date | null = null;
                    if (wh.subscriptionStatus === 'trial' && wh.trialMonths) {
                        expiresOn = addMonths(createdAt, wh.trialMonths);
                    } else if (wh.subscriptionStatus === 'active') {
                        expiresOn = addYears(createdAt, 1);
                    }

                    return (
                    <TableRow key={wh.id}>
                        <TableCell className="font-medium">{wh.name}</TableCell>
                        <TableCell>{wh.ownerName}</TableCell>
                        <TableCell>
                        <Badge variant="secondary" className={getStatusBadge(wh.subscriptionStatus)}>
                            {wh.subscriptionStatus}
                        </Badge>
                        </TableCell>
                        <TableCell>{format(createdAt, 'dd MMM yyyy')}</TableCell>
                        <TableCell>{expiresOn ? format(expiresOn, 'dd MMM yyyy') : 'N/A'}</TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(wh.yearlyAmount)}</TableCell>
                        <TableCell className="text-right">
                        <WarehouseActionsMenu warehouse={wh} />
                        </TableCell>
                    </TableRow>
                    )})}
                    {!loading && warehouses?.length === 0 && (
                    <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground">
                        No warehouses have been added yet.
                        </TableCell>
                    </TableRow>
                    )}
                </TableBody>
                </Table>
            </CardContent>
        </Card>
    </>
  )
}
