
'use client';

import { useState, useTransition, useEffect } from 'react';
import { Loader2, Save, Info } from 'lucide-react';
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
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import type { DryingRecord, HamaliCharge } from '@/lib/definitions';
import { doc, updateDoc } from 'firebase/firestore';
import { format, differenceInDays } from 'date-fns';
import { toDate, cleanForFirestore, formatCurrency } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { useFirestore } from '@/firebase';


export function ManageDryingChargesDialog({ record, children }: { record: DryingRecord; children: React.ReactNode }) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const firestore = useFirestore();
  const isBilled = record.status === 'Billed';

  // Local state for direct control of inputs
  const [bagsPacked, setBagsPacked] = useState<string>('');
  const [packingDate, setPackingDate] = useState<string>('');
  const [additionalHamaliPerBagPerDay, setAdditionalHamaliPerBagPerDay] = useState<string>('');
  const [bagsDifference, setBagsDifference] = useState<number | null>(null);
  const [dryingDaysInfo, setDryingDaysInfo] = useState({ total: 0, extra: 0 });

  useEffect(() => {
    // This effect runs ONLY when the dialog opens to initialize the state.
    if (isOpen) {
      setBagsPacked(record.bagsPacked?.toString() ?? '');
      
      const pkDate = record.packingDate ? format(toDate(record.packingDate), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd');
      setPackingDate(pkDate);
      
      const additionalHamaliCharge = (record.hamaliCharges || []).find(c => c.description.toLowerCase().includes('additional drying'));
      
      if (additionalHamaliCharge) {
          const start = toDate(record.dryingStartDate);
          const end = toDate(record.packingDate || pkDate);
          const totalDays = differenceInDays(end, start) + 1;
          const extraDays = totalDays > 1 ? totalDays - 1 : 0;
          
          if (record.bagsForDrying > 0 && extraDays > 0) {
              const savedRate = additionalHamaliCharge.amount / record.bagsForDrying / extraDays;
              setAdditionalHamaliPerBagPerDay(savedRate.toFixed(2));
          } else {
              setAdditionalHamaliPerBagPerDay('');
          }
      } else {
          setAdditionalHamaliPerBagPerDay('');
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    // Recalculate drying days whenever the packing date changes.
    if (packingDate && record.dryingStartDate) {
        const start = toDate(record.dryingStartDate);
        const end = new Date(packingDate);
        // Add 1 to include start and end days
        const totalDays = differenceInDays(end, start) + 1; 
        const extraDays = totalDays > 1 ? totalDays - 1 : 0;
        setDryingDaysInfo({ total: totalDays > 0 ? totalDays : 0, extra: extraDays });
    } else {
        setDryingDaysInfo({ total: 0, extra: 0 });
    }
}, [packingDate, record.dryingStartDate]);

  useEffect(() => {
    // Calculate difference when bagsPacked changes
    const packed = Number(bagsPacked);
    if (!isNaN(packed) && bagsPacked !== '') {
      setBagsDifference(record.bagsForDrying - packed);
    } else {
      setBagsDifference(null);
    }
  }, [bagsPacked, record.bagsForDrying]);


  const handleSave = () => {
    if (!firestore || isBilled) {
      toast({ title: 'Error', description: 'Cannot update a billed record.', variant: 'destructive' });
      return;
    }
    
    // Manual Validation
    const packedBagsValue = bagsPacked === '' ? (record.bagsPacked || 0) : Number(bagsPacked);
    if (isNaN(packedBagsValue) || packedBagsValue < 0) {
        toast({ title: 'Invalid Input', description: 'Bags Packed must be a valid non-negative number.', variant: 'destructive'});
        return;
    }

    const additionalHamaliRateValue = additionalHamaliPerBagPerDay === '' ? 0 : Number(additionalHamaliPerBagPerDay);
     if (isNaN(additionalHamaliRateValue) || additionalHamaliRateValue < 0) {
        toast({ title: 'Invalid Input', description: 'Additional Hamali must be a valid non-negative number.', variant: 'destructive'});
        return;
    }

    startTransition(async () => {
      try {
        const finalPackingDate = new Date(packingDate);
        
        // --- Customer Charges Calculation ---
        const initialCustomerCharges = (record.hamaliCharges || []).filter(
            c => !c.description.toLowerCase().includes('additional drying')
        );

        const newCustomerCharges: HamaliCharge[] = [...initialCustomerCharges];
        const newAdditionalHamaliAmount = additionalHamaliRateValue * record.bagsForDrying * dryingDaysInfo.extra;
        
        if (newAdditionalHamaliAmount > 0) {
            newCustomerCharges.push({
                description: `Additional Drying Hamali (${dryingDaysInfo.extra} extra days)`,
                amount: newAdditionalHamaliAmount,
                date: finalPackingDate,
            });
        }
        
        const newTotalDryingHamali = newCustomerCharges.reduce((acc, charge) => acc + (charge.amount || 0), 0);
        
        // --- Worker Payable Calculation ---
        const previousAdditionalHamali = (record.hamaliCharges || []).find(c => c.description.toLowerCase().includes('additional drying'))?.amount || 0;
        
        const baseWorkerHamali = (record.totalDryingWorkerHamali || record.totalDryingHamali) - previousAdditionalHamali;

        const newTotalDryingWorkerHamali = baseWorkerHamali + newAdditionalHamaliAmount;

        // --- Update Firestore ---
        const recordRef = doc(firestore, 'dryingRecords', record.id);
        await updateDoc(recordRef, cleanForFirestore({
          bagsPacked: packedBagsValue,
          packingDate: finalPackingDate,
          status: 'Packing',
          hamaliCharges: newCustomerCharges,
          totalDryingHamali: newTotalDryingHamali,
          totalDryingWorkerHamali: newTotalDryingWorkerHamali,
        }));

        toast({ title: 'Success', description: 'Packing & charge information updated.' });
        setIsOpen(false);
      } catch (error) {
        console.error(error);
        toast({ title: 'Error', description: 'Failed to update record.', variant: 'destructive' });
      }
    });
  };


  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Update Packing & Charges</DialogTitle>
          <DialogDescription>
            Enter final packed bags and any additional charges for this lot.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <Alert variant="default" className="bg-secondary/50">
            <Info className="h-4 w-4" />
            <AlertTitle>Bags Sent for Drying</AlertTitle>
            <AlertDescription>
              <span className="font-bold text-xl">{record.bagsForDrying}</span> bags
            </AlertDescription>
          </Alert>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
                <Label htmlFor="bagsPacked">Bags Packed</Label>
                <Input
                  id="bagsPacked"
                  type="number"
                  placeholder="0"
                  disabled={isBilled}
                  value={bagsPacked}
                  onChange={(e) => setBagsPacked(e.target.value)}
                />
            </div>
             <div className="space-y-2">
                <Label htmlFor="packingDate">Packing Date</Label>
                <Input 
                    id="packingDate"
                    type="date" 
                    disabled={isBilled}
                    value={packingDate}
                    onChange={(e) => setPackingDate(e.target.value)}
                 />
            </div>
          </div>
          
          <div className="text-sm text-center text-muted-foreground">
            Total Drying Days: <span className="font-bold text-foreground">{dryingDaysInfo.total}</span> | Extra Days (after Day 1): <span className="font-bold text-foreground">{dryingDaysInfo.extra}</span>
          </div>
          
          {bagsDifference !== null && bagsDifference !== 0 && (
            <p className="text-sm text-center font-medium text-destructive">
              Note: There is a difference of {Math.abs(bagsDifference)} bag{Math.abs(bagsDifference) > 1 ? 's' : ''} ({bagsDifference > 0 ? 'less' : 'more'}) after packing.
            </p>
          )}

          <div className="space-y-2">
            <Label htmlFor="additionalHamaliPerBagPerDay">Additional Hamali (per bag, per extra day)</Label>
            <Input 
              id="additionalHamaliPerBagPerDay"
              type="number" 
              step="0.01" 
              placeholder="0.00" 
              disabled={isBilled} 
              value={additionalHamaliPerBagPerDay}
              onChange={(e) => setAdditionalHamaliPerBagPerDay(e.target.value)}
            />
          </div>
        </div>
        
        <DialogFooter>
          <DialogClose asChild><Button variant="outline" type="button">Cancel</Button></DialogClose>
          {!isBilled && (
            <Button onClick={handleSave} disabled={isPending}>
              {isPending ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>
              ) : (
                <><Save className="mr-2 h-4 w-4" /> Save and Update</>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
