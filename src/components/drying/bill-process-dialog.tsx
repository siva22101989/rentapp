
'use client';

import { useState, useTransition, useMemo } from 'react';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { Button } from '../ui/button';
import { Loader2 } from 'lucide-react';
import { useFirestore } from '@/firebase/provider';
import { doc, getDocs, collection, writeBatch } from 'firebase/firestore';
import type { DryingRecord, UnloadingRecord, StorageRecord, Lot } from '@/lib/definitions';
import { toDate, cleanForFirestore } from '@/lib/utils';
import { format, differenceInDays } from 'date-fns';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAppUser } from '@/firebase/auth/use-user';

export function BillProcessDialog({
  record,
  unloadingRecord,
  lots,
  storageRecords,
  children,
}: {
  record: DryingRecord;
  unloadingRecord?: UnloadingRecord;
  lots: Lot[];
  storageRecords: StorageRecord[];
  children: React.ReactNode;
}) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const firestore = useFirestore();
  const appUser = useAppUser();
  const [location, setLocation] = useState('');

  const lotOccupancy = useMemo(() => {
    const occupancy: { [lotName: string]: number } = {};
    (storageRecords || []).forEach(record => {
      if (record.location && record.bagsStored > 0) {
        occupancy[record.location] = (occupancy[record.location] || 0) + record.bagsStored;
      }
    });
    return occupancy;
  }, [storageRecords]);

  const dryingDays = useMemo(() => {
    if (record.dryingStartDate && record.packingDate) {
        const start = toDate(record.dryingStartDate);
        const end = toDate(record.packingDate);
        if (end >= start) {
            return differenceInDays(end, start) + 1;
        }
    }
    return null;
  }, [record.dryingStartDate, record.packingDate]);

  const handleBilling = async () => {
    if (!firestore || !appUser) {
      toast({ title: 'Error', description: 'Firestore not available or user not authenticated.', variant: 'destructive' });
      return;
    }
    if (!record.packingDate) {
        toast({ title: 'Error', description: 'Cannot bill a record that has not been packed.', variant: 'destructive' });
        return;
    }
    if (!location.trim()) {
        toast({ title: 'Error', description: 'Please enter a Storage Location (Lot No.).', variant: 'destructive' });
        return;
    }

    startTransition(async () => {
      try {
        const maxId = storageRecords.reduce((max, r) => {
            const idNum = parseInt(r.id.replace(/[^0-9]/g, ''), 10);
            return isNaN(idNum) ? max : Math.max(max, idNum);
        }, 0);
        const nextSerialNumber = (maxId + 1).toString();
        
        // 2. Prepare new storage record
        const billingDate = new Date();
        const bagsStored = record.bagsPacked || 0;

        const newStorageRecord: Omit<StorageRecord, 'id'> = {
            warehouseId: appUser.warehouseId,
            customerId: record.customerId,
            commodityDescription: record.commodityDescription,
            location: location.trim(),
            bagsIn: bagsStored,
            bagsOut: 0,
            bagsStored: bagsStored,
            storageStartDate: billingDate,
            storageEndDate: null,
            billingCycle: '6-Month Initial' as const,
            payments: [], // No payment is made at this stage in the new flow
            hamaliPayable: record.totalDryingHamali, // Total hamali comes from the drying process
            totalRentBilled: 0,
            lorryTractorNo: unloadingRecord?.lorryTractorNo || '',
            weight: 0, // Not applicable for Plot to Storage
            inflowType: 'Plot' as const,
            dryingRecordId: record.id,
            khataAmount: 0, // Not applicable
        };

        // 3. Create a batch write to ensure atomicity
        const batch = writeBatch(firestore);

        const dryingRecordRef = doc(firestore, 'dryingRecords', record.id);
        batch.update(dryingRecordRef, cleanForFirestore({
            status: 'Billed',
            billingDate: billingDate,
        }));

        const newStorageRecordRef = doc(firestore, 'storageRecords', nextSerialNumber);
        batch.set(newStorageRecordRef, cleanForFirestore(newStorageRecord));
        
        // 4. Commit the batch
        await batch.commit();

        toast({ 
            title: 'Success!', 
            description: `Drying process billed and new storage record ${nextSerialNumber} created.` 
        });
        setIsOpen(false);
        
      } catch (error) {
         toast({
          title: 'Error',
          description: 'Failed to complete billing and create storage record.',
          variant: 'destructive',
        });
        console.error(error);
      }
    });
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Confirm Billing & Create Storage Record?</AlertDialogTitle>
          <AlertDialogDescription>
            This will mark the drying process for customer <span className="font-bold">{record.customerId}</span> as 'Billed', and automatically create the final storage record. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-4">
            <div className="text-sm space-y-1">
            <div><span className="font-medium text-foreground">Packing Date:</span> {record.packingDate ? format(toDate(record.packingDate), 'dd MMM yyyy') : 'N/A'}</div>
            {dryingDays !== null && (
              <div><span className="font-medium text-foreground">Total Drying Days:</span> {dryingDays}</div>
            )}
            <div><span className="font-medium text-foreground">Bags Packed:</span> {record.bagsPacked ?? 'N/A'}</div>
            </div>
            <div>
              <Label htmlFor="location">Storage Location (Lot No.)</Label>
              <Select onValueChange={setLocation} value={location} required>
                  <SelectTrigger id="location" className="mt-1">
                      <SelectValue placeholder="Select a lot" />
                  </SelectTrigger>
                  <SelectContent>
                      {lots
                        .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
                        .map(lot => {
                            const occupied = lotOccupancy[lot.name] || 0;
                            const capacity = lot.capacity ? ` / ${lot.capacity}` : '';
                            return (
                                <SelectItem key={lot.id} value={lot.name}>
                                    {lot.name} ({occupied}{capacity} bags)
                                </SelectItem>
                            )
                      })}
                  </SelectContent>
              </Select>
            </div>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <Button
            onClick={handleBilling}
            disabled={isPending || !location.trim()}
            className="bg-green-600 hover:bg-green-700"
          >
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirm and Create Record
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
