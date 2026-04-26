
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
import { z } from 'zod';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
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

  const [formData, setFormData] = useState<Partial<WarehouseEditFormData>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen) {
      setFormData({
        ...warehouse,
        trialMonths: warehouse.trialMonths || 0,
      });
      setErrors({});
    }
  }, [isOpen, warehouse]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' && value !== '' ? Number(value) : value,
    }));
  };

  const handleSelectChange = (name: keyof WarehouseEditFormData) => (value: string) => {
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrors({});

    const validatedFields = WarehouseEditSchema.safeParse(formData);
    if (!validatedFields.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of validatedFields.error.issues) {
        const path = issue.path[0];
        if (typeof path === 'string') {
          fieldErrors[path] = issue.message;
        }
      }
      setErrors(fieldErrors);
      return;
    }

    if (!firestore) {
      toast({ title: 'Error', description: 'Firestore not available.', variant: 'destructive' });
      return;
    }
    
    const data = validatedFields.data;

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

  const renderError = (field: string) => errors[field] && <p className="text-sm font-medium text-destructive mt-1">{errors[field]}</p>;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit Warehouse Subscription</DialogTitle>
            <DialogDescription>
              Update details for {warehouse.name}.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto pr-4">
              <div className="space-y-1">
                  <Label htmlFor="name">Warehouse Name</Label>
                  <Input id="name" name="name" value={formData.name || ''} onChange={handleChange} />
                  {renderError('name')}
              </div>
              <div className="space-y-1">
                  <Label htmlFor="ownerName">Owner Name</Label>
                  <Input id="ownerName" name="ownerName" value={formData.ownerName || ''} onChange={handleChange} />
                  {renderError('ownerName')}
              </div>
              <div className="space-y-1">
                  <Label htmlFor="ownerEmail">Owner Email</Label>
                  <Input id="ownerEmail" name="ownerEmail" type="email" value={formData.ownerEmail || ''} onChange={handleChange} />
                  {renderError('ownerEmail')}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="yearlyAmount">Yearly Amount</Label>
                  <Input id="yearlyAmount" name="yearlyAmount" type="number" value={formData.yearlyAmount ?? ''} onChange={handleChange} />
                  {renderError('yearlyAmount')}
                </div>
                <div className="space-y-1">
                  <Label htmlFor="trialMonths">Trial (Months)</Label>
                  <Input id="trialMonths" name="trialMonths" type="number" value={formData.trialMonths ?? ''} onChange={handleChange} />
                  {renderError('trialMonths')}
                </div>
              </div>
               <div className="space-y-1">
                <Label htmlFor="subscriptionStatus">Subscription Status</Label>
                <Select name="subscriptionStatus" onValueChange={handleSelectChange('subscriptionStatus')} value={formData.subscriptionStatus}>
                    <SelectTrigger><SelectValue/></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="trial">Trial</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="suspended">Suspended</SelectItem>
                      <SelectItem value="expired">Expired</SelectItem>
                    </SelectContent>
                </Select>
                {renderError('subscriptionStatus')}
              </div>
          </div>
          <DialogFooter className="pt-4">
            <DialogClose asChild><Button variant="outline" type="button">Cancel</Button></DialogClose>
            <Button type="submit" disabled={isPending}>
              {isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
