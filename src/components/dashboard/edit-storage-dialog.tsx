
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
import type { Customer, StorageRecord, Commodity, Lot } from '@/lib/definitions';
import { format } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { toDate, cleanForFirestore } from '@/lib/utils';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../ui/form';
import { useFirestore } from '@/firebase/provider';
import { updateStorageRecord } from '@/lib/data';
import { useCollection } from '@/firebase/firestore/use-collection';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { collection } from 'firebase/firestore';


const EditStorageRecordSchema = z.object({
  customerId: z.string().min(1, 'Customer is required.'),
  commodityDescription: z.string().min(1, 'Commodity is required.'),
  location: z.string().optional(),
  storageStartDate: z.string().refine(val => !isNaN(Date.parse(val))),
  bagsIn: z.coerce.number().int().nonnegative('Must be a non-negative number.'),
  weight: z.coerce.number().nonnegative('Must be a non-negative number.').optional(),
  lorryTractorNo: z.string().optional(),
  hamaliPayable: z.coerce.number().nonnegative(),
  khataAmount: z.coerce.number().nonnegative().optional(),
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
    defaultValues: {}, // Will be set in handleOpenChange
  });

  const handleOpenChange = (open: boolean) => {
    if (open) {
      form.reset({
        customerId: record.customerId,
        commodityDescription: record.commodityDescription,
        location: record.location || '',
        storageStartDate: format(toDate(record.storageStartDate), 'yyyy-MM-dd'),
        bagsIn: record.bagsIn ?? '',
        weight: record.weight ?? '',
        lorryTractorNo: record.lorryTractorNo || '',
        hamaliPayable: record.hamaliPayable ?? '',
        khataAmount: record.khataAmount ?? '',
      });
    }
    setIsOpen(open);
  }
  
  const onSubmit = (data: EditStorageRecordFormData) => {
    if (!firestore) {
      toast({ variant: 'destructive', title: 'Error', description: 'Firestore not available' });
      return;
    }
    startTransition(async () => {
      try {
        const updateData = {
          ...data,
          storageStartDate: new Date(data.storageStartDate),
          bagsStored: data.bagsIn - (record.bagsOut || 0)
        };
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
      <DialogContent className="sm:max-w-lg">
        <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>Edit Storage Record</DialogTitle>
            <DialogDescription>
              Adjust the details for record {record.id}. Payment history cannot be edited here.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
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
              <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="storageStartDate"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Start Date</FormLabel>
                        <FormControl><Input type="date" {...field} /></FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                 <FormField
                    control={form.control}
                    name="lorryTractorNo"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Lorry/Tractor No.</FormLabel>
                        <FormControl><Input placeholder="AP 12 3456" {...field} value={field.value ?? ''} /></FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                    control={form.control}
                    name="bagsIn"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Bags In</FormLabel>
                        <FormControl><Input type="number" {...field} value={field.value ?? ''} /></FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="weight"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Weight (Kgs)</FormLabel>
                        <FormControl><Input type="number" step="0.01" {...field} value={field.value ?? ''} /></FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
              </div>
               <div className="grid grid-cols-2 gap-4">
                 <FormField
                    control={form.control}
                    name="hamaliPayable"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Hamali Payable</FormLabel>
                        <FormControl><Input type="number" step="0.01" {...field} value={field.value ?? ''} /></FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="khataAmount"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Khata Amount</FormLabel>
                        <FormControl><Input type="number" step="0.01" {...field} value={field.value ?? ''} /></FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
              </div>
              <FormField
                  control={form.control}
                  name="location"
                  render={({ field }) => (
                  <FormItem>
                      <FormLabel>Location</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                              <SelectTrigger><SelectValue placeholder="Select a lot..."/></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                              {lots
                                  ?.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
                                  .map(lot => {
                                      const occupied = lotOccupancy[lot.name] || 0;
                                      const capacity = lot.capacity ? ` / ${lot.capacity}` : '';
                                      return (
                                          <SelectItem key={lot.id} value={lot.name}>
                                              {lot.name} ({occupied}{capacity} bags)
                                          </SelectItem>
                                      )
                              })}
                          </SelectContent>
                      </Select>
                      <FormMessage />
                  </FormItem>
                  )}
              />
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
