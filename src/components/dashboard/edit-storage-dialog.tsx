
'use client';

import { useEffect, useState, useTransition } from 'react';
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
import type { Customer, StorageRecord, Commodity, Lot } from '@/lib/definitions';
import { format } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { toDate, cleanForFirestore } from '@/lib/utils';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../ui/form';
import { useFirestore } from '@/firebase';
import { updateStorageRecord } from '@/lib/data';
import { useCollection } from '@/firebase/firestore/use-collection';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { collection } from 'firebase/firestore';


const StorageRecordSchema = z.object({
  customerId: z.string().min(1, 'Customer is required.'),
  commodityDescription: z.string().min(1, 'Commodity is required.'),
  location: z.string().optional(),
  bagsStored: z.coerce.number().int().nonnegative(),
  hamaliPayable: z.coerce.number().nonnegative(),
  storageStartDate: z.string().refine(val => !isNaN(Date.parse(val))),
});

type StorageRecordFormData = z.infer<typeof StorageRecordSchema>;


export function EditStorageDialog({ record, customers, children }: { record: StorageRecord, customers: Customer[], children: React.ReactNode }) {
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

  const form = useForm<StorageRecordFormData>({
    resolver: zodResolver(StorageRecordSchema),
    defaultValues: {
      customerId: record.customerId,
      commodityDescription: record.commodityDescription,
      location: record.location || '',
      bagsStored: record.bagsStored,
      hamaliPayable: record.hamaliPayable,
      storageStartDate: format(toDate(record.storageStartDate), 'yyyy-MM-dd'),
    }
  });
  
  const onSubmit = (data: StorageRecordFormData) => {
    if (!firestore) {
      toast({ variant: 'destructive', title: 'Error', description: 'Firestore not available' });
      return;
    }
    startTransition(async () => {
      try {
        const updateData = {
          ...data,
          storageStartDate: new Date(data.storageStartDate),
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
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
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
                    name="location"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Location</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                {lots?.map(lot => (
                                    <SelectItem key={lot.id} value={lot.name}>
                                        {lot.name}
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
                    name="storageStartDate"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Start Date</FormLabel>
                        <FormControl><Input type="date" {...field} /></FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
              </div>
               <div className="grid grid-cols-2 gap-4">
                 <FormField
                    control={form.control}
                    name="bagsStored"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Bags Stored</FormLabel>
                        <FormControl><Input type="number" {...field} /></FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                 <FormField
                    control={form.control}
                    name="hamaliPayable"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Hamali Payable</FormLabel>
                        <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
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
        </Form>
      </DialogContent>
    </Dialog>
  );
}
