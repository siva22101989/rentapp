'use client';

import { useState, useTransition, useEffect, useMemo } from 'react';
import { Loader2, Save, AlertTriangle } from 'lucide-react';
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
import type { StorageRecord, Outflow, Commodity, Lot } from '@/lib/definitions';
import { useFirestore, useAppUser } from '@/firebase';
import { z } from 'zod';
import { editOutflowEvent, editPattiMetadata } from '@/lib/data';
import { format } from 'date-fns';
import { toDate } from '@/lib/utils';
import { Separator } from '../ui/separator';
import { Combobox } from '../ui/combobox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';

const OutflowEditSchema = z.object({
  date: z.string().refine(val => !isNaN(Date.parse(val)), { message: "Invalid date format" }),
  bagsWithdrawn: z.coerce.number().positive('Bags withdrawn must be a positive number.'),
  rentBilled: z.coerce.number().nonnegative('Rent billed must be a non-negative number.'),
  discount: z.coerce.number().nonnegative('Discount must be a non-negative number.').optional(),
  khataAmount: z.coerce.number().nonnegative('Khata amount must be a non-negative number.').optional(),
  commodityDescription: z.string().min(1, 'Commodity is required.'),
  location: z.string().min(1, 'Lot No. is required.'),
  lorryTractorNo: z.string().optional(),
  weight: z.coerce.number().nonnegative().optional(),
});

export function EditOutflowDialog({ 
    record, 
    outflow, 
    outflowIndex, 
    commodities,
    lots,
    allRecords,
    deliveryOrderNo,
    children 
}: { 
    record: StorageRecord, 
    outflow: Outflow, 
    outflowIndex: number, 
    commodities: Commodity[],
    lots: Lot[],
    allRecords: StorageRecord[],
    deliveryOrderNo: string,
    children: React.ReactNode 
}) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const firestore = useFirestore();
  const appUser = useAppUser();

  // Detect if this is a consolidated bill (spans multiple storage records)
  const isConsolidated = useMemo(() => {
    if (!deliveryOrderNo || !allRecords) return false;
    const recordsInPatti = allRecords.filter(r => (r.outflows || []).some(o => String(o.pattiNo) === String(deliveryOrderNo)));
    return recordsInPatti.length > 1;
  }, [deliveryOrderNo, allRecords]);

  const [date, setDate] = useState('');
  const [bagsWithdrawn, setBagsWithdrawn] = useState<number | ''>('');
  const [rentBilled, setRentBilled] = useState<number | ''>('');
  const [discount, setDiscount] = useState<number | ''>('');
  const [khataAmount, setKhataAmount] = useState<number | ''>('');
  const [commodityDescription, setCommodityDescription] = useState('');
  const [location, setLocation] = useState('');
  const [lorryTractorNo, setLorryTractorNo] = useState('');
  const [weight, setWeight] = useState<number | ''>('');

  const commodityOptions = useMemo(() => {
    if (!isOpen) return [];
    const options = (commodities || []).map(c => ({ value: c.name, label: c.name }));
    if (record.commodityDescription && !options.find(o => o.value === record.commodityDescription)) {
        options.push({ value: record.commodityDescription, label: record.commodityDescription });
    }
    return options;
  }, [commodities, record.commodityDescription, isOpen]);
  
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

  const lotOptions = useMemo(() => {
    if (!isOpen) return [];
    const options = (lots || [])
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
        .map(lot => {
            const occupied = lotOccupancy[lot.name] || 0;
            return ({
                value: lot.name,
                label: `${lot.name} (${occupied} bags occupied)`
            })
        });
    if (record.location && !options.find(o => o.value === record.location)) {
        options.push({ value: record.location, label: `${record.location} (Current)` });
    }
    return options;
  }, [lots, lotOccupancy, record.location, isOpen]);

  useEffect(() => {
    if (isOpen) {
      setDate(format(toDate(outflow.date), 'yyyy-MM-dd'));
      setBagsWithdrawn(outflow.bagsWithdrawn);
      setRentBilled(outflow.rentBilled);
      setDiscount(outflow.discount || 0);
      setKhataAmount(record.khataAmount || 0);
      setCommodityDescription(record.commodityDescription);
      setLocation(record.location || '');
      setLorryTractorNo(record.lorryTractorNo || '');
      setWeight(record.weight || '');
    }
  }, [isOpen, outflow, record]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestore || !appUser?.warehouseId) {
      toast({ title: 'Error', description: 'Firestore or Warehouse session missing.', variant: 'destructive' });
      return;
    }

    const dataToValidate = {
      date,
      bagsWithdrawn: bagsWithdrawn === '' ? 0 : Number(bagsWithdrawn),
      rentBilled: rentBilled === '' ? 0 : Number(rentBilled),
      discount: discount === '' ? 0 : Number(discount),
      khataAmount: khataAmount === '' ? 0 : Number(khataAmount),
      commodityDescription,
      location,
      lorryTractorNo,
      weight: weight === '' ? 0 : Number(weight),
    };

    const result = OutflowEditSchema.safeParse(dataToValidate);

    if (!result.success) {
      const firstError = Object.values(result.error.flatten().fieldErrors)[0]?.[0];
      toast({
        title: "Validation Error",
        description: firstError || "Please check your input.",
        variant: "destructive",
      });
      return;
    }

    startTransition(async () => {
      try {
        const finalDate = new Date(result.data.date);
        
        if (isConsolidated) {
            // Update shared metadata across all records in the Patti
            await editPattiMetadata(firestore, appUser.warehouseId!, deliveryOrderNo, {
                date: finalDate,
                commodityDescription: result.data.commodityDescription,
                location: result.data.location,
                lorryTractorNo: result.data.lorryTractorNo,
                weight: result.data.weight,
                khataAmount: result.data.khataAmount,
                discount: result.data.discount,
            });
            toast({ title: 'Consolidated Bill Updated', description: 'Changes synchronized across all lot records.' });
        } else {
            // Standard single-record update
            const newData = {
              date: finalDate,
              bagsWithdrawn: result.data.bagsWithdrawn,
              rentBilled: result.data.rentBilled,
              discount: result.data.discount || 0,
              khataAmount: result.data.khataAmount,
              commodityDescription: result.data.commodityDescription,
              location: result.data.location,
              lorryTractorNo: result.data.lorryTractorNo,
              weight: result.data.weight,
            };
            await editOutflowEvent(firestore, record.id, outflowIndex, newData);
            toast({ title: 'Success', description: 'Bill details updated successfully.' });
        }
        setIsOpen(false);
      } catch (error) {
        console.error(error);
        toast({ title: 'Update Failed', description: `${error instanceof Error ? error.message : 'An unknown error occurred.'}`, variant: 'destructive' });
      }
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[500px] max-h-[95vh] overflow-y-auto">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle className="text-xl font-bold uppercase tracking-tight">Edit Outflow Bill</DialogTitle>
              <DialogDescription className="text-xs font-medium">
                Correcting Bill No. {deliveryOrderNo}. {isConsolidated ? "This is a bulk bill spanning multiple lots." : ""}
              </DialogDescription>
            </DialogHeader>

            {isConsolidated && (
                <Alert variant="default" className="bg-primary/5 border-primary/20 my-2">
                    <AlertTriangle className="h-4 w-4 text-primary" />
                    <AlertTitle className="text-[10px] font-black uppercase tracking-wider text-primary">Bulk Bill Notice</AlertTitle>
                    <AlertDescription className="text-[11px] leading-relaxed font-medium">
                        For bulk bills, **Bags** and **Rent** distribution must remain fixed. You can only update shared details like Date, Vehicle No, Lot, and Products.
                    </AlertDescription>
                </Alert>
            )}

            <div className="grid gap-4 py-4 pr-2">
              <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="edit-date" className="text-xs uppercase font-bold text-slate-500">Withdrawal Date</Label>
                    <Input id="edit-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-9 font-bold" />
                  </div>
                   <div className="space-y-1.5">
                    <Label htmlFor="edit-commodity" className="text-xs uppercase font-bold text-slate-500">Commodity</Label>
                    <Combobox
                        options={commodityOptions}
                        value={commodityDescription}
                        onChange={setCommodityDescription}
                        placeholder="Select product..."
                        searchPlaceholder="Search products..."
                        modal={true}
                    />
                  </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="edit-location" className="text-xs uppercase font-bold text-slate-500">Primary Lot</Label>
                    <Select onValueChange={setLocation} value={location}>
                        <SelectTrigger id="edit-location" className="h-9 font-bold"><SelectValue placeholder="Select lot..." /></SelectTrigger>
                        <SelectContent>
                            {lotOptions.map(opt => (
                                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="edit-lorry" className="text-xs uppercase font-bold text-slate-500">Vehicle No.</Label>
                    <Input id="edit-lorry" value={lorryTractorNo} onChange={(e) => setLorryTractorNo(e.target.value)} className="h-9" />
                  </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="edit-bags" className="text-xs uppercase font-bold text-slate-500">Bags Withdrawn</Label>
                    <Input 
                        id="edit-bags" 
                        type="number" 
                        step="0.01" 
                        value={bagsWithdrawn} 
                        onChange={(e) => setBagsWithdrawn(e.target.value === '' ? '' : Number(e.target.value))} 
                        className="h-9 font-mono font-black"
                        disabled={isConsolidated} // Distributing bags across Patti is too complex for this dialog
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="edit-weight" className="text-xs uppercase font-bold text-slate-500">Total Weight (Kg)</Label>
                    <Input 
                        id="edit-weight" 
                        type="number" 
                        step="0.01" 
                        value={weight} 
                        onChange={(e) => setWeight(e.target.value === '' ? '' : Number(e.target.value))} 
                        className="h-9 font-mono"
                    />
                  </div>
              </div>

              <Separator className="my-2" />

              <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="edit-rent" className="text-xs uppercase font-bold text-slate-500">Rent</Label>
                    <Input 
                        id="edit-rent" 
                        type="number" 
                        step="0.01" 
                        value={rentBilled} 
                        onChange={(e) => setRentBilled(e.target.value === '' ? '' : Number(e.target.value))} 
                        className="h-9 font-mono font-bold text-blue-600"
                        disabled={isConsolidated} // Rent is tied to specific records
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="edit-khata" className="text-xs uppercase font-bold text-slate-500">Khata</Label>
                    <Input 
                        id="edit-khata" 
                        type="number" 
                        step="0.01" 
                        value={khataAmount} 
                        onChange={(e) => setKhataAmount(e.target.value === '' ? '' : Number(e.target.value))} 
                        className="h-9 font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="edit-discount" className="text-xs uppercase font-bold text-slate-500">Disc (-)</Label>
                    <Input 
                        id="edit-discount" 
                        type="number" 
                        step="0.01" 
                        value={discount} 
                        onChange={(e) => setDiscount(e.target.value === '' ? '' : Number(e.target.value))} 
                        className="h-9 font-mono font-bold text-green-600"
                    />
                  </div>
              </div>
            </div>
            <DialogFooter className="gap-2 pt-2 border-t mt-4">
              <DialogClose asChild>
                <Button variant="outline" className="text-xs uppercase font-bold h-10">Cancel</Button>
              </DialogClose>
              <Button type="submit" disabled={isPending} className="text-xs uppercase font-black tracking-widest h-10">
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