'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useFirestore } from '@/firebase/provider';
import { doc, updateDoc, arrayUnion, type Firestore, Timestamp, getDoc } from 'firebase/firestore';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
    const [selectedRecordId, setSelectedRecordId] = useState<string>('');
    const [bagsToWithdraw, setBagsToWithdraw] = useState<number | ''>('');
    const [amountPaidNow, setAmountPaidNow] = useState<number | ''>('');
    const [discount, setDiscount] = useState<number | ''>('');
    const [withdrawalDate, setWithdrawalDate] = useState(new Date());
    
    const [finalRent, setFinalRent] = useState(0);
    const [storageMonths, setStorageMonths] = useState(0);
    const [rentPerBag, setRentPerBag] = useState({ rentPerBag: 0 });
    const [hamaliPending, setHamaliPending] = useState(0);

    const customerOptions = customers.map(c => ({ value: c.id, label: c.name }));

    const filteredRecords = selectedCustomerId ? records.filter(r => r.customerId === selectedCustomerId) : [];
    const selectedRecord = records.find(r => r.id === selectedRecordId);
    const totalPayable = finalRent + hamaliPending - (Number(discount) || 0);

    useEffect(() => {
        if (selectedRecord) {
            const hamaliPaid = (selectedRecord.payments || [])
                .filter(p => p.type === 'hamali')
                .reduce((acc, p) => acc + p.amount, 0);

            const pending = selectedRecord.hamaliPayable - hamaliPaid;
            setHamaliPending(pending > 0 ? pending : 0);
            
            const safeRecord = {
                ...selectedRecord,
                storageStartDate: toDate(selectedRecord.storageStartDate)
            };

            const bags = Number(bagsToWithdraw) || 0;
            if (bags > 0) {
                const { rent, monthsStored, rentPerBag: rentPerBagCalc } = calculateFinalRent(safeRecord, withdrawalDate, bags);
                setFinalRent(rent);
                setStorageMonths(monthsStored);
                setRentPerBag({ rentPerBag: rentPerBagCalc });
            } else {
                setFinalRent(0);
                setStorageMonths(0);
                setRentPerBag({ rentPerBag: 0 });
            }
        } else {
            setFinalRent(0);
            setStorageMonths(0);
            setRentPerBag({ rentPerBag: 0 });
            setHamaliPending(0);
        }
    }, [selectedRecord, bagsToWithdraw, withdrawalDate]);
    
    const handleCustomerChange = (customerId: string) => {
        setSelectedCustomerId(customerId);
        setSelectedRecordId('');
        setBagsToWithdraw('');
        setAmountPaidNow('');
        setDiscount('');
        setFinalRent(0);
        setStorageMonths(0);
        setRentPerBag({ rentPerBag: 0 });
        setHamaliPending(0);
    }

    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const dateValue = e.target.valueAsDate ? new Date(e.target.valueAsDate.valueOf() + e.target.valueAsDate.getTimezoneOffset() * 60 * 1000) : new Date();
        setWithdrawalDate(dateValue);
    }
    
    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        
        if (!firestore || !selectedRecord) {
            toast({ title: 'Error', description: 'Please select a customer and a record.', variant: 'destructive' });
            return;
        }

        const bags = Number(bagsToWithdraw);
        if (bags <= 0) {
            toast({ title: 'Error', description: 'Bags to withdraw must be a positive number.', variant: 'destructive' });
            return;
        }

        if (bags > selectedRecord.bagsStored) {
            toast({ title: 'Error', description: `Cannot withdraw more than the stored amount of ${selectedRecord.bagsStored} bags.`, variant: 'destructive' });
            return;
        }

        startTransition(async () => {
            try {
                const recordRef = doc(firestore, 'storageRecords', selectedRecord.id);

                const newBagsOut = (selectedRecord.bagsOut || 0) + bags;
                const bagsRemaining = selectedRecord.bagsIn - newBagsOut;
                const isFinalWithdrawal = bagsRemaining <= 0;
                const discountAmount = Number(discount) || 0;

                const newOutflow: Partial<Outflow> = {
                    date: withdrawalDate,
                    bagsWithdrawn: bags,
                    rentBilled: finalRent,
                    discount: discountAmount,
                };

                const updateData: any = {
                    bagsStored: bagsRemaining,
                    bagsOut: newBagsOut,
                    totalRentBilled: (selectedRecord.totalRentBilled || 0) + finalRent,
                    outflows: arrayUnion(cleanForFirestore(newOutflow)),
                };
                
                if (isFinalWithdrawal) {
                    updateData.storageEndDate = Timestamp.fromDate(withdrawalDate);
                    updateData.billingCycle = 'Completed';
                }

                const paidNow = Number(amountPaidNow) || 0;
                if (paidNow > 0) {
                    const newPayment: Partial<Payment> = {
                        amount: paidNow,
                        date: withdrawalDate,
                        type: 'rent', // Assume final payment is for rent/total due
                    };
                    updateData.payments = arrayUnion(cleanForFirestore(newPayment));
                }

                await updateDoc(recordRef, updateData);

                // Poll to confirm data is written before redirecting
                let docIsReady = false;
                for (let i = 0; i < 10; i++) { // Poll for up to 3 seconds
                    const docSnap = await getDoc(recordRef);
                    if (docSnap.exists()) {
                        const data = docSnap.data() as StorageRecord;
                        // Check if the update is reflected
                        if (data.bagsStored === bagsRemaining && (!isFinalWithdrawal || data.storageEndDate)) {
                            docIsReady = true;
                            break;
                        }
                    }
                    await new Promise(resolve => setTimeout(resolve, 300));
                }

                toast({ title: 'Success', description: 'Withdrawal processed successfully.' });

                if (docIsReady) {
                    router.push(`/outflow/receipt/${selectedRecord.id}?withdrawn=${bags}&rent=${finalRent}&paidNow=${paidNow}&discount=${discountAmount}`);
                } else {
                    // Fallback if polling fails, redirect after a short delay
                    setTimeout(() => {
                        router.push(`/outflow/receipt/${selectedRecord.id}?withdrawn=${bags}&rent=${finalRent}&paidNow=${paidNow}&discount=${discountAmount}`);
                    }, 500);
                }

            } catch (error) {
                console.error("Outflow failed:", error);
                toast({ title: 'Error', description: 'Failed to process outflow.', variant: 'destructive' });
            }
        });
    }

  return (
    <div className="flex justify-center">
        <form onSubmit={handleSubmit} className="w-full max-w-lg">
            <Card>
                <CardHeader>
                <CardTitle>Withdrawal Details</CardTitle>
                <CardDescription>Select a customer, then choose a record and enter withdrawal information.</CardDescription>
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
                        <div className="space-y-2">
                            <Label htmlFor="recordId">Storage Record</Label>
                            <Select name="recordId" onValueChange={setSelectedRecordId} value={selectedRecordId} required>
                                <SelectTrigger id="recordId">
                                    <SelectValue placeholder="Select a record..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {filteredRecords.length > 0 ? filteredRecords.map(record => (
                                        <SelectItem key={record.id} value={record.id}>
                                            Bill No: {record.id} / Lot: {record.location || 'N/A'} - {record.commodityDescription} ({record.bagsStored} bags)
                                        </SelectItem>
                                    )) : (
                                        <SelectItem value="none" disabled>No active records for this customer</SelectItem>
                                    )}
                                </SelectContent>
                            </Select>
                        </div>
                    )}


                    {selectedRecord && (
                        <>
                            <Card className="bg-secondary/30 border-secondary">
                                <CardHeader className="p-4 pb-2">
                                    <CardTitle className="text-base">Record Summary</CardTitle>
                                    <CardDescription>Bill No: {selectedRecord.id}</CardDescription>
                                </CardHeader>
                                <CardContent className="p-4 pt-0 text-sm">
                                    <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                                        <div className="font-medium">Inflow Date:</div>
                                        <div>{format(toDate(selectedRecord.storageStartDate), 'dd MMM yyyy')}</div>

                                        <div className="font-medium">Total Bags In:</div>
                                        <div>{selectedRecord.bagsIn}</div>

                                        <div className="font-medium">Bags Withdrawn:</div>
                                        <div>{(selectedRecord.bagsOut || 0) + (Number(bagsToWithdraw) || 0)}</div>
                                        
                                        <div className="font-medium text-primary">Balance Bags:</div>
                                        <div className="font-bold text-primary">{selectedRecord.bagsStored - (Number(bagsToWithdraw) || 0)}</div>
                                    </div>
                                </CardContent>
                            </Card>

                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="bagsToWithdraw">Bags to Withdraw</Label>
                                    <Input 
                                        id="bagsToWithdraw" 
                                        name="bagsToWithdraw" 
                                        type="number" 
                                        placeholder={`Enter amount (max ${selectedRecord.bagsStored})`}
                                        required 
                                        value={bagsToWithdraw}
                                        onChange={e => setBagsToWithdraw(e.target.value === '' ? '' : Number(e.target.value))}
                                    />
                                </div>
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
                            </div>
                            <Separator />
                            <div className="space-y-4">
                                <h4 className="font-medium">Final Billing Summary</h4>
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-muted-foreground">Storage Duration</span>
                                        <span className="font-mono">{storageMonths} months</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-muted-foreground">Rent Due for {Number(bagsToWithdraw) || 0} bags</span>
                                        <span className="font-mono">{formatCurrency(finalRent)}</span>
                                    </div>
                                     <div className="flex justify-between items-center text-sm">
                                        <span className="text-muted-foreground">Pending Hamali Charges</span>
                                        <span className="font-mono">{formatCurrency(hamaliPending)}</span>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="discount">Discount</Label>
                                        <Input
                                            id="discount"
                                            name="discount"
                                            type="number"
                                            placeholder="0.00"
                                            step="0.01"
                                            value={discount}
                                            onChange={e => setDiscount(e.target.value === '' ? '' : Number(e.target.value))}
                                        />
                                    </div>
                                    <Separator />
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
                                            max={totalPayable.toFixed(2)}
                                        />
                                        <p className="text-xs text-muted-foreground">
                                            Enter the amount paid by the customer. Leave blank if unpaid.
                                        </p>
                                    </div>
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
