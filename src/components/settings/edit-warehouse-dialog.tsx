
'use client';

import { useState, useTransition } from 'react';
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
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase/provider';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../ui/form';
import { Input } from '../ui/input';
import { updateManagedWarehouse } from '@/lib/data';
import type { ManagedWarehouse } from '@/lib/definitions';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

const WarehouseEditSchema = z.object({
  name: z.string().min(3, 'Warehouse name is required.'),
  ownerName: z.string().min(2, 'Owner name is required.'),
  ownerEmail: z.string().email('A valid owner email is required.'),
  yearlyAmount: z.coerce.number().nonnegative('Yearly amount must be non-negative.'),
  subscriptionStatus: z.enum(['active', 'trial', 'expired', 'suspended']),
  trialMonths: z.coerce.number().int().nonnegative('Trial months must be a non-negative integer.').optional(),
});

type WarehouseEditFormData = z.infer<typeof WarehouseEditSchema>;

export function EditWarehouseDialog({ warehouse, children }: { warehouse: ManagedWarehouse, children: React.ReactNode }) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const firestore = useFirestore();

  const form = useForm<WarehouseEditFormData>({
    resolver: zodResolver(WarehouseEditSchema),
    defaultValues: {
      ...warehouse,
      trialMonths: warehouse.trialMonths || 0,
    },
  });

  const onSubmit = (data: WarehouseEditFormData) => {
    if (!firestore) {
      toast({ title: 'Error', description: 'Firestore not available.', variant: 'destructive' });
      return;
    }

    startTransition(async () => {
      try {
        const updateData = {
          ...data,
          ownerEmail: data.ownerEmail.toLowerCase(),
        };
        await updateManagedWarehouse(firestore, warehouse.id, updateData);
        toast({ title: 'Success', description: 'Warehouse subscription updated.' });
        setIsOpen(false);
      } catch (error) {
        console.error(error);
        toast({ title: 'Error', description: 'Failed to update warehouse.', variant: 'destructive' });
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
              <DialogTitle>Edit Warehouse Subscription</DialogTitle>
              <DialogDescription>
                Update details for {warehouse.name}.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto pr-4">
              <FormField name="name" control={form.control} render={({ field }) => (<FormItem><FormLabel>Warehouse Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField name="ownerName" control={form.control} render={({ field }) => (<FormItem><FormLabel>Owner Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField name="ownerEmail" control={form.control} render={({ field }) => (<FormItem><FormLabel>Owner Email</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <div className="grid grid-cols-2 gap-4">
                <FormField name="yearlyAmount" control={form.control} render={({ field }) => (<FormItem><FormLabel>Yearly Amount</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                <FormField name="trialMonths" control={form.control} render={({ field }) => (<FormItem><FormLabel>Trial (Months)</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
              </div>
               <FormField
                  control={form.control}
                  name="subscriptionStatus"
                  render={({ field }) => (
                  <FormItem>
                      <FormLabel>Subscription Status</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="trial">Trial</SelectItem>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="suspended">Suspended</SelectItem>
                            <SelectItem value="expired">Expired</SelectItem>
                          </SelectContent>
                      </Select>
                      <FormMessage />
                  </FormItem>
                  )}
              />
            </div>
            <DialogFooter className="pt-4">
              <DialogClose asChild><Button variant="outline" type="button">Cancel</Button></DialogClose>
              <Button type="submit" disabled={isPending}>
                {isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
