
'use client';

import { useState, useTransition, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import type { DryingRecord, UnloadingRecord } from '@/lib/definitions';
import { format } from 'date-fns';
import { toDate, cleanForFirestore } from '@/lib/utils';
import { useFirestore } from '@/firebase/provider';
import { updateDryingRecord } from '@/lib/data';

const EditDryingSchema = z.object({
  dryingStartDate: z.string().refine(val => !isNaN(Date.parse(val))),
  bagsForDrying: z.coerce.number().int().positive('Bags for drying must be a positive number.'),
  hamaliPerBag: z.coerce.number().nonnegative('Hamali rate must be non-negative.'),
  bagsPacked: z.coerce.number().int().nonnegative('Bags packed must be non-negative.').optional(),
  packingDate: z.string().optional(),
}).refine(data => !data.packingDate || data.packingDate === '' || new Date(data.packingDate) >= new Date(data.dryingStartDate), {
    message: "Packing date cannot be before start date.",
    path: ["packingDate"],
}).refine(data => data.bagsPacked === undefined || data.bagsForDrying >= data.bagsPacked, {
    message: "Bags packed cannot exceed bags for drying.",
    path: ["bagsPacked"],
});

type EditDryingFormData = z.infer<typeof EditDryingSchema>;

export function EditDryingDialog({ record, unloadingRecord, children }: { record: DryingRecord; unloadingRecord?: UnloadingRecord; children: React.ReactNode }) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const firestore = useFirestore();
  const isBilled = record.status === 'Billed';

  const form = useForm<EditDryingFormData>({
    resolver: zodResolver(EditDryingSchema),
    defaultValues: {},
  });

  useEffect(() => {
    if (isOpen) {
      form.reset({
        dryingStartDate: format(toDate(record.dryingStartDate), 'yyyy-MM-dd'),
        bagsForDrying: record.bagsForDrying,
        hamaliPerBag: record.hamaliPerBag,
        bagsPacked: record.bagsPacked ?? undefined,
        packingDate: record.packingDate ? format(toDate(record.packingDate), 'yyyy-MM-dd') : undefined,
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, record]);
  

  const onSubmit = (data: EditDryingFormData) => {
    if (!firestore || isBilled) {
      toast({ title: 'Error', description: 'Cannot update a billed record.', variant: 'destructive' });
      return;
    }
    
    startTransition(async () => {
      try {
        const totalDryingHamali = data.bagsForDrying * data.hamaliPerBag;

        const updateData: Partial<DryingRecord> = {
          dryingStartDate: new Date(data.dryingStartDate),
          bagsForDrying: data.bagsForDrying,
          hamaliPerBag: data.hamaliPerBag,
          totalDryingHamali: totalDryingHamali,
          totalDryingWorkerHamali: totalDryingHamali,
          bagsPacked: data.bagsPacked,
          packingDate: data.packingDate ? new Date(data.packingDate) : null,
          status: data.packingDate ? 'Packing' : 'Drying',
        };
        
        await updateDryingRecord(firestore, record.id, record.bagsForDrying, updateData);

        toast({ title: 'Success', description: 'Drying record has been updated.' });
        setIsOpen(false);
      } catch (error) {
        console.error(error);
        toast({ title: 'Error', description: error instanceof Error ? error.message : 'Failed to update record.', variant: 'destructive' });
      }
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <DialogHeader>
              <DialogTitle>Edit Drying Record</DialogTitle>
              <DialogDescription>
                Update the details for this drying process.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4 max-h-[60vh] overflow-y-auto pr-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="dryingStartDate"
                  render={({ field }) => (
                    <FormItem>
                        <FormLabel>Drying Start Date</FormLabel>
                        <FormControl><Input type="date" {...field} /></FormControl>
                        <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="bagsForDrying"
                  render={({ field }) => (
                    <FormItem>
                        <FormLabel>Bags for Drying</FormLabel>
                        <FormControl><Input type="number" {...field} value={field.value ?? ''} /></FormControl>
                        <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Bags available on source unloading bill: {unloadingRecord ? (unloadingRecord.bagsUnloaded - (unloadingRecord.bagsSentToDrying || 0) + record.bagsForDrying) : 'N/A'}
              </p>
               <FormField
                  control={form.control}
                  name="hamaliPerBag"
                  render={({ field }) => (
                    <FormItem>
                        <FormLabel>Drying Hamali Rate</FormLabel>
                        <FormControl><Input type="number" step="0.01" {...field} value={field.value ?? ''} /></FormControl>
                        <FormMessage />
                    </FormItem>
                  )}
                />
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t">
                <FormField
                    control={form.control}
                    name="packingDate"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Packing Date (Optional)</FormLabel>
                            <FormControl><Input type="date" {...field} value={field.value ?? ''} /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="bagsPacked"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Bags Packed (Optional)</FormLabel>
                            <FormControl><Input type="number" {...field} value={field.value ?? ''} /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild><Button variant="outline" type="button">Cancel</Button></DialogClose>
              {!isBilled && (
                <Button type="submit" disabled={isPending}>
                  {isPending ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>
                  ) : (
                    <><Save className="mr-2 h-4 w-4" /> Save Changes</>
                  )}
                </Button>
              )}
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
