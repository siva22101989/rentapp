
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
import { useToast } from '@/hooks/use-toast';
import type { Customer, UnloadingRecord, Commodity } from '@/lib/definitions';
import { useFirestore } from '@/firebase/provider';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../ui/form';
import { updateUnloadingRecord } from '@/lib/data';
import { format } from 'date-fns';
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

  const getLocalDateTimeForInput = (date: Date) => {
    const timezoneOffsetInMs = date.getTimezoneOffset() * 60000;
    const localDate = new Date(date.getTime() - timezoneOffsetInMs);
    return localDate.toISOString().slice(0, 16);
  };
  
  const form = useForm<EditUnloadingFormData>({
    resolver: zodResolver(EditUnloadingSchema),
    defaultValues: {},
  });

  const handleOpenChange = (open: boolean) => {
    if (open) {
      form.reset({
        customerId: record.customerId,
        commodityDescription: record.commodityDescription,
        lorryTractorNo: record.lorryTractorNo || '',
        unloadingDate: getLocalDateTimeForInput(toDate(record.unloadingDate)),
        bagsUnloaded: record.bagsUnloaded,
        hamaliPerBag: record.hamaliPerBag,
      });
    }
    setIsOpen(open);
  }

  const onSubmit = (data: EditUnloadingFormData) => {
    if (!firestore) {
      toast({ title: 'Error', description: 'Firestore not available.', variant: 'destructive' });
      return;
    }

    if (data.bagsUnloaded < (record.bagsSentToDrying || 0)) {
        form.setError('bagsUnloaded', { message: `Cannot be less than bags already sent to drying (${record.bagsSentToDrying}).` });
        return;
    }

    startTransition(async () => {
      try {
        const totalHamali = data.bagsUnloaded * data.hamaliPerBag;
        const updateData = {
          ...data,
          unloadingDate: new Date(data.unloadingDate),
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
        <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>Edit Unloading Record</DialogTitle>
            <DialogDescription>
              Adjust details for Bill No. {record.billNo}.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <FormField
                control={form.control}
                name="customerId"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                      <FormLabel>Customer</FormLabel>
                      <Combobox
                          options={customerOptions}
                          value={field.value}
                          onChange={field.onChange}
                          placeholder="Select a customer..."
                          searchPlaceholder="Search customers..."
                          emptyPlaceholder="No customer found."
                      />
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
                              {commodities.map(commodity => (
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
            <FormField
              control={form.control}
              name="lorryTractorNo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Lorry/Tractor No.</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="unloadingDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Unloading Date & Time</FormLabel>
                  <FormControl><Input type="datetime-local" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="bagsUnloaded"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bags Unloaded</FormLabel>
                    <FormControl><Input type="number" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="hamaliPerBag"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Hamali per Bag</FormLabel>
                    <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
        </Form>
      </DialogContent>
    </Dialog>
  );
}
