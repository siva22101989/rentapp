'use client';

import { useState, useTransition, useEffect, useMemo } from 'react';
import { z } from 'zod';
import { Loader2, Save } from 'lucide-react';
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
import { useToast } from '@/hooks/use-toast';
import type { DryingRecord, UnloadingRecord, HamaliChargeItem } from '@/lib/definitions';
import { format, differenceInDays } from 'date-fns';
import { toDate, cleanForFirestore, formatCurrency } from '@/lib/utils';
import { useFirestore } from '@/firebase/provider';
import { updateDryingRecord } from '@/lib/data';
import { Separator } from '../ui/separator';
import { Label } from '../ui/label';

const EditDryingSchema = z.object({
  dryingStartDate: z.string().refine(val => !isNaN(Date.parse(val))),
  packingDate: z.string().optional(),
  bagsForDrying: z.coerce.number().int().nonnegative(),
  bagsPacked: z.coerce.number().int().nonnegative().optional(),
  customerHamaliPerBag: z.coerce.number().nonnegative().optional(),
  workerHamaliPerBag: z.coerce.number().nonnegative().optional(),
  pavHamaliPerBag: z.coerce.number().nonnegative().optional(),
  cuppaHamaliPerBag: z.coerce.number().nonnegative().optional(),
});

export function EditDryingDialog({ record, unloadingRecord, children }: { record: DryingRecord; unloadingRecord?: UnloadingRecord; children: React.ReactNode }) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const firestore = useFirestore();

  const [dryingStartDate, setDryingStartDate] = useState('');
  const [packingDate, setPackingDate] = useState('');
  const [bagsForDrying, setBagsForDrying] = useState<number | ''>('');
  const [bagsPacked, setBagsPacked] = useState<number | ''>('');
  const [customerHamaliPerBag, setCustomerHamaliPerBag] = useState<number | ''>('');
  const [workerHamaliPerBag, setWorkerHamaliPerBag] = useState<number | ''>('');
  const [pavHamaliPerBag, setPavHamaliPerBag] = useState<number | ''>('');
  const [cuppaHamaliPerBag, setCuppaHamaliPerBag] = useState<number | ''>('');
  const [errors, setErrors] = useState<Record<string, string>>({});


  useEffect(() => {
    if (isOpen) {
      const getRate = (desc: string) => record.hamaliDetails?.find(d => d.description.toLowerCase().includes(desc.toLowerCase()))?.rate;
      
      setDryingStartDate(record.dryingStartDate ? format(toDate(record.dryingStartDate), 'yyyy-MM-dd') : '');
      setPackingDate(record.packingDate ? format(toDate(record.packingDate), 'yyyy-MM-dd') : '');
      setBagsForDrying(record.bagsForDrying ?? '');
      setBagsPacked(record.bagsPacked ?? '');
      setCustomerHamaliPerBag(getRate('customer') ?? '');
      setPavHamaliPerBag(getRate('pav') ?? '');
      setCuppaHamaliPerBag(getRate('cuppa') ?? '');
      setWorkerHamaliPerBag(record.workerHamaliPayable !== undefined && (record.bagsForDrying || 1) > 0 
        ? record.workerHamaliPayable / (record.bagsForDrying || 1) 
        : '');
      setErrors({});
    }
  }, [isOpen, record]);
  
  const calculatedHamali = useMemo(() => {
    const unloadingHamaliDetail = record.hamaliDetails?.find(d => d.description === 'Unloading Hamali');
    const proportionalUnloadingHamali = unloadingHamaliDetail?.amount || 0;

    const bags = Number(bagsForDrying) || 0;
    const day1CustomerHamali = bags * (Number(customerHamaliPerBag) || 0);

    let extraDryingDays = 0;
    if (dryingStartDate && packingDate) {
        const start = new Date(dryingStartDate);
        const end = new Date(packingDate);
        if (end >= start) {
            const days = differenceInDays(end, start);
            extraDryingDays = days > 0 ? days : 0;
        }
    }
    
    const pavHamali = bags * (Number(pavHamaliPerBag) || 0) * extraDryingDays;
    const cuppaHamali = bags * (Number(cuppaHamaliPerBag) || 0) * extraDryingDays;
    const totalCustomerCharge = proportionalUnloadingHamali + day1CustomerHamali + pavHamali + cuppaHamali;
    
    const day1WorkerHamali = bags * (Number(workerHamaliPerBag) || 0);
    const totalWorkerPayable = proportionalUnloadingHamali + day1WorkerHamali + pavHamali + cuppaHamali;

    return {
        proportionalUnloadingHamali,
        day1CustomerHamali,
        pavHamali,
        cuppaHamali,
        totalCustomerCharge,
        extraDryingDays,
        totalWorkerPayable: workerHamaliPerBag !== '' ? totalWorkerPayable : undefined,
    }

  }, [bagsForDrying, customerHamaliPerBag, dryingStartDate, packingDate, pavHamaliPerBag, cuppaHamaliPerBag, workerHamaliPerBag, record.hamaliDetails]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    if (!firestore) {
      toast({ title: 'Error', description: 'Firestore not available.', variant: 'destructive' });
      return;
    }
    
    const dataToValidate = {
      dryingStartDate,
      packingDate: packingDate || undefined,
      bagsForDrying: Number(bagsForDrying),
      bagsPacked: bagsPacked === '' ? undefined : Number(bagsPacked),
      customerHamaliPerBag: customerHamaliPerBag === '' ? undefined : Number(customerHamaliPerBag),
      workerHamaliPerBag: workerHamaliPerBag === '' ? undefined : Number(workerHamaliPerBag),
      pavHamaliPerBag: pavHamaliPerBag === '' ? undefined : Number(pavHamaliPerBag),
      cuppaHamaliPerBag: cuppaHamaliPerBag === '' ? undefined : Number(cuppaHamaliPerBag),
    };

    const result = EditDryingSchema.safeParse(dataToValidate);

    if (!result.success) {
      toast({ title: 'Validation Error', description: 'Please check the form for errors.', variant: 'destructive'});
      return;
    }

    const data = result.data;
    
    startTransition(async () => {
      try {
        const hamaliDetails: HamaliChargeItem[] = [];
        const unloadingHamaliDetail = record.hamaliDetails?.find(d => d.description === 'Unloading Hamali');
        if(unloadingHamaliDetail) hamaliDetails.push(unloadingHamaliDetail);
        if(calculatedHamali.day1CustomerHamali > 0) hamaliDetails.push({ description: 'Customer Hamali', bags: data.bagsForDrying, rate: data.customerHamaliPerBag || 0, amount: calculatedHamali.day1CustomerHamali });
        if(calculatedHamali.pavHamali > 0) hamaliDetails.push({ description: `Pav Hamali (${calculatedHamali.extraDryingDays} extra day${calculatedHamali.extraDryingDays !== 1 ? 's' : ''})`, bags: data.bagsForDrying, rate: data.pavHamaliPerBag || 0, amount: calculatedHamali.pavHamali });
        if(calculatedHamali.cuppaHamali > 0) hamaliDetails.push({ description: `Cuppa Hamali (${calculatedHamali.extraDryingDays} extra day${calculatedHamali.extraDryingDays !== 1 ? 's' : ''})`, bags: data.bagsForDrying, rate: data.cuppaHamaliPerBag || 0, amount: calculatedHamali.cuppaHamali });
        
        const updateData: Partial<DryingRecord> = {
          dryingStartDate: new Date(data.dryingStartDate),
          packingDate: data.packingDate ? new Date(data.packingDate) : null,
          bagsForDrying: data.bagsForDrying,
          bagsPacked: data.bagsPacked,
          status: data.packingDate ? 'Packing' : 'Drying',
          hamaliDetails,
          totalDryingHamali: calculatedHamali.totalCustomerCharge,
        };
        
        if (calculatedHamali.totalWorkerPayable !== undefined) {
            updateData.workerHamaliPayable = calculatedHamali.totalWorkerPayable;
        }
        
        await updateDryingRecord(firestore, record.id, record.bagsForDrying, updateData);

        toast({ title: 'Success', description: 'Drying record updated successfully.' });
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
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <form onSubmit={onSubmit}>
            <DialogHeader>
              <DialogTitle>Edit Drying Record</DialogTitle>
              <DialogDescription>
                Adjust any detail for this process. All fields are unlocked.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4 pr-2">
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="dryingStartDate">Drying Start Date</Label>
                        <Input id="dryingStartDate" type="date" value={dryingStartDate} onChange={(e) => setDryingStartDate(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="packingDate">Packing Date (Optional)</Label>
                        <Input id="packingDate" type="date" value={packingDate} onChange={(e) => setPackingDate(e.target.value)} />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="bagsForDrying">Bags for Drying</Label>
                        <Input id="bagsForDrying" type="number" value={bagsForDrying} onChange={(e) => setBagsForDrying(e.target.value === '' ? '' : Number(e.target.value))} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="bagsPacked">Bags Packed (Optional)</Label>
                        <Input id="bagsPacked" type="number" value={bagsPacked} onChange={(e) => setBagsPacked(e.target.value === '' ? '' : Number(e.target.value))} />
                    </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 border rounded-lg bg-secondary/10">
                    <div className="space-y-2">
                        <Label htmlFor="customerHamaliPerBag">Cust. Rate</Label>
                        <Input id="customerHamaliPerBag" type="number" step="0.01" value={customerHamaliPerBag} onChange={(e) => setCustomerHamaliPerBag(e.target.value === '' ? '' : Number(e.target.value))} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="workerHamaliPerBag">Worker Rate</Label>
                        <Input id="workerHamaliPerBag" type="number" step="0.01" value={workerHamaliPerBag} onChange={(e) => setWorkerHamaliPerBag(e.target.value === '' ? '' : Number(e.target.value))} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="pavHamaliPerBag">Pav Rate</Label>
                        <Input id="pavHamaliPerBag" type="number" step="0.01" value={pavHamaliPerBag} onChange={(e) => setPavHamaliPerBag(e.target.value === '' ? '' : Number(e.target.value))} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="cuppaHamaliPerBag">Cuppa Rate</Label>
                        <Input id="cuppaHamaliPerBag" type="number" step="0.01" value={cuppaHamaliPerBag} onChange={(e) => setCuppaHamaliPerBag(e.target.value === '' ? '' : Number(e.target.value))} />
                    </div>
                </div>
            </div>
            <DialogFooter className="gap-2">
              <DialogClose asChild><Button variant="outline" type="button">Cancel</Button></DialogClose>
              <Button type="submit" disabled={isPending}>
                {isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : <><Save className="mr-2 h-4 w-4" /> Save Changes</>}
              </Button>
            </DialogFooter>
          </form>
      </DialogContent>
    </Dialog>
  );
}
