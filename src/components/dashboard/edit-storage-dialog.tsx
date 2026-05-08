'use client';

import { useEffect, useState, useTransition, useMemo } from 'react';
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
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import type { Customer, StorageRecord, Commodity, Lot, HamaliChargeItem } from '@/lib/definitions';
import { format, differenceInDays } from 'date-fns';
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
  customerId: z.string().min(1, 'Customer is required.'),
  commodityDescription: z.string().min(1, 'Commodity is required.'),
  location: z.string().optional(),
  storageStartDate: z.string().refine(val => !isNaN(Date.parse(val))),
  bagsIn: z.coerce.number().int().nonnegative('Must be a non-negative number.'),
  weight: z.coerce.number().nonnegative('Must be a non-negative number.').optional(),
  lorryTractorNo: z.string().optional(),
  khataAmount: z.coerce.number().nonnegative().optional(),
  hamaliRate: z.coerce.number().nonnegative().optional(),
  bagsForDrying: z.coerce.number().int().nonnegative().optional(),
  dryingStartDate: z.string().optional(),
  customerHamaliPerBag: z.coerce.number().nonnegative().optional(),
  workerHamaliPerBag: z.coerce.number().nonnegative().optional(),
  pavHamaliPerBag: z.coerce.number().nonnegative().optional(),
  cuppaHamaliPerBag: z.coerce.number().nonnegative().optional(),
});

export function EditStorageDialog({ record, customers, allRecords, children }: { record: StorageRecord, customers: Customer[], allRecords: StorageRecord[], children: React.ReactNode }) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const firestore = useFirestore();
  const appUser = useAppUser();
  
  // State for all form fields
  const [customerId, setCustomerId] = useState('');
  const [commodityDescription, setCommodityDescription] = useState('');
  const [location, setLocation] = useState('');
  const [storageStartDate, setStorageStartDate] = useState('');
  const [bagsIn, setBagsIn] = useState<number | ''>('');
  const [weight, setWeight] = useState<number | ''>('');
  const [lorryTractorNo, setLorryTractorNo] = useState('');
  const [khataAmount, setKhataAmount] = useState<number | ''>('');
  const [hamaliRate, setHamaliRate] = useState<number | ''>('');
  const [bagsForDrying, setBagsForDrying] = useState<number | ''>('');
  const [dryingStartDate, setDryingStartDate] = useState('');
  const [customerHamaliPerBag, setCustomerHamaliPerBag] = useState<number | ''>('');
  const [workerHamaliPerBag, setWorkerHamaliPerBag] = useState<number | ''>('');
  const [pavHamaliPerBag, setPavHamaliPerBag] = useState<number | ''>('');
  const [cuppaHamaliPerBag, setCuppaHamaliPerBag] = useState<number | ''>('');

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
    const occupancy: { [lotName: string]: number } = {};
    (allRecords || []).forEach(r => {
        if (r.location && r.bagsStored > 0 && r.id !== record.id) {
            occupancy[r.location] = (occupancy[r.location] || 0) + r.bagsStored;
        }
    });
    return occupancy;
  }, [allRecords, record.id]);

  const customerOptions = customers.map(c => ({ value: c.id, label: c.name }));
  const commodityOptions = (commodities || []).map(c => ({ value: c.name, label: c.name }));

  useEffect(() => {
    if (isOpen) {
      const getRate = (desc: string) => record.hamaliDetails?.find(d => d.description.toLowerCase().includes(desc.toLowerCase()))?.rate;

      setCustomerId(record.customerId || '');
      setCommodityDescription(record.commodityDescription || '');
      setLocation(record.location || '');
      setStorageStartDate(record.storageStartDate ? format(toDate(record.storageStartDate), 'yyyy-MM-dd') : '');
      setBagsIn(record.bagsIn ?? record.bagsStored ?? '');
      setWeight(record.weight ?? '');
      setLorryTractorNo(record.lorryTractorNo || '');
      setKhataAmount(record.khataAmount ?? '');
      setHamaliRate(record.hamaliRate ?? '');
      setBagsForDrying(record.bagsForDrying ?? '');
      setDryingStartDate(record.dryingStartDate ? format(toDate(record.dryingStartDate), 'yyyy-MM-dd') : '');
      setCustomerHamaliPerBag(getRate('Customer Hamali') ?? '');
      setPavHamaliPerBag(getRate('Pav Hamali') ?? '');
      setCuppaHamaliPerBag(getRate('Cuppa Hamali') ?? '');
      setWorkerHamaliPerBag(record.workerHamaliPayable !== undefined && (record.bagsIn || record.bagsForDrying || 1) > 0 
        ? record.workerHamaliPayable / (record.bagsIn || record.bagsForDrying || 1) 
        : '');
    }
  }, [isOpen, record]);
  
  const calculatedHamali = useMemo(() => {
    const unloadingHamaliDetail = record.hamaliDetails?.find(d => d.description === 'Unloading Hamali');
    const proportionalUnloadingHamali = unloadingHamaliDetail?.amount || 0;

    const currentBags = Number(bagsForDrying) || Number(bagsIn) || 0;
    const day1CustomerHamali = currentBags * (Number(customerHamaliPerBag) || 0);

    let extraDryingDays = 0;
    if (dryingStartDate && storageStartDate) {
        const start = new Date(dryingStartDate);
        const end = new Date(storageStartDate);
        if (end >= start) {
            const days = differenceInDays(end, start) + 1;
            extraDryingDays = days > 1 ? days - 1 : 0;
        }
    }
    
    const pavHamali = currentBags * (Number(pavHamaliPerBag) || 0) * extraDryingDays;
    const cuppaHamali = currentBags * (Number(cuppaHamaliPerBag) || 0) * extraDryingDays;
    const totalCustomerCharge = proportionalUnloadingHamali + day1CustomerHamali + pavHamali + cuppaHamali;
    
    const day1WorkerHamali = currentBags * (Number(workerHamaliPerBag) || 0);
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

  }, [bagsIn, bagsForDrying, customerHamaliPerBag, dryingStartDate, storageStartDate, pavHamaliPerBag, cuppaHamaliPerBag, workerHamaliPerBag, record.hamaliDetails]);


  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestore) {
      toast({ variant: 'destructive', title: 'Error', description: 'Firestore not available' });
      return;
    }
    
    const dataToValidate = {
      customerId,
      commodityDescription,
      location,
      storageStartDate,
      bagsIn: Number(bagsIn),
      weight: Number(weight),
      lorryTractorNo,
      khataAmount: Number(khataAmount),
      hamaliRate: Number(hamaliRate),
      bagsForDrying: Number(bagsForDrying),
      dryingStartDate: dryingStartDate || undefined,
      customerHamaliPerBag: Number(customerHamaliPerBag),
      workerHamaliPerBag: workerHamaliPerBag === '' ? undefined : Number(workerHamaliPerBag),
      pavHamaliPerBag: Number(pavHamaliPerBag),
      cuppaHamaliPerBag: Number(cuppaHamaliPerBag),
    };
    
    const result = EditStorageRecordSchema.safeParse(dataToValidate);

    if (!result.success) {
      const firstError = Object.values(result.error.flatten().fieldErrors)[0]?.[0];
      toast({ title: "Validation Error", description: firstError || "Please check your input.", variant: "destructive" });
      return;
    }
    
    const data = result.data;
    
    startTransition(async () => {
      try {
        const bagsStored = data.bagsIn - (record.bagsOut || 0);

        const updateData: Partial<StorageRecord> = {
            customerId: data.customerId,
            commodityDescription: data.commodityDescription,
            location: data.location,
            storageStartDate: new Date(data.storageStartDate),
            bagsIn: data.bagsIn,
            bagsStored,
            weight: data.weight || 0,
            lorryTractorNo: data.lorryTractorNo,
            khataAmount: data.khataAmount,
        };
        
        if (record.inflowType !== 'Plot') {
            const directHamaliRate = data.hamaliRate || 0;
            const hamaliPayable = data.bagsIn * directHamaliRate;
            updateData.hamaliRate = directHamaliRate;
            updateData.hamaliPayable = hamaliPayable;
            updateData.workerHamaliPayable = hamaliPayable;
        } else {
            updateData.bagsForDrying = data.bagsForDrying;
            updateData.dryingStartDate = data.dryingStartDate ? new Date(data.dryingStartDate) : null;
            updateData.dryingEndDate = new Date(data.storageStartDate); 
            
            const hamaliDetails: HamaliChargeItem[] = [];
            const unloadingHamaliDetail = record.hamaliDetails?.find(d => d.description === 'Unloading Hamali');
            if(unloadingHamaliDetail) hamaliDetails.push(unloadingHamaliDetail);
            if(calculatedHamali.day1CustomerHamali > 0) hamaliDetails.push({ description: 'Customer Hamali', bags: data.bagsForDrying || data.bagsIn, rate: data.customerHamaliPerBag || 0, amount: calculatedHamali.day1CustomerHamali });
            if(calculatedHamali.pavHamali > 0) hamaliDetails.push({ description: `Pav Hamali (${calculatedHamali.extraDryingDays} extra day${calculatedHamali.extraDryingDays !== 1 ? 's' : ''})`, bags: data.bagsForDrying || data.bagsIn, rate: data.pavHamaliPerBag || 0, amount: calculatedHamali.pavHamali });
            if(calculatedHamali.cuppaHamali > 0) hamaliDetails.push({ description: `Cuppa Hamali (${calculatedHamali.extraDryingDays} extra day${calculatedHamali.extraDryingDays !== 1 ? 's' : ''})`, bags: data.bagsForDrying || data.bagsIn, rate: data.cuppaHamaliPerBag || 0, amount: calculatedHamali.cuppaHamali });

            updateData.hamaliDetails = hamaliDetails;
            updateData.hamaliPayable = calculatedHamali.totalCustomerCharge;
            if (calculatedHamali.totalWorkerPayable !== undefined) {
                updateData.workerHamaliPayable = calculatedHamali.totalWorkerPayable;
            }
        }

        await updateStorageRecord(firestore, record.id, updateData);
        toast({ title: 'Success', description: 'Storage record updated successfully.' });
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
            <DialogDescription>
              Adjust any details for record {record.id}. Everything is editable.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4 pr-2">
             <div className="space-y-2">
                <Label htmlFor="edit-customer-id">Customer</Label>
                <Combobox
                    options={customerOptions}
                    value={customerId}
                    onChange={setCustomerId}
                    placeholder="Select a customer..."
                    searchPlaceholder="Search customers..."
                    modal={true}
                />
              </div>
               <div className="space-y-2">
                <Label htmlFor="edit-commodity">Commodity</Label>
                <Combobox
                    options={commodityOptions}
                    value={commodityDescription}
                    onChange={setCommodityDescription}
                    placeholder="Select a product..."
                    searchPlaceholder="Search products..."
                    modal={true}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label htmlFor="edit-start-date">Date</Label><Input id="edit-start-date" type="date" value={storageStartDate} onChange={e => setStorageStartDate(e.target.value)} /></div>
                  <div className="space-y-2"><Label htmlFor="edit-lorry-no">Lorry/Tractor No.</Label><Input id="edit-lorry-no" placeholder="AP 12 3456" value={lorryTractorNo} onChange={e => setLorryTractorNo(e.target.value)} /></div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label htmlFor="edit-bags-in">Bags (Packed/Final)</Label><Input id="edit-bags-in" type="number" value={bagsIn} onChange={(e) => setBagsIn(e.target.value === '' ? '' : Number(e.target.value))} /></div>
                  <div className="space-y-2"><Label htmlFor="edit-weight">Weight (Kgs)</Label><Input id="edit-weight" type="number" step="0.01" value={weight} onChange={e => setWeight(e.target.value === '' ? '' : Number(e.target.value))} /></div>
              </div>

              <Separator className="my-2" />
              <h4 className="text-sm font-semibold text-muted-foreground">Hamali & Drying Details</h4>

              <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                      <Label htmlFor="edit-hamali-rate-direct">Hamali Rate/Bag</Label>
                      <Input id="edit-hamali-rate-direct" type="number" step="0.01" value={customerHamaliPerBag !== '' ? customerHamaliPerBag : hamaliRate} onChange={e => {
                          const val = e.target.value === '' ? '' : Number(e.target.value);
                          setCustomerHamaliPerBag(val);
                          setHamaliRate(val);
                      }} />
                  </div>
                  <div className="space-y-2">
                      <Label htmlFor="edit-khataAmount">Khata Amount</Label>
                      <Input id="edit-khataAmount" type="number" step="0.01" placeholder="0.00" value={khataAmount} onChange={e => setKhataAmount(e.target.value === '' ? '' : Number(e.target.value))}/>
                  </div>
              </div>

              {record.inflowType === 'Plot' && (
                <div className="grid grid-cols-2 gap-4 p-4 border rounded-lg bg-secondary/10">
                    <div className="space-y-2"><Label htmlFor="edit-drying-start">Drying Start Date</Label><Input id="edit-drying-start" type="date" value={dryingStartDate} onChange={(e) => setDryingStartDate(e.target.value)} /></div>
                    <div className="space-y-2"><Label htmlFor="edit-bags-drying">Bags Plotted</Label><Input id="edit-bags-drying" type="number" value={bagsForDrying} onChange={(e) => setBagsForDrying(e.target.value === '' ? '' : Number(e.target.value))} /></div>
                    
                    <div className="space-y-2"><Label htmlFor="edit-work-hamali">Worker Rate</Label><Input id="edit-work-hamali" type="number" step="0.01" value={workerHamaliPerBag} onChange={(e) => setWorkerHamaliPerBag(e.target.value === '' ? '' : Number(e.target.value))} /></div>
                    <div className="space-y-2"><Label htmlFor="edit-pav-hamali">Pav Rate</Label><Input id="edit-pav-hamali" type="number" step="0.01" value={pavHamaliPerBag} onChange={(e) => setPavHamaliPerBag(e.target.value === '' ? '' : Number(e.target.value))} /></div>
                    <div className="space-y-2 col-span-2"><Label htmlFor="edit-cuppa-hamali">Cuppa Rate</Label><Input id="edit-cuppa-hamali" type="number" step="0.01" value={cuppaHamaliPerBag} onChange={(e) => setCuppaHamaliPerBag(e.target.value === '' ? '' : Number(e.target.value))} /></div>
                </div>
              )}

               <div className="space-y-2">
                 <Label htmlFor="edit-location">Location (Lot No.)</Label>
                 <Select onValueChange={setLocation} value={location}>
                     <SelectTrigger id="edit-location"><SelectValue placeholder="Select a lot..."/></SelectTrigger>
                     <SelectContent>
                         {(lots || []).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })).map(lot => {
                             const occupied = lotOccupancy[lot.name] || 0;
                             return ( <SelectItem key={lot.id} value={lot.name}> {lot.name} ({occupied} bags) </SelectItem> )
                         })}
                     </SelectContent>
                 </Select>
                </div>
          </div>
          <DialogFooter className="gap-2">
            <DialogClose asChild>
              <Button variant="outline" type="button">Cancel</Button>
            </DialogClose>
            <Button type="submit" disabled={isPending}>
              {isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : <><Save className="mr-2 h-4 w-4" /> Save Changes</>}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
