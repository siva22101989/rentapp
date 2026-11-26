
'use client';

import { useState, useTransition, useEffect, useMemo } from 'react';
import { Loader2, Save, Calculator } from 'lucide-react';
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
import { cleanForFirestore, formatManualDate, parseManualDate } from '@/lib/utils';
import { Combobox } from '../ui/combobox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Separator } from '../ui/separator';

const EditUnloadingSchema = z.object({
  customerId: z.string().min(1, 'Customer is required.'),
  commodityDescription: z.string().min(1, 'Commodity is required.'),
  location: z.string().min(1, 'Storage location is required.'),
  lorryTractorNo: z.string().optional(),
  unloadingDate: z.string().min(1, 'Unloading date is required.'),
  bagsUnloaded: z.coerce.number().positive('Number of bags must be positive.'),
  customerHamaliPerBag: z.coerce.number().nonnegative('Customer hamali rate must be non-negative.'),
  workerHamaliPerBag: z.coerce.number().nonnegative('Worker hamali rate must be non-negative.').optional(),
  billNo: z.string().min(1, 'Bill No is required.'),
  totalHamali: z.coerce.number().nonnegative().optional(),
  workerHamaliPayable: z.coerce.number().nonnegative().optional(),
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
  const customerOptions = useMemo(() => customers.map(c => ({ value: c.id, label: c.name })), [customers]);
  const commodityOptions = useMemo(() => (commodities || []).map(c => ({ value: c.name, label: c.name })), [commodities]);

  const [customerId, setCustomerId] = useState('');
  const [commodityDescription, setCommodityDescription] = useState('');
  const [location, setLocation] = useState('');
  const [lorryTractorNo, setLorryTractorNo] = useState('');
  const [unloadingDate, setUnloadingDate] = useState('');
  const [bagsUnloaded, setBagsUnloaded] = useState<number | ''>('');
  const [customerHamaliPerBag, setCustomerHamaliPerBag] = useState<number | ''>('');
  const [workerHamaliPerBag, setWorkerHamaliPerBag] = useState<number | ''>('');
  const [billNo, setBillNo] = useState('');
  
  // Manual Totals
  const [totalHamali, setTotalHamali] = useState<number | ''>('');
  const [workerHamaliTotal, setWorkerHamaliTotal] = useState<number | ''>('');

  const [errors, setErrors] = useState<Record<string, string>>({});

  const lotOccupancy = useMemo(() => {
    if (!isOpen) return {};
    const occupancy: { [lotName: string]: number } = {};
    (storageRecords || []).forEach(r => {
        if (r.location && r.bagsStored > 0) {
            occupancy[r.location] = (occupancy[r.location] || 0) + r.bagsStored;
        }
    });
    return occupancy;
  }, [storageRecords, isOpen]);

  const lotOptions = useMemo(() => {
    if (!isOpen) return [];
    return (lots || [])
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
        .map(lot => {
            const occupied = lotOccupancy[lot.name] || 0;
            return ({
                value: lot.name,
                label: `${lot.name} (${occupied} bags)`
            })
        });
  }, [lots, lotOccupancy, isOpen]);

  useEffect(() => {
    if (isOpen) {
      const currentWorkerTotal = record.workerHamaliPayable ?? record.totalHamali;
      const workerRate = record.bagsUnloaded > 0 ? currentWorkerTotal / record.bagsUnloaded : record.hamaliPerBag;

      setCustomerId(record.customerId || '');
      setCommodityDescription(record.commodityDescription || '');
      setLocation(record.location || '');
      setLorryTractorNo(record.lorryTractorNo || '');
      setUnloadingDate(formatManualDate(record.unloadingDate));
      setBagsUnloaded(record.bagsUnloaded || '');
      setCustomerHamaliPerBag(record.hamaliPerBag || '');
      setWorkerHamaliPerBag(workerRate || '');
      setBillNo(record.billNo || '');
      
      setTotalHamali(record.totalHamali ?? '');
      setWorkerHamaliTotal(currentWorkerTotal ?? '');
      
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

    const finalDate = parseManualDate(unloadingDate);
    if (!finalDate) {
      setErrors(prev => ({ ...prev, unloadingDate: 'Invalid format. Use DD-MM-YYYY' }));
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
      totalHamali: Number(totalHamali),
      workerHamaliPayable: Number(workerHamaliTotal),
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
        const updateData = {
          ...result.data,
          hamaliPerBag: result.data.customerHamaliPerBag,
          unloadingDate: finalDate,
          totalHamali: result.data.totalHamali,
          workerHamaliPayable: result.data.workerHamaliPayable,
        };
        await updateUnloadingRecord(firestore, record.id, result.data.billNo, updateData);
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
            <DialogDescription className="text-xs">
              Separate billing and payout logic for Bill No. {record.billNo}.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4 pr-2">
            <div className="space-y-2">
                <Label htmlFor="edit-bill-no">Bill No.</Label>
                <Input id="edit-bill-no" className="font-mono font-bold h-9" value={billNo} onChange={e => setBillNo(e.target.value)} />
            </div>
            <div className="space-y-2">
                <Label htmlFor="customerId">Customer</Label>
                <Combobox options={customerOptions} value={customerId} onChange={setCustomerId} placeholder="Select customer..." modal={true} />
            </div>
             <div className="space-y-2">
                <Label htmlFor="commodityDescription">Commodity</Label>
                <Combobox options={commodityOptions} value={commodityDescription} onChange={setCommodityDescription} placeholder="Select a product..." modal={true} />
            </div>
            <div className="space-y-2">
                <Label htmlFor="location">Storage Location (Lot No.)</Label>
                <Select onValueChange={setLocation} value={location}>
                    <SelectTrigger id="location" className="h-9"><SelectValue placeholder="Select a lot..." /></SelectTrigger>
                    <SelectContent>
                        {lotOptions.map(opt => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>Vehicle No.</Label><Input className="h-9" value={lorryTractorNo || ''} onChange={(e) => setLorryTractorNo(e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Date (DD-MM-YYYY)</Label><Input placeholder="DD-MM-YYYY" className="h-9" value={unloadingDate} onChange={e => setUnloadingDate(e.target.value)} /></div>
            </div>

            <div className="space-y-2">
              <Label>Bags Unloaded</Label>
              <Input type="number" className="h-9 font-bold" value={bagsUnloaded} onChange={e => setBagsUnloaded(e.target.value === '' ? '' : Number(e.target.value))} />
            </div>

            <Separator className="my-2" />

            <div className="p-4 rounded-xl border bg-slate-50/50 space-y-4">
                <h4 className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-2">
                    <Calculator className="h-3 w-3" />
                    Hamali Payout Audit
                </h4>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <Label className="text-xs font-bold text-primary uppercase">Cust. Rate</Label>
                        <Input type="number" step="0.01" className="h-9" value={customerHamaliPerBag} onChange={e => setCustomerHamaliPerBag(e.target.value === '' ? '' : Number(e.target.value))} />
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-xs font-bold text-slate-500 uppercase">Worker Rate</Label>
                        <Input type="number" step="0.01" className="h-9" value={workerHamaliPerBag} onChange={e => setWorkerHamaliPerBag(e.target.value === '' ? '' : Number(e.target.value))} />
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <Label className="text-[10px] font-black text-primary uppercase tracking-tighter">Billed to Customer</Label>
                        <Input type="number" step="0.01" className="h-9 border-primary/50 font-mono font-bold" value={totalHamali} onChange={e => setTotalHamali(e.target.value === '' ? '' : Number(e.target.value))} />
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-[10px] font-black text-orange-600 uppercase tracking-tighter">Payable to Hamali</Label>
                        <Input type="number" step="0.01" className="h-9 border-orange-400 font-mono font-bold" value={workerHamaliTotal} onChange={e => setWorkerHamaliTotal(e.target.value === '' ? '' : Number(e.target.value))} />
                    </div>
                </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <DialogClose asChild><Button variant="outline" type="button" className="text-sm font-bold uppercase h-10">Cancel</Button></DialogClose>
            <Button type="submit" disabled={isPending} className="text-sm font-black uppercase tracking-widest h-10">
              {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <><Save className="mr-2 h-4 w-4" /> Save Changes</>}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
