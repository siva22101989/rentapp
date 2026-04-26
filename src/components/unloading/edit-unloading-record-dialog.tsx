
'use client';

import { useState, useTransition, useEffect } from 'react';
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
import type { Customer, UnloadingRecord, Commodity } from '@/lib/definitions';
import { useFirestore } from '@/firebase/provider';
import { z } from 'zod';
import { updateUnloadingRecord } from '@/lib/data';
import { toDate, cleanForFirestore } from '@/lib/utils';
import { Combobox } from '../ui/combobox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

const EditUnloadingSchema = z.object({
  customerId: z.string().min(1, 'Customer is required.'),
  commodityDescription: z.string().min(1, 'Commodity is required.'),
  lorryTractorNo: z.string().optional(),
  unloadingDate: z.string().refine(val => !isNaN(Date.parse(val)), { message: "Invalid date format" }),
  bagsUnloaded: z.coerce.number().int().positive('Number of bags must be positive.'),
  hamaliPerBag: z.coerce.number().nonnegative('Hamali rate must be non-negative.'),
});

type EditUnloadingFormData = z.infer<typeof EditUnloadingSchema>;

export function EditUnloadingRecordDialog({ 
    record, 
    customers, 
    commodities,
    children 
}: { 
    record: UnloadingRecord, 
    customers: Customer[], 
    commodities: Commodity[],
    children: React.ReactNode 
}) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const firestore = useFirestore();
  const customerOptions = customers.map(c => ({ value: c.id, label: c.name }));

  const [customerId, setCustomerId] = useState('');
  const [commodityDescription, setCommodityDescription] = useState('');
  const [lorryTractorNo, setLorryTractorNo] = useState('');
  const [unloadingDate, setUnloadingDate] = useState('');
  const [bagsUnloaded, setBagsUnloaded] = useState<number | ''>('');
  const [hamaliPerBag, setHamaliPerBag] = useState<number | ''>('');
  const [error, setError] = useState<Record<string, string>>({});

  const getLocalDateTimeForInput = (date: Date) => {
    const timezoneOffsetInMs = date.getTimezoneOffset() * 60000;
    const localDate = new Date(date.getTime() - timezoneOffsetInMs);
    return localDate.toISOString().slice(0, 16);
  };
  
  const handleOpenChange = (open: boolean) => {
    if (open) {
      setCustomerId(record.customerId);
      setCommodityDescription(record.commodityDescription);
      setLorryTractorNo(record.lorryTractorNo || '');
      setUnloadingDate(getLocalDateTimeForInput(toDate(record.unloadingDate)));
      setBagsUnloaded(record.bagsUnloaded);
      setHamaliPerBag(record.hamaliPerBag);
      setError({});
    }
    setIsOpen(open);
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError({});
    if (!firestore) {
      toast({ title: 'Error', description: 'Firestore not available.', variant: 'destructive' });
      return;
    }

    const dataToValidate = {
      customerId,
      commodityDescription,
      lorryTractorNo,
      unloadingDate,
      bagsUnloaded: Number(bagsUnloaded),
      hamaliPerBag: Number(hamaliPerBag),
    };

    const result = EditUnloadingSchema.safeParse(dataToValidate);

    if (!result.success) {
      const fieldErrors = result.error.flatten().fieldErrors;
      setError(Object.entries(fieldErrors).reduce((acc, [key, value]) => {
        if(value) acc[key] = value[0];
        return acc;
      }, {} as Record<string, string>));
      return;
    }

    if (result.data.bagsUnloaded < (record.bagsSentToDrying || 0)) {
        setError({ bagsUnloaded: `Cannot be less than bags already sent to drying (${record.bagsSentToDrying}).` });
        return;
    }

    startTransition(async () => {
      try {
        const totalHamali = result.data.bagsUnloaded * result.data.hamaliPerBag;
        const updateData = {
          ...result.data,
          unloadingDate: new Date(result.data.unloadingDate),
          totalHamali,
          workerHamaliPayable: totalHamali,
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
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit Unloading Record</DialogTitle>
            <DialogDescription>
              Adjust details for Bill No. {record.billNo}.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
                <Label htmlFor="customerId">Customer</Label>
                <Combobox
                    options={customerOptions}
                    value={customerId}
                    onChange={setCustomerId}
                    placeholder="Select a customer..."
                    searchPlaceholder="Search customers..."
                    emptyPlaceholder="No customer found."
                />
                {error.customerId && <p className="text-sm font-medium text-destructive">{error.customerId}</p>}
            </div>
             <div className="space-y-2">
                <Label htmlFor="commodityDescription">Commodity</Label>
                <Select onValueChange={setCommodityDescription} value={commodityDescription}>
                    <SelectTrigger id="commodityDescription"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        {commodities.map(commodity => (
                            <SelectItem key={commodity.id} value={commodity.name}>
                                {commodity.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                 {error.commodityDescription && <p className="text-sm font-medium text-destructive">{error.commodityDescription}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="lorryTractorNo">Lorry/Tractor No.</Label>
              <Input id="lorryTractorNo" value={lorryTractorNo || ''} onChange={(e) => setLorryTractorNo(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="unloadingDate">Unloading Date & Time</Label>
              <Input id="unloadingDate" type="datetime-local" value={unloadingDate} onChange={e => setUnloadingDate(e.target.value)} />
              {error.unloadingDate && <p className="text-sm font-medium text-destructive">{error.unloadingDate}</p>}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="bagsUnloaded">Bags Unloaded</Label>
                <Input id="bagsUnloaded" type="number" value={bagsUnloaded} onChange={e => setBagsUnloaded(e.target.value === '' ? '' : Number(e.target.value))} />
                {error.bagsUnloaded && <p className="text-sm font-medium text-destructive">{error.bagsUnloaded}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="hamaliPerBag">Hamali per Bag</Label>
                <Input id="hamaliPerBag" type="number" step="0.01" value={hamaliPerBag} onChange={e => setHamaliPerBag(e.target.value === '' ? '' : Number(e.target.value))} />
                 {error.hamaliPerBag && <p className="text-sm font-medium text-destructive">{error.hamaliPerBag}</p>}
              </div>
            </div>
            {record.bagsSentToDrying > 0 && <p className="text-xs text-muted-foreground">Note: {record.bagsSentToDrying} bags have already been sent for drying from this record.</p>}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" type="button">Cancel</Button>
            </DialogClose>
            <Button type="submit" disabled={isPending}>
              {isPending ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>
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
