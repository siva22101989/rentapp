
'use client';

import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import type { DryingRecord, DryingStatus } from '@/lib/definitions';

const PackingSchema = z.object({
  bagsPacked: z.coerce.number().int().nonnegative('Must be a non-negative number.'),
});

type PackingFormData = z.infer<typeof PackingSchema>;

interface UpdatePackingDialogProps {
    record: DryingRecord;
    children: React.ReactNode;
    onUpdate: (newStatus: DryingStatus, bagsPacked: number) => void;
}

export function UpdatePackingDialog({ record, children, onUpdate }: UpdatePackingDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const form = useForm<PackingFormData>({
    resolver: zodResolver(PackingSchema),
    defaultValues: {
      bagsPacked: record.bagsForDrying, // Default to original bag count
    },
  });

  const onSubmit = (data: PackingFormData) => {
    startTransition(() => {
        onUpdate('Packing', data.bagsPacked);
        setIsOpen(false);
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <DialogHeader>
              <DialogTitle>Update Packing Information</DialogTitle>
              <DialogDescription>
                Enter the final number of bags packed for record {record.id}.
                Initial bags for drying: {record.bagsForDrying}.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <FormField
                control={form.control}
                name="bagsPacked"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Number of Bags Packed</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="0" {...field} />
                    </FormControl>
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
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Updating...</>
                ) : (
                  'Update and Move to Packing'
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
