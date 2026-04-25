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
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase/provider';
import { updateCommodity } from '@/lib/data';
import { z } from 'zod';
import { Input } from '../ui/input';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import type { Commodity } from '@/lib/definitions';
import { Label } from '../ui/label';

const CommoditySchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters.'),
  billingType: z.enum(['monthly', 'slab']),
  monthlyRate: z.coerce.number().optional(),
  minBillingMonths: z.coerce.number().int().nonnegative("Must be a non-negative number.").optional(),
  insuranceRate: z.coerce.number().nonnegative("Must be a non-negative number.").optional(),
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


export function EditCommodityDialog({ commodity, children }: { commodity: Commodity, children: React.ReactNode }) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const firestore = useFirestore();

  const [name, setName] = useState('');
  const [billingType, setBillingType] = useState<'monthly' | 'slab'>('slab');
  const [monthlyRate, setMonthlyRate] = useState<number | ''>('');
  const [minBillingMonths, setMinBillingMonths] = useState<number | ''>('');
  const [insuranceRate, setInsuranceRate] = useState<number | ''>('');
  const [rate6Months, setRate6Months] = useState<number | ''>('');
  const [rate1Year, setRate1Year] = useState<number | ''>('');

  useEffect(() => {
      if (isOpen) {
          setName(commodity.name);
          setBillingType(commodity.billingType || 'slab');
          setMonthlyRate(commodity.monthlyRate ?? '');
          setMinBillingMonths(commodity.minBillingMonths ?? '');
          setInsuranceRate(commodity.insuranceRate ?? '');
          setRate6Months(commodity.rate6Months ?? '');
          setRate1Year(commodity.rate1Year ?? '');
      }
  }, [isOpen, commodity]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestore) {
      toast({ title: 'Error', description: 'Firestore not available.', variant: 'destructive' });
      return;
    }

    const dataToValidate = {
        name,
        billingType,
        monthlyRate: monthlyRate === '' ? undefined : Number(monthlyRate),
        minBillingMonths: minBillingMonths === '' ? undefined : Number(minBillingMonths),
        insuranceRate: insuranceRate === '' ? undefined : Number(insuranceRate),
        rate6Months: rate6Months === '' ? undefined : Number(rate6Months),
        rate1Year: rate1Year === '' ? undefined : Number(rate1Year),
    };

    const result = CommoditySchema.safeParse(dataToValidate);

    if (!result.success) {
      const firstError = Object.values(result.error.flatten().fieldErrors)[0]?.[0];
      toast({
        title: "Validation Error",
        description: firstError || "Please check your input.",
        variant: "destructive",
      });
      return;
    }

    startTransition(async () => {
      try {
        const updateData: Partial<Commodity> = { ...result.data };
        if (result.data.billingType === 'monthly') {
            updateData.rate6Months = undefined;
            updateData.rate1Year = undefined;
        } else {
            updateData.monthlyRate = undefined;
            updateData.minBillingMonths = undefined;
            updateData.insuranceRate = undefined;
        }

        await updateCommodity(firestore, commodity.id, updateData);
        toast({ title: 'Success', description: 'Commodity updated successfully.' });
        setIsOpen(false);
      } catch (error) {
        console.error(error);
        toast({ title: 'Error', description: 'Failed to update commodity.', variant: 'destructive' });
      }
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>Edit Commodity</DialogTitle>
              <DialogDescription>
                Update the details for {commodity.name}.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                  <Label htmlFor="edit-name">Commodity Name</Label>
                  <Input id="edit-name" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>

              <div className="space-y-3">
                  <Label>Billing Structure</Label>
                  <RadioGroup
                      value={billingType}
                      onValueChange={(value: 'monthly' | 'slab') => setBillingType(value)}
                      className="flex space-x-4"
                  >
                      <div className="flex items-center space-x-2 space-y-0">
                          <RadioGroupItem value="slab" id="edit-slab" />
                          <Label htmlFor="edit-slab" className="font-normal">Slab Rate</Label>
                      </div>
                      <div className="flex items-center space-x-2 space-y-0">
                          <RadioGroupItem value="monthly" id="edit-monthly" />
                          <Label htmlFor="edit-monthly" className="font-normal">Monthly Rate</Label>
                      </div>
                  </RadioGroup>
              </div>

              {billingType === 'monthly' && (
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="edit-monthlyRate">Monthly Rate</Label>
                        <Input id="edit-monthlyRate" type="number" step="0.01" value={monthlyRate} onChange={(e) => setMonthlyRate(e.target.value === '' ? '' : Number(e.target.value))} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="edit-minBillingMonths">Min. Months</Label>
                        <Input id="edit-minBillingMonths" type="number" placeholder="e.g. 3" value={minBillingMonths} onChange={(e) => setMinBillingMonths(e.target.value === '' ? '' : Number(e.target.value))} />
                    </div>
                    <div className="space-y-2 col-span-2">
                        <Label htmlFor="edit-insuranceRate">Yearly Insurance Rate</Label>
                        <Input id="edit-insuranceRate" type="number" step="0.01" placeholder="0.00" value={insuranceRate} onChange={(e) => setInsuranceRate(e.target.value === '' ? '' : Number(e.target.value))} />
                    </div>
                </div>
              )}

              {billingType === 'slab' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-rate6Months">6-Month Rate</Label>
                    <Input id="edit-rate6Months" type="number" step="0.01" value={rate6Months} onChange={(e) => setRate6Months(e.target.value === '' ? '' : Number(e.target.value))} />
                  </div>
                   <div className="space-y-2">
                    <Label htmlFor="edit-rate1Year">1-Year Rate</Label>
                    <Input id="edit-rate1Year" type="number" step="0.01" value={rate1Year} onChange={(e) => setRate1Year(e.target.value === '' ? '' : Number(e.target.value))} />
                  </div>
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
                  'Save Changes'
                )}
              </Button>
            </DialogFooter>
          </form>
      </DialogContent>
    </Dialog>
  );
}
