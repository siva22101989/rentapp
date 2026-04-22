
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
import { useToast } from '@/hooks/use-toast';
import type { Customer, StorageRecord, Commodity, Lot, HamaliChargeItem } from '@/lib/definitions';
import { format, differenceInDays } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { toDate, cleanForFirestore, formatCurrency } from '@/lib/utils';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../ui/form';
import { useFirestore } from '@/firebase/provider';
import { updateStorageRecord } from '@/lib/data';
import { useCollection } from '@/firebase/firestore/use-collection';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { collection } from 'firebase/firestore';
import { Separator } from '../ui/separator';


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

  const commoditiesQuery = useMemoFirebase(
    () => (firestore ? collection(firestore, 'commodities') : null),
    [firestore]
  );
  const { data: commodities, loading: loadingCommodities } = useCollection<Commodity>(commoditiesQuery);

  const lotsQuery = useMemoFirebase(
    () => (firestore ? collection(firestore, 'lots') : null),
    [firestore]
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

  const form = useForm<EditStorageRecordFormData>({
    resolver: zodResolver(EditStorageRecordSchema),
    defaultValues: {}, 
  });

  const handleOpenChange = (open: boolean) => {
    if (open) {
      const getRate = (desc: string) => record.hamaliDetails?.find(d => d.description.startsWith(desc))?.rate;

      form.reset({
        customerId: record.customerId,
        commodityDescription: record.commodityDescription,
        location: record.location || '',
        storageStartDate: format(toDate(record.storageStartDate), 'yyyy-MM-dd'),
        bagsIn: record.bagsIn ?? 0,
        weight: record.weight ?? 0,
        lorryTractorNo: record.lorryTractorNo || '',
        khataAmount: record.khataAmount ?? 0,
        // Plot specific
        bagsForDrying: record.bagsForDrying ?? 0,
        dryingStartDate: record.dryingStartDate ? format(toDate(record.dryingStartDate), 'yyyy-MM-dd') : '',
        customerHamaliPerBag: getRate('Customer Hamali'),
        pavHamaliPerBag: getRate('Pav Hamali'),
        cuppaHamaliPerBag: getRate('Cuppa Hamali'),
        workerHamaliPerBag: undefined, // Cannot derive reliably, user must re-enter if they want to change worker payable.
      });
    }
    setIsOpen(open);
  }
  
  const formValues = form.watch();

  const calculatedHamali = useMemo(() => {
    if (record.inflowType !== 'Plot') return null;

    const { dryingStartDate, storageStartDate, bagsForDrying, customerHamaliPerBag, workerHamaliPerBag, pavHamaliPerBag, cuppaHamaliPerBag } = formValues;

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
        totalWorkerPayable: workerHamaliPerBag !== undefined ? totalWorkerPayable : undefined,
    }

  }, [formValues, record.hamaliDetails, record.inflowType]);


  const onSubmit = (data: EditStorageRecordFormData) => {
    if (!firestore) {
      toast({ variant: 'destructive', title: 'Error', description: 'Firestore not available' });
      return;
    }
    startTransition(async () => {
      try {
        const bagsStored = data.bagsIn - (record.bagsOut || 0);
        if (bagsStored < 0) {
            form.setError('bagsIn', { message: 'Bags in cannot be less than bags out.' });
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
        <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>Edit Storage Record</DialogTitle>
            <DialogDescription>
              Adjust the details for record {record.id}. Payment history cannot be edited here.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto pr-4">
             <FormField
                control={form.control}
                name="customerId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Customer</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                            {customers.map(customer => (
                                <SelectItem key={customer.id} value={customer.id}>
                                    {customer.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
               <FormField
                control={form.control}
                name="commodityDescription"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Commodity</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                             {commodities?.map(commodity => (
                                <SelectItem key={commodity.id} value={commodity.name}>
                                    {commodity.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {record.inflowType === 'Plot' ? (
                <>
                    <Separator className="my-4" />
                    <h4 className="text-sm font-semibold text-muted-foreground -mb-2">Drying & Hamali Details</h4>

                    <div className="grid grid-cols-2 gap-4">
                        <FormField control={form.control} name="dryingStartDate" render={({ field }) => (
                            <FormItem><FormLabel>Drying Start Date</FormLabel><FormControl><Input type="date" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                        )}/>
                        <FormField control={form.control} name="storageStartDate" render={({ field }) => (
                            <FormItem><FormLabel>Drying End Date (Storage Date)</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                        )}/>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                         <FormField control={form.control} name="bagsForDrying" render={({ field }) => (
                            <FormItem><FormLabel>Bags Plotted for Drying</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                         )}/>
                         <FormField control={form.control} name="bagsIn" render={({ field }) => (
                            <FormItem><FormLabel>Bags Packed (Final Stock)</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                         )}/>
                    </div>

                     <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <FormField control={form.control} name="customerHamaliPerBag" render={({ field }) => (
                            <FormItem><FormLabel>Cust. Hamali/Bag</FormLabel><FormControl><Input type="number" step="0.01" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                        )}/>
                         <FormField control={form.control} name="workerHamaliPerBag" render={({ field }) => (
                            <FormItem><FormLabel>Worker Hamali/Bag</FormLabel><FormControl><Input type="number" step="0.01" {...field} value={field.value ?? ''} placeholder="Re-enter to update" /></FormControl><FormMessage /></FormItem>
                        )}/>
                         <FormField control={form.control} name="pavHamaliPerBag" render={({ field }) => (
                            <FormItem><FormLabel>Pav Hamali/Bag/Day</FormLabel><FormControl><Input type="number" step="0.01" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                        )}/>
                         <FormField control={form.control} name="cuppaHamaliPerBag" render={({ field }) => (
                            <FormItem><FormLabel>Cuppa Hamali/Bag/Day</FormLabel><FormControl><Input type="number" step="0.01" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                        )}/>
                    </div>
                    {calculatedHamali && (
                        <div className="space-y-2 p-3 border rounded-md text-sm">
                            <h5 className="font-medium">Live Summary</h5>
                            <div className="flex justify-between"><span className="text-muted-foreground">Unloading Hamali:</span> <span className="font-mono">{formatCurrency(calculatedHamali.proportionalUnloadingHamali)}</span></div>
                            <div className="flex justify-between"><span className="text-muted-foreground">Day 1 Hamali:</span> <span className="font-mono">{formatCurrency(calculatedHamali.day1CustomerHamali)}</span></div>
                            <div className="flex justify-between"><span className="text-muted-foreground">Pav Hamali ({calculatedHamali.extraDryingDays} extra days):</span> <span className="font-mono">{formatCurrency(calculatedHamali.pavHamali)}</span></div>
                            <div className="flex justify-between"><span className="text-muted-foreground">Cuppa Hamali ({calculatedHamali.extraDryingDays} extra days):</span> <span className="font-mono">{formatCurrency(calculatedHamali.cuppaHamali)}</span></div>
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
                        <FormField control={form.control} name="storageStartDate" render={({ field }) => ( <FormItem><FormLabel>Start Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem> )} />
                        <FormField control={form.control} name="lorryTractorNo" render={({ field }) => ( <FormItem><FormLabel>Lorry/Tractor No.</FormLabel><FormControl><Input placeholder="AP 12 3456" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem> )} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <FormField control={form.control} name="bagsIn" render={({ field }) => ( <FormItem><FormLabel>Bags In</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem> )} />
                        <FormField control={form.control} name="weight" render={({ field }) => ( <FormItem><FormLabel>Weight (Kgs)</FormLabel><FormControl><Input type="number" step="0.01" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem> )}/>
                    </div>
                </>
              )}
               <FormField name="location" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Location</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Select a lot..."/></SelectTrigger></FormControl>
                            <SelectContent>
                                {lots?.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })).map(lot => {
                                    const occupied = lotOccupancy[lot.name] || 0;
                                    const capacity = lot.capacity ? ` / ${lot.capacity}` : '';
                                    return ( <SelectItem key={lot.id} value={lot.name}> {lot.name} ({occupied}{capacity} bags) </SelectItem> )
                                })}
                            </SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
                )}/>
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
        </Form>
      </DialogContent>
    </Dialog>
  );
}
