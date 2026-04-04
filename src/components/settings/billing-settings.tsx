
'use client';
import { useFirestore } from '@/firebase/provider';
import { useCollection } from '@/firebase/firestore/use-collection';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { collection } from 'firebase/firestore';
import type { ManagedWarehouse, StorageRecord, Lot } from '@/lib/definitions';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { format, addMonths, addYears } from 'date-fns';
import { toDate, formatCurrency } from '@/lib/utils';
import { Badge } from '../ui/badge';
import { AddWarehouseDialog } from './add-warehouse-dialog';
import { Loader2 } from 'lucide-react';
import { WarehouseActionsMenu } from './warehouse-actions-menu';
import { useMemo } from 'react';

export function BillingSettings() {
  const firestore = useFirestore();

  const warehousesQuery = useMemoFirebase(
    () => (firestore ? collection(firestore, 'managedWarehouses') : null),
    [firestore]
  );
  const { data: warehouses, loading: loadingWarehouses } = useCollection<ManagedWarehouse>(warehousesQuery);
  
  const recordsQuery = useMemoFirebase(() => (firestore ? collection(firestore, 'storageRecords') : null), [firestore]);
  const { data: allRecords, loading: loadingRecords } = useCollection<StorageRecord>(recordsQuery);

  const lotsQuery = useMemoFirebase(() => (firestore ? collection(firestore, 'lots') : null), [firestore]);
  const { data: allLots, loading: loadingLots } = useCollection<Lot>(lotsQuery);

  const warehouseStats = useMemo(() => {
    if (!warehouses || !allRecords || !allLots) return {};
    
    const stats: { [warehouseId: string]: { activeBags: number, occupancy: number } } = {};

    for (const wh of warehouses) {
      const warehouseRecords = allRecords.filter(r => r.warehouseId === wh.id && !r.storageEndDate && r.bagsStored > 0);
      const activeBags = warehouseRecords.reduce((acc, r) => acc + r.bagsStored, 0);

      const warehouseLots = allLots.filter(l => l.warehouseId === wh.id);
      const totalCapacity = warehouseLots.reduce((acc, l) => acc + (l.capacity || 0), 0);
      const occupancy = totalCapacity > 0 ? (activeBags / totalCapacity) * 100 : 0;
      
      stats[wh.id] = { activeBags, occupancy };
    }
    return stats;
  }, [warehouses, allRecords, allLots]);
  
  const loading = loadingWarehouses || loadingRecords || loadingLots;


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
    <Card className="mt-6">
      <CardHeader className="flex-row items-start justify-between">
        <div>
          <CardTitle>Warehouse Subscriptions</CardTitle>
          <CardDescription>Add, view, and manage warehouse subscriptions and their live stats.</CardDescription>
        </div>
        <AddWarehouseDialog />
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
              <TableHead>Active Bags</TableHead>
              <TableHead>Occupancy</TableHead>
              <TableHead className="text-right">Yearly Amount</TableHead>
              <TableHead className="w-[50px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && <TableRow><TableCell colSpan={9} className="text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" /></TableCell></TableRow>}
            {!loading && warehouses?.map(wh => {
              const createdAt = toDate(wh.createdAt);
              let expiresOn: Date | null = null;
              if (wh.subscriptionStatus === 'trial' && wh.trialMonths) {
                  expiresOn = addMonths(createdAt, wh.trialMonths);
              } else if (wh.subscriptionStatus === 'active') {
                  expiresOn = addYears(createdAt, 1);
              }

              const stats = warehouseStats[wh.id] || { activeBags: 0, occupancy: 0 };

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
                <TableCell className="font-mono">{stats.activeBags}</TableCell>
                <TableCell className="font-mono">{stats.occupancy.toFixed(1)}%</TableCell>
                <TableCell className="text-right font-mono">{formatCurrency(wh.yearlyAmount)}</TableCell>
                <TableCell className="text-right">
                  <WarehouseActionsMenu warehouse={wh} />
                </TableCell>
              </TableRow>
            )})}
            {!loading && warehouses?.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground">
                  No warehouses have been added yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
