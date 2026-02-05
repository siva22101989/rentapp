'use client';

import { useState, useTransition, useEffect } from 'react';
import { Loader2, PackageCheck, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import type { DryingRecord } from '@/lib/definitions';
import { doc, updateDoc } from 'firebase/firestore';
import { format } from 'date-fns';
import { toDate, cleanForFirestore } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { useFirestore } from '@/firebase';

export function UpdatePackingDialog({ record, children }: { record: DryingRecord; children: React.ReactNode }) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const firestore = useFirestore();
  const isBilled = record.status === 'Billed';

  const [bagsPacked, setBagsPacked] = useState<string>('');
  const [packingDate, setPackingDate] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setBagsPacked(String(record.bagsPacked || ''));
      setPackingDate(record.packingDate ? format(toDate(record.packingDate), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'));
      setError(null);
    }
  }, [isOpen, record.bagsPacked, record.packingDate]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const bagsPackedNum = Number(bagsPacked);
    if (bagsPacked === '' || bagsPackedNum <= 0) {
      setError('Number of bags packed must be a positive number.');
      return;
    }
    if (!packingDate) {
      setError('Packing date is required.');
      return;
    }
    if (!firestore) {
      toast({ title: 'Error', description: 'Firestore not available.', variant: 'destructive' });
      return;
    }

    startTransition(async () => {
      try {
        const recordRef = doc(firestore, 'dryingRecords', record.id);
        await updateDoc(recordRef, cleanForFirestore({
          bagsPacked: bagsPackedNum,
          packingDate: new Date(packingDate),
          status: 'Packing',
        }));

        toast({ title: 'Success', description: 'Packing information updated successfully.' });
        setIsOpen(false);
      } catch (error) {
        console.error(error);
        toast({ title: 'Error', description: 'Failed to update packing info.', variant: 'destructive' });
      }
    });
  };

  const bagsDifference = bagsPacked !== '' ? record.bagsForDrying - Number(bagsPacked) : null;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Update Packing Information</DialogTitle>
          <DialogDescription>
            Record the final number of bags after packing is complete for this lot.
          </DialogDescription>
        </DialogHeader>
        <form id="update-packing-form" onSubmit={handleSubmit}>
          <div className="py-4 space-y-4">
            <Alert variant="default" className="bg-secondary/50">
              <Info className="h-4 w-4" />
              <AlertTitle>Bags Sent for Drying</AlertTitle>
              <AlertDescription>
                <span className="font-bold text-xl">{record.bagsForDrying}</span> bags
              </AlertDescription>
            </Alert>
            <div className="space-y-2">
              <Label htmlFor="bagsPacked">Number of Bags Packed</Label>
              <Input
                id="bagsPacked"
                type="number"
                placeholder="0"
                value={bagsPacked}
                onChange={(e) => setBagsPacked(e.target.value)}
                disabled={isBilled}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="packingDate">Packing Completion Date</Label>
              <Input
                id="packingDate"
                type="date"
                value={packingDate}
                onChange={(e) => setPackingDate(e.target.value)}
                disabled={isBilled}
              />
            </div>
            {error && <p className="text-sm font-medium text-destructive">{error}</p>}
            {bagsDifference !== null && bagsDifference !== 0 && (
              <p className="text-sm text-center font-medium text-destructive">
                Note: There is a difference of {Math.abs(bagsDifference)} bag{Math.abs(bagsDifference) > 1 ? 's' : ''} ({bagsDifference > 0 ? 'less' : 'more'}) after packing.
              </p>
            )}
          </div>
        </form>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline" type="button">Cancel</Button></DialogClose>
          {!isBilled && (
            <Button type="submit" form="update-packing-form" disabled={isPending}>
              {isPending ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>
              ) : (
                <><PackageCheck className="mr-2 h-4 w-4" /> Update Status to 'Packing'</>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
