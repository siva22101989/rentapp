'use client';

import { useState, useTransition, useEffect, useMemo } from 'react';
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
import type { Customer, UnloadingRecord, Commodity, Lot, StorageRecord } from '@/lib/definitions';
import { useFirestore } from '@/firebase/provider';
import { z } from 'zod';
import { updateUnloadingRecord } from '@/lib/data';
import { toDate, cleanForFirestore } from '@/lib/utils';
import { Combobox } from '../ui/combobox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

const EditUnloadingSchema = z.object({
  customerId: z.string().min(1, 'Customer is required.'),
  commodityDescription: z.string().min(1, 'Commodity is required.'),
  location: z.string().min(1, 'Storage location is required.'),
  lorryTractorNo: z.string().optional(),
  unloadingDate: z.string().refine(val => !isNaN(Date.parse(val)), { message: "Invalid date format" }),
  bagsUnloaded: z.coerce.number().int().positive('Number of bags must be positive.'),
  customerHamaliPerBag: z.coerce.number().nonnegative('Customer hamali rate must be non-negative.'),
  workerHamaliPerBag: z.coerce.number().nonnegative('Worker hamali rate must be non-negative.').optional(),
  billNo: z.string().min(1, 'Bill No is required.'),
});

export function EditUnloadingRecordDialog({ 
    record, 
    customers, 
    commodities,
    lots,
    storageRecords,
    children 
}: { 
    record: UnloadingRecord, 
    customers: Customer[], 
    commodities: Commodity[],
    lots: Lot[],
    storageRecords: StorageRecord[],
    children: React.ReactNode 
}) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const firestore = useFirestore();
  const customerOptions = customers.map(c => ({ value: c.id, label: c.name }));
  const commodityOptions = (commodities || []).map(c => ({ value: c.name, label: c.name }));

  const [customerId, setCustomerId] = useState('');
  const [commodityDescription, setCommodityDescription] = useState('');
  const [location, setLocation] = useState('');
  const [lorryTractorNo, setLorryTractorNo] = useState('');
  const [unloadingDate, setUnloadingDate] = useState('');
  const [bagsUnloaded, setBagsUnloaded] = useState<number | ''>('');
  const [customerHamaliPerBag, setCustomerHamaliPerBag] = useState<number | ''>('');
  const [workerHamaliPerBag, setWorkerHamaliPerBag] = useState<number | ''>('');
  const [billNo, setBillNo] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const lotOccupancy = useMemo(() => {
    const occupancy: { [lotName: string]: number } = {};
    (storageRecords || []).forEach(r => {
        if (r.location && r.bagsStored > 0) {
            occupancy[r.location] = (occupancy[r.location] || 0) + r.bagsStored;
        }
    });
    return occupancy;
  }, [storageRecords]);

  const lotOptions = useMemo(() => {
    return (lots || [])
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
        .map(lot => {
            const occupied = lotOccupancy[lot.name] || 0;
            return ({
                value: lot.name,
                label: `${lot.name} (${occupied} bags)`
            })
        });
  }, [lots, lotOccupancy]);

  const getLocalDateTimeForInput = (date: Date) => {
    const timezoneOffsetInMs = date.getTimezoneOffset() * 60000;
    const localDate = new Date(date.getTime() - timezoneOffsetInMs);
    return localDate.toISOString().slice(0, 16);
  };
  
  useEffect(() => {
    if (isOpen) {
      const workerRate = record.workerHamaliPayable !== undefined && record.bagsUnloaded > 0
        ? record.workerHamaliPayable / record.bagsUnloaded
        : record.hamaliPerBag;

      setCustomerId(record.customerId || '');
      setCommodityDescription(record.commodityDescription || '');
      setLocation(record.location || '');
      setLorryTractorNo(record.lorryTractorNo || '');
      setUnloadingDate(getLocalDateTimeForInput(toDate(record.unloadingDate)));
      setBagsUnloaded(record.bagsUnloaded || '');
      setCustomerHamaliPerBag(record.hamaliPerBag || '');
      setWorkerHamaliPerBag(workerRate || '');
      setBillNo(record.billNo || '');
      setErrors({});
    }
  }, [isOpen, record]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    if (!firestore) {
      toast({ title: 'Error', description: 'Firestore not available.', variant: 'destructive' });
      return;
    }

    const dataToValidate = {
      customerId,
      commodityDescription,
      location,
      lorryTractorNo,
      unloadingDate,
      bagsUnloaded: Number(bagsUnloaded),
      customerHamaliPerBag: Number(customerHamaliPerBag),
      workerHamaliPerBag: Number(workerHamaliPerBag),
      billNo,
    };

    const result = EditUnloadingSchema.safeParse(dataToValidate);

    if (!result.success) {
      const fieldErrors = result.error.flatten().fieldErrors;
      const newErrors: Record<string, string> = {};
      Object.keys(fieldErrors).forEach(key => {
        if (fieldErrors[key as keyof typeof fieldErrors]) {
            newErrors[key] = fieldErrors[key as keyof typeof fieldErrors]![0];
        }
      });
      setErrors(newErrors);
      return;
    }

    startTransition(async () => {
      try {
        const totalHamali = result.data.bagsUnloaded * result.data.customerHamaliPerBag;
        const workerHamaliPayable = result.data.bagsUnloaded * (result.data.workerHamaliPerBag ?? result.data.customerHamaliPerBag);
        
        const updateData = {
          ...result.data,
          hamaliPerBag: result.data.customerHamaliPerBag,
          unloadingDate: new Date(result.data.unloadingDate),
          totalHamali,
          workerHamaliPayable,
        };
        await updateUnloadingRecord(firestore, record.id, updateData);
        toast({ title: 'Success', description: 'Unloading record updated.' });
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
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit Unloading Record</DialogTitle>
            <DialogDescription>
              Adjust details for Bill No. {record.billNo}. All fields are fully editable.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4 pr-2">
            <div className="space-y-2">
                <Label htmlFor="edit-bill-no">Bill No.</Label>
                <Input id="edit-bill-no" value={billNo} onChange={(e) => setBillNo(e.target.value)} />
                {errors.billNo && <p className="text-xs text-destructive">{errors.billNo}</p>}
            </div>
            <div className="space-y-2">
                <Label htmlFor="customerId">Customer</Label>
                <Combobox
                    options={customerOptions}
                    value={customerId}
                    onChange={setCustomerId}
                    placeholder="Select a customer..."
                    searchPlaceholder="Search customers..."
                    modal={true}
                />
                {errors.customerId && <p className="text-xs text-destructive">{errors.customerId}</p>}
            </div>
             <div className="space-y-2">
                <Label htmlFor="commodityDescription">Commodity</Label>
                <Combobox
                    options={commodityOptions}
                    value={commodityDescription}
                    onChange={setCommodityDescription}
                    placeholder="Select a product..."
                    searchPlaceholder="Search products..."
                    modal={true}
                />
                {errors.commodityDescription && <p className="text-xs text-destructive">{errors.commodityDescription}</p>}
            </div>
            <div className="space-y-2">
                <Label htmlFor="location">Storage Location (Lot No.)</Label>
                <Select onValueChange={setLocation} value={location}>
                    <SelectTrigger id="location"><SelectValue placeholder="Select a lot..." /></SelectTrigger>
                    <SelectContent>
                        {lotOptions.map(opt => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                {errors.location && <p className="text-xs text-destructive">{errors.location}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="lorryTractorNo">Lorry/Tractor No.</Label>
              <Input id="lorryTractorNo" value={lorryTractorNo || ''} onChange={(e) => setLorryTractorNo(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="unloadingDate">Unloading Date & Time</Label>
              <Input id="unloadingDate" type="datetime-local" value={unloadingDate} onChange={e => setUnloadingDate(e.target.value)} />
              {errors.unloadingDate && <p className="text-xs text-destructive">{errors.unloadingDate}</p>}
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="bagsUnloaded">Bags Unloaded</Label>
                <Input id="bagsUnloaded" type="number" value={bagsUnloaded} onChange={e => setBagsUnloaded(e.target.value === '' ? '' : Number(e.target.value))} />
                {errors.bagsUnloaded && <p className="text-xs text-destructive">{errors.bagsUnloaded}</p>}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="customerHamaliPerBag">Customer Rate</Label>
                    <Input id="customerHamaliPerBag" type="number" step="0.01" value={customerHamaliPerBag} onChange={e => setCustomerHamaliPerBag(e.target.value === '' ? '' : Number(e.target.value))} />
                    {errors.customerHamaliPerBag && <p className="text-xs text-destructive">{errors.customerHamaliPerBag}</p>}
                </div>
                 <div className="space-y-2">
                    <Label htmlFor="workerHamaliPerBag">Worker Rate</Label>
                    <Input id="workerHamaliPerBag" type="number" step="0.01" value={workerHamaliPerBag} onChange={e => setWorkerHamaliPerBag(e.target.value === '' ? '' : Number(e.target.value))} />
                </div>
              </div>
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
