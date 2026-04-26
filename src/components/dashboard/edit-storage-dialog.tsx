
'use client';

import { useEffect, useState, useTransition, useMemo } from 'react';
import { Loader2 } from 'lucide-react';
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
import { collection, query, where } from 'firebase/firestore';
import { Separator } from '../ui/separator';
import { useAppUser } from '@/firebase/auth/use-user';


const EditStorageRecordSchema = z.object({
  customerId: z.string().min(1, 'Customer is required.'),
  commodityDescription: z.string().min(1, 'Commodity is required.'),
  location: z.string().optional(),
  storageStartDate: z.string().refine(val => !isNaN(Date.parse(val))), // This is Drying End Date for Plot
  bagsIn: z.coerce.number().int().nonnegative('Must be a non-negative number.'),
  weight: z.coerce.number().nonnegative('Must be a non-negative number.').optional(),
  lorryTractorNo: z.string().optional(),
  khataAmount: z.coerce.number().nonnegative().optional(),
  // Plot specific fields
  bagsForDrying: z.coerce.number().int().nonnegative('Must be a non-negative number.').optional(),
  dryingStartDate: z.string().optional(),
  customerHamaliPerBag: z.coerce.number().nonnegative().optional(),
  workerHamaliPerBag: z.coerce.number().nonnegative().optional(),
  pavHamaliPerBag: z.coerce.number().nonnegative().optional(),
  cuppaHamaliPerBag: z.coerce.number().nonnegative().optional(),
}).refine(data => {
    if (data.dryingStartDate && data.storageStartDate) {
        return new Date(data.storageStartDate) >= new Date(data.dryingStartDate)
    }
    return true;
}, {
    message: "Drying End Date must be on or after Drying Start Date.",
    path: ["storageStartDate"],
}).refine(data => {
    if(data.bagsIn && data.bagsForDrying) {
        return data.bagsIn <= data.bagsForDrying;
    }
    return true;
}, {
    message: "Bags packed cannot be more than bags for drying.",
    path: ["bagsIn"],
});

type EditStorageRecordFormData = z.infer<typeof EditStorageRecordSchema>;


export function EditStorageDialog({ record, customers, allRecords, children }: { record: StorageRecord, customers: Customer[], allRecords: StorageRecord[], children: React.ReactNode }) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const firestore = useFirestore();
  const appUser = useAppUser();
  
  // State for form fields
  const [customerId, setCustomerId] = useState('');
  const [commodityDescription, setCommodityDescription] = useState('');
  const [location, setLocation] = useState('');
  const [storageStartDate, setStorageStartDate] = useState('');
  const [bagsIn, setBagsIn] = useState<number | ''>('');
  const [weight, setWeight] = useState<number | ''>('');
  const [lorryTractorNo, setLorryTractorNo] = useState('');
  const [khataAmount, setKhataAmount] = useState<number | ''>('');
  // Plot specific
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
  const { data: commodities, loading: loadingCommodities } = useCollection<Commodity>(commoditiesQuery);

  const lotsQuery = useMemoFirebase(
    () => (firestore && appUser?.warehouseId ? query(collection(firestore, 'lots'), where('warehouseId', '==', appUser.warehouseId)) : null),
    [firestore, appUser]
  );
  const { data: lots, loading: loadingLots } = useCollection<Lot>(lotsQuery);

  const lotOccupancy = useMemo(() => {
    const occupancy: { [lotName: string]: number } = {};
    (allRecords || []).forEach(r => {
        if (r.location && r.bagsStored > 0 && r.id !== record.id) {
            occupancy[r.location] = (occupancy[r.location] || 0) + r.bagsStored;
        }
    });
    return occupancy;
  }, [allRecords, record.id]);

  const handleOpenChange = (open: boolean) => {
    if (open) {
      const getRate = (desc: string) => record.hamaliDetails?.find(d => d.description.startsWith(desc))?.rate;

      setCustomerId(record.customerId);
      setCommodityDescription(record.commodityDescription);
      setLocation(record.location || '');
      setStorageStartDate(format(toDate(record.storageStartDate), 'yyyy-MM-dd'));
      setBagsIn(record.bagsIn ?? record.bagsStored ?? '');
      setWeight(record.weight ?? '');
      setLorryTractorNo(record.lorryTractorNo || '');
      setKhataAmount(record.khataAmount ?? '');
      // Plot specific
      setBagsForDrying(record.bagsForDrying ?? '');
      setDryingStartDate(record.dryingStartDate ? format(toDate(record.dryingStartDate), 'yyyy-MM-dd') : '');
      setCustomerHamaliPerBag(getRate('Customer Hamali') ?? '');
      setPavHamaliPerBag(getRate('Pav Hamali') ?? '');
      setCuppaHamaliPerBag(getRate('Cuppa Hamali') ?? '');
      setWorkerHamaliPerBag(''); // Cannot derive reliably, user must re-enter if they want to change worker payable.
    }
    setIsOpen(open);
  }
  
  const calculatedHamali = useMemo(() => {
    if (record.inflowType !== 'Plot') return null;

    const unloadingHamaliDetail = record.hamaliDetails?.find(d => d.description === 'Unloading Hamali');
    const proportionalUnloadingHamali = unloadingHamaliDetail?.amount || 0;

    const day1CustomerHamali = (Number(bagsForDrying) || 0) * (Number(customerHamaliPerBag) || 0);

    let extraDryingDays = 0;
    if (dryingStartDate && storageStartDate) {
        const start = new Date(dryingStartDate);
        const end = new Date(storageStartDate);
        if (end >= start) {
            const days = differenceInDays(end, start) + 1;
            extraDryingDays = days > 1 ? days - 1 : 0;
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
        totalWorkerPayable: workerHamaliPerBag !== '' ? totalWorkerPayable : undefined,
    }

  }, [bagsForDrying, customerHamaliPerBag, dryingStartDate, storageStartDate, pavHamaliPerBag, cuppaHamaliPerBag, workerHamaliPerBag, record.inflowType, record.hamaliDetails]);


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
      bagsForDrying: Number(bagsForDrying),
      dryingStartDate,
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
        if (bagsStored < 0) {
            toast({ title: "Validation Error", description: "Bags in cannot be less than bags out.", variant: "destructive" });
            return;
        }

        const updateData: Partial<StorageRecord> = {
            customerId: data.customerId,
            commodityDescription: data.commodityDescription,
            location: data.location,
            storageStartDate: new Date(data.storageStartDate),
            bagsIn: data.bagsIn,
            bagsStored,
            weight: data.weight,
            lorryTractorNo: data.lorryTractorNo,
            khataAmount: data.khataAmount,
        };
        
        if (record.inflowType === 'Plot' && calculatedHamali) {
            updateData.bagsForDrying = data.bagsForDrying;
            updateData.dryingStartDate = data.dryingStartDate ? new Date(data.dryingStartDate) : null;
            updateData.dryingEndDate = new Date(data.storageStartDate); 
            
            const hamaliDetails: HamaliChargeItem[] = [];
            const unloadingHamaliDetail = record.hamaliDetails?.find(d => d.description === 'Unloading Hamali');
            if(unloadingHamaliDetail) hamaliDetails.push(unloadingHamaliDetail);
            if(calculatedHamali.day1CustomerHamali > 0) hamaliDetails.push({ description: 'Customer Hamali', bags: data.bagsForDrying || 0, rate: data.customerHamaliPerBag || 0, amount: calculatedHamali.day1CustomerHamali });
            if(calculatedHamali.pavHamali > 0) hamaliDetails.push({ description: `Pav Hamali (${calculatedHamali.extraDryingDays} extra day${calculatedHamali.extraDryingDays !== 1 ? 's' : ''})`, bags: data.bagsForDrying || 0, rate: data.pavHamaliPerBag || 0, amount: calculatedHamali.pavHamali });
            if(calculatedHamali.cuppaHamali > 0) hamaliDetails.push({ description: `Cuppa Hamali (${calculatedHamali.extraDryingDays} extra day${calculatedHamali.extraDryingDays !== 1 ? 's' : ''})`, bags: data.bagsForDrying || 0, rate: data.cuppaHamaliPerBag || 0, amount: calculatedHamali.cuppaHamali });

            updateData.hamaliDetails = hamaliDetails;
            updateData.hamaliPayable = calculatedHamali.totalCustomerCharge;
            if (calculatedHamali.totalWorkerPayable !== undefined) {
                updateData.workerHamaliPayable = calculatedHamali.totalWorkerPayable;
            }
        }

        await updateStorageRecord(firestore, record.id, updateData);
        toast({ title: 'Success', description: 'Storage record updated.' });
        setIsOpen(false);
      } catch (error) {
        console.error(error);
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to update record.' });
      }
    });
  };
  
  if (loadingCommodities || loadingLots) {
      return <div>Loading...</div>
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>Edit Storage Record</DialogTitle>
            <DialogDescription>
              Adjust the details for record {record.id}. Payment history cannot be edited here.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto pr-4">
             <div className="space-y-2">
                <Label htmlFor="edit-customer-id">Customer</Label>
                <Select onValueChange={setCustomerId} value={customerId}>
                    <SelectTrigger id="edit-customer-id"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        {customers.map(customer => (
                            <SelectItem key={customer.id} value={customer.id}>
                                {customer.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
              </div>
               <div className="space-y-2">
                <Label htmlFor="edit-commodity">Commodity</Label>
                <Select onValueChange={setCommodityDescription} value={commodityDescription}>
                    <SelectTrigger id="edit-commodity"><SelectValue /></SelectTrigger>
                    <SelectContent>
                         {commodities?.map(commodity => (
                            <SelectItem key={commodity.id} value={commodity.name}>
                                {commodity.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
              </div>
              {record.inflowType === 'Plot' ? (
                <>
                    <Separator className="my-4" />
                    <h4 className="text-sm font-semibold text-muted-foreground -mb-2">Drying & Hamali Details</h4>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2"><Label htmlFor="edit-drying-start">Drying Start Date</Label><Input id="edit-drying-start" type="date" value={dryingStartDate} onChange={(e) => setDryingStartDate(e.target.value)} /></div>
                        <div className="space-y-2"><Label htmlFor="edit-storage-start">Drying End Date (Storage Date)</Label><Input id="edit-storage-start" type="date" value={storageStartDate} onChange={(e) => setStorageStartDate(e.target.value)} /></div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                         <div className="space-y-2"><Label htmlFor="edit-bags-drying">Bags Plotted for Drying</Label><Input id="edit-bags-drying" type="number" value={bagsForDrying} onChange={(e) => setBagsForDrying(e.target.value === '' ? '' : Number(e.target.value))} /></div>
                         <div className="space-y-2"><Label htmlFor="edit-bags-in">Bags Packed (Final Stock)</Label><Input id="edit-bags-in" type="number" value={bagsIn} onChange={(e) => setBagsIn(e.target.value === '' ? '' : Number(e.target.value))} /></div>
                    </div>

                     <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="space-y-2"><Label htmlFor="edit-cust-hamali">Cust. Hamali/Bag</Label><Input id="edit-cust-hamali" type="number" step="0.01" value={customerHamaliPerBag} onChange={(e) => setCustomerHamaliPerBag(e.target.value === '' ? '' : Number(e.target.value))} /></div>
                         <div className="space-y-2"><Label htmlFor="edit-work-hamali">Worker Hamali/Bag</Label><Input id="edit-work-hamali" type="number" step="0.01" value={workerHamaliPerBag} onChange={(e) => setWorkerHamaliPerBag(e.target.value === '' ? '' : Number(e.target.value))} placeholder="Re-enter to update" /></div>
                         <div className="space-y-2"><Label htmlFor="edit-pav-hamali">Pav Hamali/Bag/Day</Label><Input id="edit-pav-hamali" type="number" step="0.01" value={pavHamaliPerBag} onChange={(e) => setPavHamaliPerBag(e.target.value === '' ? '' : Number(e.target.value))} /></div>
                         <div className="space-y-2"><Label htmlFor="edit-cuppa-hamali">Cuppa Hamali/Bag/Day</Label><Input id="edit-cuppa-hamali" type="number" step="0.01" value={cuppaHamaliPerBag} onChange={(e) => setCuppaHamaliPerBag(e.target.value === '' ? '' : Number(e.target.value))} /></div>
                    </div>
                    {calculatedHamali && (
                        <div className="space-y-2 p-3 border rounded-md text-sm">
                            <h5 className="font-medium">Live Summary</h5>
                            <div className="flex justify-between"><span className="text-muted-foreground">Unloading Hamali:</span> <span className="font-mono">{formatCurrency(calculatedHamali.proportionalUnloadingHamali)}</span></div>
                            <div className="flex justify-between"><span className="text-muted-foreground">Day 1 Hamali:</span> <span className="font-mono">{formatCurrency(calculatedHamali.day1CustomerHamali)}</span></div>
                            <div className="flex justify-between"><span className="text-muted-foreground">Pav Hamali ({calculatedHamali.extraDryingDays} extra day{calculatedHamali.extraDryingDays !== 1 ? 's' : ''}):</span> <span className="font-mono">{formatCurrency(calculatedHamali.pavHamali)}</span></div>
                            <div className="flex justify-between"><span className="text-muted-foreground">Cuppa Hamali ({calculatedHamali.extraDryingDays} extra day{calculatedHamali.extraDryingDays !== 1 ? 's' : ''}):</span> <span className="font-mono">{formatCurrency(calculatedHamali.cuppaHamali)}</span></div>
                            <Separator/>
                            <div className="flex justify-between font-semibold"><span >Total Hamali for Customer:</span> <span className="font-mono">{formatCurrency(calculatedHamali.totalCustomerCharge)}</span></div>
                             {calculatedHamali.totalWorkerPayable !== undefined && <div className="flex justify-between font-semibold"><span >Total Payable to Worker:</span> <span className="font-mono">{formatCurrency(calculatedHamali.totalWorkerPayable)}</span></div>}
                        </div>
                    )}
                    <Separator className="my-4" />
                </>
              ) : (
                <>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2"><Label htmlFor="edit-start-date">Start Date</Label><Input id="edit-start-date" type="date" value={storageStartDate} onChange={e => setStorageStartDate(e.target.value)} /></div>
                        <div className="space-y-2"><Label htmlFor="edit-lorry-no">Lorry/Tractor No.</Label><Input id="edit-lorry-no" placeholder="AP 12 3456" value={lorryTractorNo} onChange={e => setLorryTractorNo(e.target.value)} /></div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2"><Label htmlFor="edit-bags-in-direct">Bags In</Label><Input id="edit-bags-in-direct" type="number" value={bagsIn} onChange={e => setBagsIn(e.target.value === '' ? '' : Number(e.target.value))} /></div>
                        <div className="space-y-2"><Label htmlFor="edit-weight">Weight (Kgs)</Label><Input id="edit-weight" type="number" step="0.01" value={weight} onChange={e => setWeight(e.target.value === '' ? '' : Number(e.target.value))} /></div>
                    </div>
                </>
              )}
               <div className="space-y-2">
                 <Label htmlFor="edit-location">Location</Label>
                 <Select onValueChange={setLocation} value={location}>
                     <SelectTrigger id="edit-location"><SelectValue placeholder="Select a lot..."/></SelectTrigger>
                     <SelectContent>
                         {lots?.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })).map(lot => {
                             const occupied = lotOccupancy[lot.name] || 0;
                             const capacity = lot.capacity ? ` / ${lot.capacity}` : '';
                             return ( <SelectItem key={lot.id} value={lot.name}> {lot.name} ({occupied}{capacity} bags) </SelectItem> )
                         })}
                     </SelectContent>
                 </Select>
                </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" type="button">Cancel</Button>
            </DialogClose>
            <Button type="submit" disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
