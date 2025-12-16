
'use client';

import { useEffect, useState } from 'react';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Loader2, PlusCircle } from 'lucide-react';
import { addCustomer, type FormState } from '@/lib/actions';
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
import { useUser } from '@/firebase';

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
        'Save Customer'
      )}
    </Button>
  );
}

export function AddCustomerDialog() {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  
  const initialState: FormState = { message: '', success: false };
  const [state, formAction] = useActionState(addCustomer, initialState);

  useEffect(() => {
    if (!state.message) return;
    
    if (state.success) {
      toast({ 
        title: 'Success', 
        description: state.message 
      });
      setIsOpen(false); 
    } else {
      toast({
        title: 'Error',
        description: state.message,
        variant: 'destructive',
      });
    }
  }, [state, toast]);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button>
          <PlusCircle className="mr-2" />
          Add Customer
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <form action={formAction}>
          <DialogHeader>
            <DialogTitle>Add New Customer</DialogTitle>
            <DialogDescription>
              Enter the details for the new customer. Click save when you&apos;re done.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                Name
              </Label>
              <Input id="name" name="name" className="col-span-3" required />
            </div>
             <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="fatherName" className="text-right">
                Father's Name
              </Label>
              <Input id="fatherName" name="fatherName" className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="village" className="text-right">
                Village
              </Label>
              <Input id="village" name="village" className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="address" className="text-right">
                Address
              </Label>
              <Input id="address" name="address" className="col-span-3" required />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="phone" className="text-right">
                Phone
              </Label>
              <Input id="phone" name="phone" className="col-span-3" required />
            </div>
             <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="email" className="text-right">
                Email
              </Label>
              <Input id="email" name="email" type="text" className="col-span-3" />
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
