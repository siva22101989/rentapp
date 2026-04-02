
'use client';

import { useState, useTransition } from 'react';
import { Loader2, PlusCircle } from 'lucide-react';
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
import { saveCommodity } from '@/lib/data';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../ui/form';
import { Input } from '../ui/input';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';

const CommoditySchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters.'),
  billingType: z.enum(['monthly', 'slab']),
  monthlyRate: z.coerce.number().optional(),
  rate6Months: z.coerce.number().optional(),
  rate1Year: z.coerce.number().optional(),
}).superRefine((data, ctx) => {
    if (data.billingType === 'monthly') {
        if (!data.monthlyRate || data.monthlyRate <= 0) {
            ctx.addIssue({
                code: 'custom',
                message: 'Monthly rate must be a positive number.',
                path: ['monthlyRate'],
            });
        }
    } else if (data.billingType === 'slab') {
        if (!data.rate6Months || data.rate6Months <= 0) {
            ctx.addIssue({
                code: 'custom',
                message: '6-month rate must be a positive number.',
                path: ['rate6Months'],
            });
        }
        if (!data.rate1Year || data.rate1Year <= 0) {
            ctx.addIssue({
                code: 'custom',
                message: '1-year rate must be a positive number.',
                path: ['rate1Year'],
            });
        }
    }
});

type CommodityFormData = z.infer<typeof CommoditySchema>;

export function AddCommodityDialog() {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const firestore = useFirestore();

  const form = useForm<CommodityFormData>({
    resolver: zodResolver(CommoditySchema),
    defaultValues: {
      name: '',
      billingType: 'slab',
    },
  });

  const billingType = form.watch('billingType');

  const onSubmit = (data: CommodityFormData) => {
    if (!firestore) {
      toast({ title: 'Error', description: 'Firestore not available.', variant: 'destructive' });
      return;
    }

    startTransition(async () => {
      try {
        await saveCommodity(firestore, data);
        toast({ title: 'Success', description: 'Commodity added successfully.' });
        setIsOpen(false);
        form.reset();
      } catch (error) {
        console.error(error);
        toast({ title: 'Error', description: 'Failed to save commodity.', variant: 'destructive' });
      }
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button>
          <PlusCircle className="mr-2" />
          Add Commodity
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <DialogHeader>
              <DialogTitle>Add New Commodity</DialogTitle>
              <DialogDescription>
                Enter the commodity name and choose its billing structure.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Commodity Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Paddy" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="billingType"
                render={({ field }) => (
                  <FormItem className="space-y-3">
                    <FormLabel>Billing Structure</FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        className="flex space-x-4"
                      >
                        <FormItem className="flex items-center space-x-2 space-y-0">
                          <FormControl>
                            <RadioGroupItem value="slab" />
                          </FormControl>
                          <FormLabel className="font-normal">Slab Rate</FormLabel>
                        </FormItem>
                        <FormItem className="flex items-center space-x-2 space-y-0">
                          <FormControl>
                            <RadioGroupItem value="monthly" />
                          </FormControl>
                          <FormLabel className="font-normal">Monthly Rate</FormLabel>
                        </FormItem>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {billingType === 'monthly' && (
                <FormField
                  control={form.control}
                  name="monthlyRate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Monthly Rate (per bag)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" placeholder="0.00" {...field} value={field.value ?? ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {billingType === 'slab' && (
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="rate6Months"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>6-Month Rate</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" placeholder="0.00" {...field} value={field.value ?? ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="rate1Year"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>1-Year Rate</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" placeholder="0.00" {...field} value={field.value ?? ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}
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
                  'Save Commodity'
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
