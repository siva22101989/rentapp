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
  const [packingDate, setPackingDate] = useState<string | undefined>('');
  const [bagsForDrying, setBagsForDrying] = useState<number | ''>('');
  const [bagsPacked, setBagsPacked] = useState<number | '' | undefined>(undefined);
  const [customerHamaliPerBag, setCustomerHamaliPerBag] = useState<number | '' | undefined>(undefined);
  const [workerHamaliPerBag, setWorkerHamaliPerBag] = useState<number | '' | undefined>(undefined);
  const [pavHamaliPerBag, setPavHamaliPerBag] = useState<number | '' | undefined>(undefined);
  const [cuppaHamaliPerBag, setCuppaHamaliPerBag] = useState<number | '' | undefined>(undefined);
  const [errors, setErrors] = useState<Record<string, string>>({});


  useEffect(() => {
    if (isOpen) {
      const getRate = (desc: string) => record.hamaliDetails?.find(d => d.description.toLowerCase().includes(desc.toLowerCase()))?.rate;
      
      setDryingStartDate(format(toDate(record.dryingStartDate), 'yyyy-MM-dd'));
      setPackingDate(record.packingDate ? format(toDate(record.packingDate), 'yyyy-MM-dd') : '');
      setBagsForDrying(record.bagsForDrying);
      setBagsPacked(record.bagsPacked ?? undefined);
      setCustomerHamaliPerBag(getRate('customer'));
      setPavHamaliPerBag(getRate('pav'));
      setCuppaHamaliPerBag(getRate('cuppa'));
      setWorkerHamaliPerBag(record.workerHamaliPayable !== undefined && record.bagsForDrying > 0 ? record.workerHamaliPayable / record.bagsForDrying : undefined);
      setErrors({});
    }
  }, [isOpen, record]);
  
  const formValues = {
    dryingStartDate,
    packingDate,
    bagsForDrying,
    bagsPacked,
    customerHamaliPerBag,
    workerHamaliPerBag,
    pavHamaliPerBag,
    cuppaHamaliPerBag,
  };

  const calculatedHamali = useMemo(() => {
    const { dryingStartDate, packingDate, bagsForDrying, customerHamaliPerBag, workerHamaliPerBag, pavHamaliPerBag, cuppaHamaliPerBag } = formValues;

    const unloadingHamaliDetail = record.hamaliDetails?.find(d => d.description === 'Unloading Hamali');
    const proportionalUnloadingHamali = unloadingHamaliDetail?.amount || 0;

    const day1CustomerHamali = (Number(bagsForDrying) || 0) * (Number(customerHamaliPerBag) || 0);

    let extraDryingDays = 0;
    if (dryingStartDate && packingDate) {
        const start = new Date(dryingStartDate);
        const end = new Date(packingDate);
        if (end >= start) {
            const days = differenceInDays(end, start);
            extraDryingDays = days > 0 ? days : 0;
        }
    }
    
    const pavHamali = (Number(bagsForDrying) || 0) * (Number(pavHamaliPerBag) || 0) * extraDryingDays;
    const cuppaHamali = (Number(bagsForDrying) || 0) * (Number(cuppaHamaliPerBag) || 0) * extraDryingDays;
    const totalCustomerCharge = proportionalUnloadingHamali + day1CustomerHamali + pavHamali + cuppaHamali;
    
    const day1WorkerHamali = (Number(bagsForDrying) || 0) * (Number(workerHamaliPerBag) || 0);
    const totalWorkerPayable = proportionalUnloadingHamali + day1WorkerHamali + pavHamali + cuppaHamali;

    return {
        proportionalUnloadingHamali,
        day1CustomerHamali,
        pavHamali,
        cuppaHamali,
        totalCustomerCharge,
        extraDryingDays,
        totalWorkerPayable: workerHamaliPerBag !== undefined ? totalWorkerPayable : undefined,
    }

  }, [formValues, record.hamaliDetails]);

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
      bagsPacked: bagsPacked === '' || bagsPacked === undefined ? undefined : Number(bagsPacked),
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
        if(calculatedHamali.day1CustomerHamali > 0) hamaliDetails.push({ description: 'Customer Hamali', bags: data.bagsForDrying || 0, rate: data.customerHamaliPerBag || 0, amount: calculatedHamali.day1CustomerHamali });
        if(calculatedHamali.pavHamali > 0) hamaliDetails.push({ description: `Pav Hamali (${calculatedHamali.extraDryingDays} extra day${calculatedHamali.extraDryingDays !== 1 ? 's' : ''})`, bags: data.bagsForDrying || 0, rate: data.pavHamaliPerBag || 0, amount: calculatedHamali.pavHamali });
        if(calculatedHamali.cuppaHamali > 0) hamaliDetails.push({ description: `Cuppa Hamali (${calculatedHamali.extraDryingDays} extra day${calculatedHamali.extraDryingDays !== 1 ? 's' : ''})`, bags: data.bagsForDrying || 0, rate: data.cuppaHamaliPerBag || 0, amount: calculatedHamali.cuppaHamali });
        
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

        toast({ title: 'Success', description: 'Drying record has been updated.' });
        setIsOpen(false);
      } catch (error) {
        console.error(error);
        toast({ title: 'Error', description: error instanceof Error ? error.message : 'Failed to update record.', variant: 'destructive' });
      }
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-xl">
          <form onSubmit={onSubmit}>
            <DialogHeader>
              <DialogTitle>Edit Drying Record</DialogTitle>
              <DialogDescription>
                Update any detail for this process. Every field is fully unlocked and editable.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4 max-h-[70vh] overflow-y-auto pr-4">
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="dryingStartDate">Drying Start Date</Label>
                        <Input id="dryingStartDate" type="date" value={dryingStartDate} onChange={(e) => setDryingStartDate(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="packingDate">Packing Date (Optional)</Label>
                        <Input id="packingDate" type="date" value={packingDate || ''} onChange={(e) => setPackingDate(e.target.value)} />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="bagsForDrying">Bags Plotted for Drying</Label>
                        <Input id="bagsForDrying" type="number" value={bagsForDrying} onChange={(e) => setBagsForDrying(e.target.value === '' ? '' : Number(e.target.value))} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="bagsPacked">Bags Packed (Optional)</Label>
                        <Input id="bagsPacked" type="number" value={bagsPacked === undefined ? '' : bagsPacked} onChange={(e) => setBagsPacked(e.target.value === '' ? undefined : Number(e.target.value))} />
                    </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="customerHamaliPerBag">Cust. Hamali/Bag</Label>
                        <Input id="customerHamaliPerBag" type="number" step="0.01" value={customerHamaliPerBag === undefined ? '' : customerHamaliPerBag} onChange={(e) => setCustomerHamaliPerBag(e.target.value === '' ? undefined : Number(e.target.value))} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="workerHamaliPerBag">Worker Hamali/Bag</Label>
                        <Input id="workerHamaliPerBag" type="number" step="0.01" value={workerHamaliPerBag === undefined ? '' : workerHamaliPerBag} onChange={(e) => setWorkerHamaliPerBag(e.target.value === '' ? undefined : Number(e.target.value))} placeholder="Worker Rate" />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="pavHamaliPerBag">Pav Hamali/Bag/Day</Label>
                        <Input id="pavHamaliPerBag" type="number" step="0.01" value={pavHamaliPerBag === undefined ? '' : pavHamaliPerBag} onChange={(e) => setPavHamaliPerBag(e.target.value === '' ? undefined : Number(e.target.value))} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="cuppaHamaliPerBag">Cuppa Hamali/Bag/Day</Label>
                        <Input id="cuppaHamaliPerBag" type="number" step="0.01" value={cuppaHamaliPerBag === undefined ? '' : cuppaHamaliPerBag} onChange={(e) => setCuppaHamaliPerBag(e.target.value === '' ? undefined : Number(e.target.value))} />
                    </div>
                </div>
                
                {calculatedHamali && (
                    <div className="space-y-2 p-3 border rounded-md text-sm bg-secondary/30">
                        <h5 className="font-medium">Live Summary</h5>
                        <div className="flex justify-between font-semibold"><span >Total Hamali for Customer:</span> <span className="font-mono">{formatCurrency(calculatedHamali.totalCustomerCharge)}</span></div>
                         {calculatedHamali.totalWorkerPayable !== undefined && <div className="flex justify-between font-semibold"><span >Total Payable to Worker:</span> <span className="font-mono">{formatCurrency(calculatedHamali.totalWorkerPayable)}</span></div>}
                    </div>
                )}
            </div>
            <DialogFooter>
              <DialogClose asChild><Button variant="outline" type="button">Cancel</Button></DialogClose>
              <Button type="submit" disabled={isPending}>
                {isPending ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>
                ) : (
                  <><Save className="mr-2 h-4 w-4" /> Save Changes</>
                )}
              </Button>
            </DialogFooter>
          </form>
      </DialogContent>
    </Dialog>
  );
}