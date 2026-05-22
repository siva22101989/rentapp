
'use client';

import { useState, useTransition, useMemo } from 'react';
import { Loader2, MessageSquareWarning } from 'lucide-react';
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
import type { StorageRecord, Customer, UnloadingRecord, WarehouseInfo } from '@/lib/definitions';
import { formatCurrency, toDate } from '@/lib/utils';
import { useFirestore } from '@/firebase/provider';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../ui/form';
import { Combobox } from '../ui/combobox';
import { Separator } from '../ui/separator';
import { useDoc } from '@/firebase/firestore/use-doc';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { useAppUser } from '@/firebase/auth/use-user';
import { doc } from 'firebase/firestore';
import { sendSms } from '@/lib/sms';
import { Checkbox } from '../ui/checkbox';
import { calculateFinalRent } from '@/lib/billing';

const ReminderSmsSchema = z.object({
  customerId: z.string().min(1, 'Please select a customer.'),
});

type ReminderSmsFormData = z.infer<typeof ReminderSmsSchema>;

type SendReminderSmsDialogProps = {
    customers: Customer[];
    storageRecords: StorageRecord[];
    unloadingRecords: UnloadingRecord[];
};

export function SendReminderSmsDialog({ customers, storageRecords, unloadingRecords }: SendReminderSmsDialogProps) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const firestore = useFirestore();
  const appUser = useAppUser();
  const [showAllCustomers, setShowAllCustomers] = useState(false);

  const warehouseInfoRef = useMemoFirebase(
    () => (firestore && appUser?.warehouseId ? doc(firestore, 'warehouses', appUser.warehouseId) : null),
    [firestore, appUser]
  );
  const { data: warehouseInfo } = useDoc<WarehouseInfo>(warehouseInfoRef);

  const form = useForm<ReminderSmsFormData>({
    resolver: zodResolver(ReminderSmsSchema),
    defaultValues: { customerId: '' },
  });
  
  const selectedCustomerId = form.watch('customerId');
  const selectedCustomer = useMemo(() => customers.find(c => c.id === selectedCustomerId), [customers, selectedCustomerId]);

  const customerDuesMap = useMemo(() => {
    const duesMap: Record<string, { hamali: number, rent: number, total: number }> = {};
    const today = new Date();

    storageRecords.forEach(rec => {
        if (!duesMap[rec.customerId]) duesMap[rec.customerId] = { hamali: 0, rent: 0, total: 0 };
        
        const hLiability = rec.hamaliPayable || 0;
        const hPaid = (rec.payments || []).filter(p => p.type === 'hamali' || p.type === 'unloading').reduce((acc, p) => acc + p.amount, 0);
        
        let accruedRent = 0;
        if (rec.bagsStored > 0 && !rec.storageEndDate) {
            const { rent } = calculateFinalRent({ ...rec, storageStartDate: toDate(rec.storageStartDate) }, today, rec.bagsStored);
            accruedRent = rent;
        }
        const rLiability = (rec.totalRentBilled || 0) + (rec.khataAmount || 0) + accruedRent;
        const rPaid = (rec.payments || []).filter(p => p.type === 'rent' || p.type === 'other' || !p.type || p.type === 'discount').reduce((acc, p) => acc + p.amount, 0);

        const hDue = Math.max(0, hLiability - hPaid);
        const rDue = Math.max(0, rLiability - rPaid);

        duesMap[rec.customerId].hamali += hDue;
        duesMap[rec.customerId].rent += rDue;
        duesMap[rec.customerId].total += (hDue + rDue);
    });

    unloadingRecords.forEach(rec => {
        if (!duesMap[rec.customerId]) duesMap[rec.customerId] = { hamali: 0, rent: 0, total: 0 };
        const remainingBags = Math.max(0, (rec.bagsUnloaded || 0) - (rec.bagsSentToDrying || 0));
        const totalPaid = (rec.payments || []).reduce((acc, p) => acc + p.amount, 0);
        const hLiability = remainingBags * (rec.hamaliPerBag || 0);
        const hDue = Math.max(0, hLiability - totalPaid);
        
        duesMap[rec.customerId].hamali += hDue;
        duesMap[rec.customerId].total += hDue;
    });

    return duesMap;
  }, [storageRecords, unloadingRecords]);

  const customersWithDues = useMemo(() => {
    return customers.filter(c => (customerDuesMap[c.id]?.total || 0) > 0.5);
  }, [customers, customerDuesMap]);

  const customerOptions = useMemo(() => {
    const list = showAllCustomers ? customers : customersWithDues;
    return list.map(c => ({ value: c.id, label: c.name }));
  }, [showAllCustomers, customers, customersWithDues]);

  const handleShowAllToggle = (checked: boolean) => {
    setShowAllCustomers(checked);
    if (!checked && selectedCustomer && (customerDuesMap[selectedCustomer.id]?.total || 0) <= 0.5) {
        form.setValue('customerId', '');
    }
  };

  const { totalDue, totalHamaliDue, totalRentDue } = useMemo(() => {
    if (!selectedCustomerId) return { totalDue: 0, totalHamaliDue: 0, totalRentDue: 0 };
    const dues = customerDuesMap[selectedCustomerId];
    return {
        totalHamaliDue: dues?.hamali || 0,
        totalRentDue: dues?.rent || 0,
        totalDue: dues?.total || 0,
    };
  }, [selectedCustomerId, customerDuesMap]);

  const onSubmit = (data: ReminderSmsFormData) => {
    if (!firestore || !warehouseInfo?.textbeeApiKey || !selectedCustomer?.phone) {
      toast({ title: 'Error', description: 'SMS settings or customer phone number are missing.', variant: 'destructive' });
      return;
    }
    if (totalDue <= 0) {
      toast({ title: 'No Dues', description: 'This customer has no pending dues to remind them about.', variant: 'default' });
      return;
    }

    startTransition(async () => {
        const defaultTemplate = 'Dear {customerName}, this is a reminder that you have an outstanding balance. Rent Due: {rentDue}, Hamali Due: {hamaliDue}, Total Due: {totalDue}. Please pay at your earliest convenience. Thank you. - {warehouseName}';
        const template = warehouseInfo?.smsPendingDuesTemplate || defaultTemplate;
        
        const message = template
            .replace('{customerName}', selectedCustomer.name)
            .replace('{rentDue}', formatCurrency(totalRentDue))
            .replace('{hamaliDue}', formatCurrency(totalHamaliDue))
            .replace('{totalDue}', formatCurrency(totalDue))
            .replace('{warehouseName}', warehouseInfo?.name || 'GrainDost');

        const result = await sendSms({
            apiKey: warehouseInfo.textbeeApiKey,
            deviceId: warehouseInfo.textbeeDeviceId,
            to: selectedCustomer.phone,
            message,
        });

        if (result.success) {
            toast({ title: 'Reminder Sent!', description: `SMS sent to ${selectedCustomer.name}.` });
            setIsOpen(false);
            form.reset();
        } else {
            toast({ title: 'SMS Failed', description: result.message, variant: 'destructive' });
        }
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
         <Button variant="outline">
            <MessageSquareWarning className="mr-2" />
            Send Dues Reminder
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
            <DialogHeader>
                <DialogTitle>Send Pending Dues Reminder</DialogTitle>
                <DialogDescription>
                  Select a customer to send them an SMS reminder about their total outstanding balance.
                </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
                <FormField
                    control={form.control}
                    name="customerId"
                    render={({ field }) => (
                        <FormItem className="flex flex-col">
                            <FormLabel>Customer (Only those with Dues)</FormLabel>
                            <Combobox
                                options={customerOptions}
                                value={field.value}
                                onChange={field.onChange}
                                placeholder="Select a customer..."
                                searchPlaceholder="Search customers..."
                                emptyPlaceholder="No customer found."
                                modal={true}
                            />
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <div className="flex items-center space-x-2">
                    <Checkbox
                        id="showAllCustomers"
                        checked={showAllCustomers}
                        onCheckedChange={(checked) => handleShowAllToggle(Boolean(checked))}
                    />
                    <label
                        htmlFor="showAllCustomers"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                        Show all customers
                    </label>
                </div>


                {selectedCustomerId && (
                <>
                <Separator />
                 <div className="p-4 rounded-lg bg-secondary border">
                    <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Total Hamali Pending</span>
                        <span className="font-medium">{formatCurrency(totalHamaliDue)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Total Rent Pending</span>
                        <span className="font-medium">{formatCurrency(totalRentDue)}</span>
                    </div>
                    <div className="flex justify-between text-sm font-bold border-t pt-2 mt-2">
                        <span className="text-foreground">Total Due</span>
                        <span className="text-destructive">{formatCurrency(totalDue)}</span>
                    </div>
                </div>
                </>
                )}
            </div>
            <DialogFooter>
                <DialogClose asChild><Button variant="outline" type="button">Cancel</Button></DialogClose>
                <Button type="submit" disabled={isPending || !selectedCustomerId || totalDue <= 0}>
                {isPending ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending...</>
                ) : (
                    'Send Reminder'
                )}
                </Button>
            </DialogFooter>
            </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
