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
import type { StorageRecord, Outflow, Commodity, Lot } from '@/lib/definitions';
import { useFirestore } from '@/firebase/provider';
import { z } from 'zod';
import { editOutflowEvent } from '@/lib/data';
import { format } from 'date-fns';
import { toDate, formatCurrency } from '@/lib/utils';
import { Separator } from '../ui/separator';
import { Combobox } from '../ui/combobox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

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
    if (!firestore) {
      toast({ title: 'Error', description: 'Firestore not available.', variant: 'destructive' });
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
        const newData = {
          date: new Date(result.data.date),
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
        toast({ title: 'Success', description: 'Bill details updated and Patti record synchronized.' });
        setIsOpen(false);
      } catch (error) {
        console.error(error);
        toast({ title: 'Error', description: `Failed to update outflow event. ${error instanceof Error ? error.message : ''}`, variant: 'destructive' });
      }
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>Edit Full Outflow Bill</DialogTitle>
              <DialogDescription>
                Correct any details for Bill No. {deliveryOrderNo}. Updates to Commodity or Lot will apply to the entire Patti.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4 pr-2">
              <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-date">Withdrawal Date</Label>
                    <Input id="edit-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                  </div>
                   <div className="space-y-2">
                    <Label htmlFor="edit-commodity">Commodity (Product)</Label>
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
                  <div className="space-y-2">
                    <Label htmlFor="edit-location">Lot No. (Location)</Label>
                    <Select onValueChange={setLocation} value={location}>
                        <SelectTrigger id="edit-location"><SelectValue placeholder="Select lot..." /></SelectTrigger>
                        <SelectContent>
                            {lotOptions.map(opt => (
                                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-lorry">Lorry/Tractor No.</Label>
                    <Input id="edit-lorry" value={lorryTractorNo} onChange={(e) => setLorryTractorNo(e.target.value)} />
                  </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-bags">Bags Withdrawn</Label>
                    <Input 
                        id="edit-bags" 
                        type="number" 
                        step="0.01" 
                        value={bagsWithdrawn} 
                        onChange={(e) => setBagsWithdrawn(e.target.value === '' ? '' : Number(e.target.value))} 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-weight">Weight (Kgs)</Label>
                    <Input 
                        id="edit-weight" 
                        type="number" 
                        step="0.01" 
                        value={weight} 
                        onChange={(e) => setWeight(e.target.value === '' ? '' : Number(e.target.value))} 
                    />
                  </div>
              </div>

              <Separator className="my-2" />

              <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-rent">Rent Billed</Label>
                    <Input 
                        id="edit-rent" 
                        type="number" 
                        step="0.01" 
                        value={rentBilled} 
                        onChange={(e) => setRentBilled(e.target.value === '' ? '' : Number(e.target.value))} 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-khata">Khata Amt</Label>
                    <Input 
                        id="edit-khata" 
                        type="number" 
                        step="0.01" 
                        value={khataAmount} 
                        onChange={(e) => setKhataAmount(e.target.value === '' ? '' : Number(e.target.value))} 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-discount">Discount</Label>
                    <Input 
                        id="edit-discount" 
                        type="number" 
                        step="0.01" 
                        value={discount} 
                        onChange={(e) => setDiscount(e.target.value === '' ? '' : Number(e.target.value))} 
                    />
                  </div>
              </div>
            </div>
            <DialogFooter className="gap-2">
              <DialogClose asChild>
                <Button variant="outline">Cancel</Button>
              </DialogClose>
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