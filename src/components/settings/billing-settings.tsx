
'use client';
import { useFirestore } from '@/firebase/provider';
import { useCollection } from '@/firebase/firestore/use-collection';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { collection } from 'firebase/firestore';
import type { ManagedWarehouse } from '@/lib/definitions';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { format } from 'date-fns';
import { toDate, formatCurrency } from '@/lib/utils';
import { Badge } from '../ui/badge';
import { AddWarehouseDialog } from './add-warehouse-dialog';
import { Loader2 } from 'lucide-react';

export function BillingSettings() {
  const firestore = useFirestore();

  const warehousesQuery = useMemoFirebase(
    () => (firestore ? collection(firestore, 'managedWarehouses') : null),
    [firestore]
  );
  const { data: warehouses, loading } = useCollection<ManagedWarehouse>(warehousesQuery);

  const getStatusBadge = (status: ManagedWarehouse['subscriptionStatus']) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'trial': return 'bg-yellow-100 text-yellow-800';
      case 'expired': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  }

  return (
    <Card className="mt-6">
      <CardHeader className="flex-row items-start justify-between">
        <div>
          <CardTitle>Manage Warehouses</CardTitle>
          <CardDescription>Add, view, and manage warehouse subscriptions.</CardDescription>
        </div>
        <AddWarehouseDialog />
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Warehouse Name</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Owner Email</TableHead>
              <TableHead>Subscription</TableHead>
              <TableHead className="text-right">Yearly Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && <TableRow><TableCell colSpan={5} className="text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" /></TableCell></TableRow>}
            {!loading && warehouses?.map(wh => (
              <TableRow key={wh.id}>
                <TableCell className="font-medium">{wh.name}</TableCell>
                <TableCell>{wh.ownerName}</TableCell>
                <TableCell>{wh.ownerEmail}</TableCell>
                <TableCell>
                  <Badge variant="secondary" className={getStatusBadge(wh.subscriptionStatus)}>
                    {wh.subscriptionStatus}
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-mono">{formatCurrency(wh.yearlyAmount)}</TableCell>
              </TableRow>
            ))}
            {!loading && warehouses?.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
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
