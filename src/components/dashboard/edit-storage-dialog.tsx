
'use client';

import { useEffect, useState } from 'react';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Loader2 } from 'lucide-react';
import { updateStorageRecordAction, type InflowFormState } from '@/lib/actions';
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
import type { Customer, StorageRecord } from '@/lib/definitions';
import { format } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { toDate } from '@/lib/utils';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Saving...
        </>
      ) : (
        'Save Changes'
      )}
    </Button>
  );
}

export function EditStorageDialog({ record, customers, children }: { record: StorageRecord, customers: Customer[], children: React.ReactNode }) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  
  const initialState: InflowFormState = { message: '', success: false };
  const updateAction = updateStorageRecordAction.bind(null, record.id);
  const [state, formAction] = useActionState(updateAction, initialState);

  useEffect(() => {
    if (!state.message) return;
    if (state.success) {
      toast({ title: 'Success', description: state.message });
      setIsOpen(false);
    } else {
      toast({
        title: 'Error',
        description: state.message,
        variant: 'destructive',
      });
    }
  }, [state, toast]);
  
  const startDate = record.storageStartDate ? toDate(record.storageStartDate) : null;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <form action={formAction}>
          <DialogHeader>
            <DialogTitle>Edit Storage Record</DialogTitle>
            <DialogDescription>
              Adjust the details for record {record.id}. Payment history cannot be edited here.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="customerId" className="text-right">
                Customer
              </Label>
              <div className="col-span-3">
                <Select name="customerId" defaultValue={record.customerId} required>
                    <SelectTrigger id="customerId">
                        <SelectValue placeholder="Select a customer" />
                    </SelectTrigger>
                    <SelectContent>
                        {customers.map(customer => (
                            <SelectItem key={customer.id} value={customer.id}>
                                {customer.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="commodityDescription" className="text-right">
                Commodity
              </Label>
              <Input 
                id="commodityDescription" 
                name="commodityDescription"
                defaultValue={record.commodityDescription}
                className="col-span-3"
                required
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="location" className="text-right">
                Location
              </Label>
              <Input 
                id="location" 
                name="location"
                defaultValue={record.location}
                className="col-span-3"
                required
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="bagsStored" className="text-right">
                Bags In
              </Label>
              <Input 
                id="bagsStored" 
                name="bagsStored" 
                type="number"
                defaultValue={record.bagsIn} 
                className="col-span-3" 
                required 
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="hamaliPayable" className="text-right">
                Hamali Payable
              </Label>
              <Input 
                id="hamaliPayable"
                name="hamaliPayable" 
                type="number"
                step="0.01"
                defaultValue={record.hamaliPayable} 
                className="col-span-3" 
                required 
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="storageStartDate" className="text-right">
                Start Date
              </Label>
              <Input 
                id="storageStartDate" 
                name="storageStartDate" 
                type="date"
                defaultValue={startDate ? format(startDate, 'yyyy-MM-dd') : ''}
                className="col-span-3" 
                required 
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <SubmitButton />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
