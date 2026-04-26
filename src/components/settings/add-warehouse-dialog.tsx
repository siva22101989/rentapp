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
import { z } from 'zod';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import { cleanForFirestore } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

const WarehouseSchema = z.object({
  name: z.string().min(3, 'Warehouse name is required.'),
  ownerName: z.string().min(2, 'Owner name is required.'),
  ownerEmail: z.string().email('A valid owner email is required.'),
  yearlyAmount: z.coerce.number().nonnegative('Yearly amount must be non-negative.'),
  subscriptionStatus: z.enum(['active', 'trial', 'expired', 'suspended']).default('trial'),
  trialMonths: z.coerce.number().int().nonnegative('Trial months must be a non-negative integer.').optional(),
});

type WarehouseFormData = z.infer<typeof WarehouseSchema>;

export function AddWarehouseDialog() {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const firestore = useFirestore();

  const initialFormState = {
    name: '',
    ownerName: '',
    ownerEmail: '',
    yearlyAmount: undefined,
    subscriptionStatus: 'trial' as const,
    trialMonths: 1,
  };

  const [formData, setFormData] = useState<Partial<WarehouseFormData>>(initialFormState);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      setFormData(initialFormState);
      setErrors({});
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' && value !== '' ? Number(value) : value,
    }));
  };

  const handleSelectChange = (name: keyof WarehouseFormData) => (value: string) => {
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrors({});

    const validatedFields = WarehouseSchema.safeParse(formData);

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
        const warehousesCollection = collection(firestore, 'managedWarehouses');
        const q = query(warehousesCollection, where('ownerEmail', '==', data.ownerEmail.toLowerCase()));
        const existingOwnerSnap = await getDocs(q);

        if (!existingOwnerSnap.empty) {
          toast({
            title: 'Owner Exists',
            description: 'This email is already assigned as an owner to another warehouse.',
            variant: 'destructive',
          });
          return;
        }

        await addDoc(collection(firestore, 'managedWarehouses'), cleanForFirestore({
          ...data,
          ownerEmail: data.ownerEmail.toLowerCase(),
          createdAt: new Date(),
        }));

        toast({ title: 'Success', description: 'New warehouse subscription created. The owner can now sign in.' });
        handleOpenChange(false);
      } catch (error) {
        console.error(error);
        toast({ title: 'Error', description: 'Failed to add warehouse.', variant: 'destructive' });
      }
    });
  };
  
  const renderError = (field: string) => errors[field] && <p className="text-sm font-medium text-destructive mt-1">{errors[field]}</p>;

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <PlusCircle className="mr-2" />
          Add Warehouse
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Onboard New Warehouse</DialogTitle>
            <DialogDescription>
              Create a new warehouse subscription record. The owner will be able to log in with the specified email.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto pr-4">
            <div className="space-y-1">
              <Label htmlFor="name">Warehouse Name</Label>
              <Input id="name" name="name" value={formData.name || ''} onChange={handleChange} placeholder="e.g., National Cold Storage" />
              {renderError('name')}
            </div>
            <div className="space-y-1">
              <Label htmlFor="ownerName">Owner's Full Name</Label>
              <Input id="ownerName" name="ownerName" value={formData.ownerName || ''} onChange={handleChange} placeholder="e.g., Jane Doe" />
              {renderError('ownerName')}
            </div>
            <div className="space-y-1">
              <Label htmlFor="ownerEmail">Owner's Email (for login)</Label>
              <Input id="ownerEmail" name="ownerEmail" type="email" value={formData.ownerEmail || ''} onChange={handleChange} placeholder="owner@example.com" />
              {renderError('ownerEmail')}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="yearlyAmount">Yearly Amount</Label>
                <Input id="yearlyAmount" name="yearlyAmount" type="number" value={formData.yearlyAmount || ''} onChange={handleChange} placeholder="0.00" />
                {renderError('yearlyAmount')}
              </div>
              <div className="space-y-1">
                <Label htmlFor="subscriptionStatus">Status</Label>
                <Select name="subscriptionStatus" onValueChange={handleSelectChange('subscriptionStatus')} value={formData.subscriptionStatus}>
                    <SelectTrigger><SelectValue/></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="trial">Trial</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="expired">Expired</SelectItem>
                      <SelectItem value="suspended">Suspended</SelectItem>
                    </SelectContent>
                </Select>
                {renderError('subscriptionStatus')}
              </div>
            </div>
            <div className="space-y-1">
                <Label htmlFor="trialMonths">Trial Duration (Months)</Label>
                <Input id="trialMonths" name="trialMonths" type="number" value={formData.trialMonths || ''} onChange={handleChange} placeholder="e.g. 1" />
                {renderError('trialMonths')}
            </div>
          </div>
          <DialogFooter className="pt-4">
            <DialogClose asChild><Button variant="outline" type="button">Cancel</Button></DialogClose>
            <Button type="submit" disabled={isPending}>
              {isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : 'Add Subscription'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}