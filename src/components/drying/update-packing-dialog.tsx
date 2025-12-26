
'use client';

import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, PackageCheck } from 'lucide-react';
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
import { useFirestore } from '@/firebase';
import type { DryingRecord } from '@/lib/definitions';
import { doc, Timestamp, updateDoc } from 'firebase/firestore';
import { format } from 'date-fns';
import { toDate } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Info } from 'lucide-react';

const UpdatePackingSchema = z.object({
  bagsPacked: z.coerce.number().int().positive('Number of bags must be a positive number.'),
  packingDate: z.string().refine(val => !isNaN(Date.parse(val)), { message: "Invalid date" }),
});

type PackingFormData = z.infer<typeof UpdatePackingSchema>;

export function UpdatePackingDialog({ record, children }: { record: DryingRecord; children: React.ReactNode }) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const firestore = useFirestore();
  const isBilled = record.status === 'Billed';

  const form = useForm<PackingFormData>({
    resolver: zodResolver(UpdatePackingSchema),
    defaultValues: {
      bagsPacked: record.bagsPacked || undefined,
      packingDate: record.packingDate ? format(toDate(record.packingDate), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
    },
  });

  const onSubmit = (data: PackingFormData) => {
    if (!firestore) {
      toast({ title: 'Error', description: 'Firestore not available.', variant: 'destructive' });
      return;
    }

    startTransition(async () => {
      try {
        const recordRef = doc(firestore, 'dryingRecords', record.id);
        await updateDoc(recordRef, {
          bagsPacked: data.bagsPacked,
          packingDate: Timestamp.fromDate(new Date(data.packingDate)),
          status: 'Packing',
        });

        toast({ title: 'Success', description: 'Packing information updated successfully.' });
        setIsOpen(false);
      } catch (error) {
        console.error(error);
        toast({ title: 'Error', description: 'Failed to update packing info.', variant: 'destructive' });
      }
    });
  };
  
  const bagsDifference = record.bagsPacked ? record.bagsForDrying - record.bagsPacked : null;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <DialogHeader>
              <DialogTitle>Update Packing Information</DialogTitle>
              <DialogDescription>
                Record the final number of bags after packing is complete for this lot.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4">
                 <Alert variant="default" className="bg-secondary/50">
                    <Info className="h-4 w-4" />
                    <AlertTitle>Bags Sent for Drying</AlertTitle>
                    <AlertDescription>
                        <span className="font-bold text-xl">{record.bagsForDrying}</span> bags
                    </AlertDescription>
                </Alert>
                <FormField
                    control={form.control}
                    name="bagsPacked"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Number of Bags Packed</FormLabel>
                        <FormControl>
                            <Input type="number" placeholder="0" {...field} value={field.value ?? ''} disabled={isBilled} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                 <FormField
                    control={form.control}
                    name="packingDate"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Packing Completion Date</FormLabel>
                        <FormControl>
                            <Input type="date" {...field} disabled={isBilled} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                 {bagsDifference !== null && bagsDifference !== 0 && (
                     <p className="text-sm text-center font-medium text-destructive">
                        Note: There is a difference of {Math.abs(bagsDifference)} bag{Math.abs(bagsDifference) > 1 ? 's' : ''} ({bagsDifference > 0 ? 'less' : 'more'}) after packing.
                    </p>
                )}
            </div>
            <DialogFooter>
              <DialogClose asChild><Button variant="outline" type="button">Cancel</Button></DialogClose>
              {!isBilled && (
                <Button type="submit" disabled={isPending}>
                  {isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                  ) : (
                      <>
                        <PackageCheck className="mr-2 h-4 w-4" />
                        Update Status to 'Packing'
                      </>
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
