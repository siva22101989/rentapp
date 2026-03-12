
'use client';

import { useEffect, useState, useTransition, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useFirestore } from '@/firebase/provider';
import { doc, updateDoc, arrayUnion, type Firestore, Timestamp, getDoc, writeBatch } from 'firebase/firestore';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { Customer, StorageRecord, Payment, Outflow } from '@/lib/definitions';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { Separator } from '../ui/separator';
import { calculateFinalRent } from '@/lib/billing';
import { format } from 'date-fns';
import { toDate, cleanForFirestore, formatCurrency } from '@/lib/utils';
import { Combobox } from '../ui/combobox';

function SubmitButton({ isPending }: { isPending: boolean }) {
    return (
      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Processing...
          </>
        ) : (
          'Process Withdrawal and Generate Bill'
        )}
      </Button>
    );
}

export function OutflowForm({ records, customers }: { records: StorageRecord[], customers: Customer[] }) {
    const { toast } = useToast();
    const router = useRouter();
    const firestore = useFirestore();
    const [isPending, startTransition] = useTransition();
    
    const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
    const [withdrawals, setWithdrawals] = useState<Record<string, number | ''>>({});
    
    const [amountPaidNow, setAmountPaidNow] = useState<number | ''>('');
    const [discount, setDiscount] = useState<number | ''>('');
    const [withdrawalDate, setWithdrawalDate] = useState(new Date());
    
    const [totalRent, setTotalRent] = useState(0);
    const [totalPendingHamali, setTotalPendingHamali] = useState(0);
    const [totalBags, setTotalBags] = useState(0);

    const customerOptions = customers.map(c => ({ value: c.id, label: c.name }));

    const filteredRecords = useMemo(() => 
        selectedCustomerId ? records.filter(r => r.customerId === selectedCustomerId) : [],
        [records, selectedCustomerId]
    );

    const withdrawalEntries = useMemo(() => 
        Object.entries(withdrawals).filter(([, bags]) => Number(bags) > 0),
        [withdrawals]
    );

    const isMultiLotWithdrawal = useMemo(() => withdrawalEntries.length > 1, [withdrawalEntries]);

    const totalPayable = totalRent + totalPendingHamali - (Number(discount) || 0);

    useEffect(() => {
        setWithdrawals({});
    }, [selectedCustomerId]);

    useEffect(() => {
        let runningRent = 0;
        let runningHamali = 0;
        let runningBags = 0;
        const hamaliCalculatedRecords = new Set<string>();

        const currentWithdrawalEntries = Object.entries(withdrawals).filter(([, bags]) => Number(bags) > 0);

        currentWithdrawalEntries.forEach(([recordId, bags]) => {
            const bagsToWithdraw = Number(bags);
            const record = records.find(r => r.id === recordId);
            if (record) {
                const { rent } = calculateFinalRent({ ...record, storageStartDate: toDate(record.storageStartDate) }, withdrawalDate, bagsToWithdraw);
                runningRent += rent;
                
                if (!hamaliCalculatedRecords.has(recordId)) {
                    const hamaliPaid = (record.payments || []).filter(p => p.type === 'hamali').reduce((acc, p) => acc + p.amount, 0);
                    const pending = (record.hamaliPayable || 0) - hamaliPaid;
                    runningHamali += pending > 0 ? pending : 0;
                    hamaliCalculatedRecords.add(recordId);
                }
                runningBags += bagsToWithdraw;
            }
        });
        
        setTotalRent(runningRent);
        setTotalPendingHamali(runningHamali);
        setTotalBags(runningBags);
    }, [withdrawals, withdrawalDate, records]);
    
    const handleCustomerChange = (customerId: string) => {
        setSelectedCustomerId(customerId);
        setWithdrawals({});
        setAmountPaidNow('');
        setDiscount('');
    }

    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        // e.target.value will be a string like "2024-07-26"
        // Appending T00:00:00 makes it parse as local time midnight, avoiding timezone bugs
        const dateValue = new Date(e.target.value + 'T00:00:00');
        setWithdrawalDate(dateValue);
    }
    
    const handleWithdrawalChange = (recordId: string, value: string, maxBags: number) => {
        const numValue = value === '' ? '' : Number(value);
        if (numValue === '' || (numValue >= 0 && numValue <= maxBags && !isNaN(numValue))) {
            setWithdrawals(prev => ({
                ...prev,
                [recordId]: numValue,
            }));
        }
    };
    
    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        
        if (!firestore || withdrawalEntries.length === 0) {
            toast({ title: 'Error', description: 'Please enter a withdrawal amount for at least one record.', variant: 'destructive' });
            return;
        }

        startTransition(async () => {
            try {
                const batch = writeBatch(firestore);
                const discountAmount = !isMultiLotWithdrawal ? (Number(discount) || 0) : 0;
                
                for (const [recordId, bags] of withdrawalEntries) {
                    const bagsToWithdraw = Number(bags);
                    const record = records.find(r => r.id === recordId);
                    if (!record || bagsToWithdraw <= 0) continue;

                    const { rent: rentForThisWithdrawal } = calculateFinalRent({ ...record, storageStartDate: toDate(record.storageStartDate) }, withdrawalDate, bagsToWithdraw);
                    
                    const newOutflow: Partial<Outflow> = {
                        date: withdrawalDate,
                        bagsWithdrawn: bagsToWithdraw,
                        rentBilled: rentForThisWithdrawal,
                        discount: discountAmount,
                    };

                    const newBagsOut = (record.bagsOut || 0) + bagsToWithdraw;
                    const newBagsStored = record.bagsStored - bagsToWithdraw;

                    const updateData: any = {
                        bagsOut: newBagsOut,
                        bagsStored: newBagsStored,
                        totalRentBilled: (record.totalRentBilled || 0) + rentForThisWithdrawal,
                        outflows: arrayUnion(cleanForFirestore(newOutflow)),
                    };

                    if (newBagsStored <= 0) {
                        updateData.storageEndDate = Timestamp.fromDate(withdrawalDate);
                        updateData.billingCycle = 'Completed';
                    }
                    
                    const paidNow = Number(amountPaidNow) || 0;
                    if (!isMultiLotWithdrawal && paidNow > 0) {
                        const newPayment: Partial<Payment> = { amount: paidNow, date: withdrawalDate, type: 'rent' };
                        updateData.payments = arrayUnion(cleanForFirestore(newPayment));
                    }
                    
                    const recordRef = doc(firestore, 'storageRecords', recordId);
                    batch.update(recordRef, updateData);
                }
                
                await batch.commit();

                if (isMultiLotWithdrawal) {
                    toast({ title: 'Success', description: `${withdrawalEntries.length} records processed. You can make a bulk payment from the Pending Payments page.`, duration: 7000 });
                    router.push(`/reports?report=customer-statement&customerId=${selectedCustomerId}`);
                } else {
                    const [recordId, bags] = withdrawalEntries[0];
                    const record = records.find(r => r.id === recordId);
                    if (!record) {
                        toast({ title: 'Error', description: 'Could not find the processed record after submission.', variant: 'destructive' });
                        return;
                    }
                    const bagsToWithdraw = Number(bags);
                    const { rent: rentForThisWithdrawal } = calculateFinalRent({ ...record, storageStartDate: toDate(record.storageStartDate) }, withdrawalDate, bagsToWithdraw);
                    
                    toast({ title: 'Success', description: 'Withdrawal processed successfully.' });
                    router.push(`/outflow/receipt/${recordId}?withdrawn=${bagsToWithdraw}&rent=${rentForThisWithdrawal}&paidNow=${Number(amountPaidNow) || 0}&discount=${discountAmount}`);
                }

            } catch (error) {
                console.error("Outflow failed:", error);
                toast({ title: 'Error', description: 'Failed to process outflow.', variant: 'destructive' });
            }
        });
    }

  return (
    <div className="flex justify-center">
        <form onSubmit={handleSubmit} className="w-full max-w-3xl">
            <Card>
                <CardHeader>
                <CardTitle>Create Withdrawal</CardTitle>
                <CardDescription>Select a customer, then enter the number of bags to withdraw from one or more records.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="customerId">Customer</Label>
                        <Combobox
                            options={customerOptions}
                            value={selectedCustomerId}
                            onChange={handleCustomerChange}
                            placeholder="Select a customer..."
                            searchPlaceholder="Search customers..."
                            emptyPlaceholder="No customer found."
                        />
                    </div>

                    {selectedCustomerId && (
                        <div className="border rounded-md">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Bill No</TableHead>
                                        <TableHead>Commodity</TableHead>
                                        <TableHead>Lot</TableHead>
                                        <TableHead className="text-right">Bags in Stock</TableHead>
                                        <TableHead className="w-[150px]">Bags to Withdraw</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredRecords.length > 0 ? filteredRecords.map(record => (
                                        <TableRow key={record.id} data-state={Number(withdrawals[record.id] || 0) > 0 ? "selected" : ""}>
                                            <TableCell>{record.id}</TableCell>
                                            <TableCell>{record.commodityDescription}</TableCell>
                                            <TableCell>{record.location}</TableCell>
                                            <TableCell className="text-right font-mono">{record.bagsStored}</TableCell>
                                            <TableCell>
                                                <Input
                                                    type="number"
                                                    placeholder="0"
                                                    min="0"
                                                    max={record.bagsStored}
                                                    value={withdrawals[record.id] || ''}
                                                    onChange={(e) => handleWithdrawalChange(record.id, e.target.value, record.bagsStored)}
                                                    className="text-right"
                                                />
                                            </TableCell>
                                        </TableRow>
                                    )) : (
                                        <TableRow>
                                            <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">
                                                No active records for this customer.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    )}


                    {withdrawalEntries.length > 0 && (
                        <>
                            <div className="space-y-2">
                                <Label htmlFor="withdrawalDate">Withdrawal Date</Label>
                                <Input 
                                    id="withdrawalDate" 
                                    name="withdrawalDate" 
                                    type="date"
                                    value={format(withdrawalDate, 'yyyy-MM-dd')}
                                    required
                                    onChange={handleDateChange}
                                    />
                            </div>
                            <Separator />
                            <div className="space-y-4">
                                <h4 className="font-medium">Final Billing Summary</h4>
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between items-center">
                                        <span className="text-muted-foreground">Total Bags to Withdraw</span>
                                        <span className="font-mono font-bold">{totalBags}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-muted-foreground">Calculated Rent Due</span>
                                        <span className="font-mono">{formatCurrency(totalRent)}</span>
                                    </div>
                                     <div className="flex justify-between items-center">
                                        <span className="text-muted-foreground">Pending Hamali Charges</span>
                                        <span className="font-mono">{formatCurrency(totalPendingHamali)}</span>
                                    </div>
                                </div>
                            </div>

                            <Separator/>

                            <div className="space-y-4 pt-2">
                                <div className="space-y-2">
                                    <Label htmlFor="discount">Discount Amount</Label>
                                    <Input
                                        id="discount"
                                        name="discount"
                                        type="number"
                                        placeholder="0.00"
                                        step="0.01"
                                        value={discount}
                                        onChange={e => setDiscount(e.target.value === '' ? '' : Number(e.target.value))}
                                        disabled={isMultiLotWithdrawal}
                                    />
                                </div>

                                <div className="flex justify-between items-center font-semibold text-lg">
                                    <span className="text-foreground">Total Payable</span>
                                    <span className="font-mono">{formatCurrency(totalPayable)}</span>
                                </div>
                                
                                <div className="space-y-2">
                                    <Label htmlFor="amountPaidNow">Total Paid Now</Label>
                                    <Input
                                        id="amountPaidNow"
                                        name="amountPaidNow"
                                        type="number"
                                        placeholder="0.00"
                                        step="0.01"
                                        value={amountPaidNow}
                                        onChange={e => setAmountPaidNow(e.target.value === '' ? '' : Number(e.target.value))}
                                        max={totalPayable > 0 ? totalPayable.toFixed(2) : undefined}
                                        disabled={isMultiLotWithdrawal}
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        {isMultiLotWithdrawal ? "Payment can only be recorded for single-lot withdrawals. For bulk, use the Pending Payments page after." : "Enter amount paid by customer. Leave blank if unpaid."}
                                    </p>
                                </div>
                            </div>
                        </>
                    )}
                </CardContent>
                <CardFooter>
                    <SubmitButton isPending={isPending} />
                </CardFooter>
            </Card>
        </form>
    </div>
  );
}
