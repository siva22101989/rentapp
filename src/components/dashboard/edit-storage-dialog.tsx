
'use client';

import { useEffect, useState, useTransition, useMemo } from 'react';
import { Loader2, Save, Calculator, Scale } from 'lucide-react';
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
import type { Customer, StorageRecord, Commodity, Lot, HamaliChargeItem } from '@/lib/definitions';
import { differenceInDays, format } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { toDate, cleanForFirestore, formatCurrency } from '@/lib/utils';
import { z } from 'zod';
import { useFirestore } from '@/firebase/provider';
import { updateStorageRecord } from '@/lib/data';
import { useCollection } from '@/firebase/firestore/use-collection';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { collection, query, where } from "firebase/firestore";
import { Separator } from '../ui/separator';
import { useAppUser } from '@/firebase/auth/use-user';
import { Combobox } from '../ui/combobox';

const EditStorageRecordSchema = z.object({
  storageId: z.string().min(1, 'Storage ID is required.'),
  customerId: z.string().min(1, 'Customer is required.'),
  commodityDescription: z.string().min(1, 'Commodity is required.'),
  location: z.string().optional(),
  storageStartDate: z.string().min(1, 'Inflow date is required.'),
  bagsIn: z.coerce.number().nonnegative('Must be a non-negative number.'),
  weight: z.coerce.number().nonnegative('Must be a non-negative number.').optional(),
  lorryTractorNo: z.string().optional(),
  khataAmount: z.coerce.number().nonnegative().optional(),
  hamaliRate: z.coerce.number().nonnegative().optional(),
  workerHamaliPayable: z.coerce.number().nonnegative().optional(),
  hamaliPayable: z.coerce.number().nonnegative().optional(),
});

export function EditStorageDialog({ record, customers, allRecords, children }: { record: StorageRecord, customers: Customer[], allRecords: StorageRecord[], children: React.ReactNode }) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const firestore = useFirestore();
  const appUser = useAppUser();
  
  const [storageId, setStorageId] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [commodityDescription, setCommodityDescription] = useState('');
  const [location, setLocation] = useState('');
  const [storageStartDate, setStorageStartDate] = useState('');
  const [bagsIn, setBagsIn] = useState<number | ''>('');
  const [weight, setWeight] = useState<number | ''>('');
  const [lorryTractorNo, setLorryTractorNo] = useState('');
  const [khataAmount, setKhataAmount] = useState<number | ''>('');
  const [hamaliRate, setHamaliRate] = useState<number | ''>('');
  
  // Manual Override States
  const [hamaliPayable, setHamaliPayable] = useState<number | ''>('');
  const [workerHamaliTotal, setWorkerHamaliTotal] = useState<number | ''>('');

  const [errors, setErrors] = useState<Record<string, string>>({});

  const commoditiesQuery = useMemoFirebase(
    () => (firestore && appUser?.warehouseId ? query(collection(firestore, 'commodities'), where('warehouseId', '==', appUser.warehouseId)) : null),
    [firestore, appUser]
  );
  const { data: commodities } = useCollection<Commodity>(commoditiesQuery);

  const lotsQuery = useMemoFirebase(
    () => (firestore && appUser?.warehouseId ? query(collection(firestore, 'lots'), where('warehouseId', '==', appUser.warehouseId)) : null),
    [firestore, appUser]
  );
  const { data: lots } = useCollection<Lot>(lotsQuery);

  const lotOccupancy = useMemo(() => {
    if (!isOpen) return {};
    const occupancy: { [lotName: string]: number } = {};
    (allRecords || []).forEach(r => {
        if (r.location && r.bagsStored > 0 && r.id !== record.id) {
            occupancy[r.location] = (occupancy[r.location] || 0) + r.bagsStored;
        }
    });
    return occupancy;
  }, [allRecords, record.id, isOpen]);

  const customerOptions = useMemo(() => customers.map(c => ({ value: c.id, label: c.name })), [customers]);
  const commodityOptions = useMemo(() => (commodities || []).map(c => ({ value: c.name, label: c.name })), [commodities]);

  useEffect(() => {
    if (isOpen) {
      setStorageId(record.id);
      setCustomerId(record.customerId || '');
      setCommodityDescription(record.commodityDescription || '');
      setLocation(record.location || '');
      setStorageStartDate(format(toDate(record.storageStartDate), 'yyyy-MM-dd'));
      setBagsIn(record.bagsIn ?? record.bagsStored ?? '');
      setWeight(record.weight ?? '');
      setLorryTractorNo(record.lorryTractorNo || '');
      setKhataAmount(record.khataAmount ?? '');
      setHamaliRate(record.hamaliRate ?? '');
      
      // Initialize totals
      setHamaliPayable(record.hamaliPayable ?? '');
      setWorkerHamaliTotal(record.workerHamaliPayable ?? (record.hamaliPayable || ''));

      setErrors({});
    }
  }, [isOpen, record]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    if (!firestore) {
      toast({ variant: 'destructive', title: 'Error', description: 'Firestore not available' });
      return;
    }

    const dataToValidate = {
      storageId,
      customerId,
      commodityDescription,
      location,
      storageStartDate,
      bagsIn: Number(bagsIn),
      weight: Number(weight),
      lorryTractorNo,
      khataAmount: Number(khataAmount),
      hamaliRate: Number(hamaliRate),
      hamaliPayable: Number(hamaliPayable),
      workerHamaliPayable: Number(workerHamaliTotal),
    };
    
    const result = EditStorageRecordSchema.safeParse(dataToValidate);

    if (!result.success) {
      const fieldErrors = result.error.flatten().fieldErrors;
      const newErrors: Record<string, string> = {};
      Object.keys(fieldErrors).forEach(key => {
        if (fieldErrors[key]) newErrors[key] = fieldErrors[key]![0];
      });
      setErrors(newErrors);
      return;
    }
    
    const data = result.data;
    
    startTransition(async () => {
      try {
        const finalStorageDate = new Date(data.storageStartDate);
        const bagsStored = data.bagsIn - (record.bagsOut || 0);

        const updateData: Partial<StorageRecord> = {
            customerId: data.customerId,
            commodityDescription: data.commodityDescription,
            location: data.location,
            storageStartDate: finalStorageDate,
            bagsIn: data.bagsIn,
            bagsStored,
            weight: data.weight || 0,
            lorryTractorNo: data.lorryTractorNo,
            khataAmount: data.khataAmount,
            hamaliRate: data.hamaliRate,
            hamaliPayable: data.hamaliPayable, 
            workerHamaliPayable: data.workerHamaliPayable,
        };

        await updateStorageRecord(firestore, record.id, data.storageId, updateData);
        toast({ title: 'Success', description: 'Record updated successfully.' });
        setIsOpen(false);
      } catch (error) {
        console.error(error);
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to update record.' });
      }
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>Edit Storage Record</DialogTitle>
            <DialogDescription className="text-xs">
              Separate totals for Customer Billing and Worker Payable.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4 pr-2">
             <div className="space-y-1.5">
                <Label htmlFor="edit-storage-id" className="text-xs">Storage ID</Label>
                <Input id="edit-storage-id" className="font-mono font-bold text-sm h-9" value={storageId} onChange={e => setStorageId(e.target.value)} />
              </div>
             <div className="space-y-1.5">
                <Label className="text-xs">Customer</Label>
                <Combobox options={customerOptions} value={customerId} onChange={setCustomerId} placeholder="Select customer..." modal={true} />
              </div>
               <div className="space-y-1.5">
                <Label className="text-xs">Commodity</Label>
                <Combobox options={commodityOptions} value={commodityDescription} onChange={setCommodityDescription} placeholder="Select product..." modal={true} />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Inflow Date</Label>
                    <Input type="date" value={storageStartDate} onChange={e => setStorageStartDate(e.target.value)} className="text-sm h-9" />
                    {errors.storageStartDate && <p className="text-[10px] text-destructive">{errors.storageStartDate}</p>}
                  </div>
                  <div className="space-y-1.5"><Label className="text-xs">Lorry/Tractor No.</Label><Input value={lorryTractorNo} onChange={e => setLorryTractorNo(e.target.value)} className="text-sm h-9" /></div>
              </div>

              <div className="p-4 rounded-xl border bg-slate-50/50 space-y-4">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                    <Scale className="h-3 w-3" />
                    Weight & Bag conversion (77kg Basis)
                </h4>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <Label className="text-[11px] font-bold text-slate-500 uppercase">Total Weight (Kgs)</Label>
                        <Input 
                            type="number" 
                            step="0.01" 
                            placeholder="0.00" 
                            value={weight} 
                            onChange={e => {
                                const val = e.target.value === '' ? '' : Number(e.target.value);
                                setWeight(val);
                                if (val !== '') {
                                    setBagsIn(Math.round((val / 77) * 100) / 100);
                                }
                            }} 
                            className="text-sm h-9 font-mono" 
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-[11px] font-bold text-primary uppercase">No. of Bags</Label>
                        <Input 
                            type="number" 
                            step="0.01" 
                            value={bagsIn} 
                            onChange={(e) => setBagsIn(e.target.value === '' ? '' : Number(e.target.value))} 
                            className="text-sm h-9 border-primary/40 font-mono font-black text-primary" 
                        />
                    </div>
                </div>
              </div>

              <Separator className="my-2" />
              
              <div className="p-4 rounded-xl border bg-slate-50/50 space-y-4">
                <h4 className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-2">
                    <Calculator className="h-3 w-3" />
                    Handling Fees & Worker Payout
                </h4>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <Label className="text-xs font-bold text-primary uppercase">Customer Rate/Bag</Label>
                        <Input type="number" step="0.01" value={hamaliRate} onChange={e => setHamaliRate(e.target.value === '' ? '' : Number(e.target.value))} className="text-sm h-9" />
                    </div>
                     <div className="space-y-1.5">
                        <Label className="text-xs">Khata Amount</Label>
                        <Input type="number" step="0.01" value={khataAmount} onChange={e => setKhataAmount(e.target.value === '' ? '' : Number(e.target.value))} className="text-sm h-9" />
                    </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <Label className="text-[10px] font-black text-primary uppercase tracking-tighter">Billed Total (Customer)</Label>
                        <Input type="number" step="0.01" value={hamaliPayable} onChange={e => setHamaliPayable(e.target.value === '' ? '' : Number(e.target.value))} className="text-sm h-9 border-primary/50 font-mono font-bold" />
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-[10px] font-black text-orange-600 uppercase tracking-tighter">Payable Total (Hamali)</Label>
                        <Input type="number" step="0.01" value={workerHamaliTotal} onChange={e => setWorkerHamaliTotal(e.target.value === '' ? '' : Number(e.target.value))} className="text-sm h-9 border-orange-400 font-mono font-bold" />
                    </div>
                </div>
              </div>

               <div className="space-y-1.5 pt-2">
                 <Label className="text-xs">Lot No. (Storage Location)</Label>
                 <Select onValueChange={setLocation} value={location}>
                     <SelectTrigger className="text-sm h-9"><SelectValue placeholder="Select a lot..."/></SelectTrigger>
                     <SelectContent>
                         {(lots || []).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })).map(lot => {
                             const occupied = lotOccupancy[lot.name] || 0;
                             return ( <SelectItem key={lot.id} value={lot.name} className="text-sm"> {lot.name} ({occupied} bags) </SelectItem> )
                         })}
                     </SelectContent>
                 </Select>
                </div>
          </div>
          <DialogFooter className="gap-2">
            <DialogClose asChild><Button variant="outline" type="button" className="text-sm">Cancel</Button></DialogClose>
            <Button type="submit" disabled={isPending} className="text-sm font-black uppercase tracking-widest">
              {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <><Save className="mr-2 h-4 w-4" /> Update Record</>}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
