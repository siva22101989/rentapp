
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
import { Checkbox } from '@/components/ui/checkbox';
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
    const [selectedRecordIds, setSelectedRecordIds] = useState<string[]>([]);
    
    const [amountPaidNow, setAmountPaidNow] = useState<number | ''>('');
    const [discount, setDiscount] = useState<number | ''>('');
    const [withdrawalDate, setWithdrawalDate] = useState(new Date());
    
    // Calculated totals for the selected records
    const [totalRent, setTotalRent] = useState(0);
    const [totalPendingHamali, setTotalPendingHamali] = useState(0);
    const [totalBags, setTotalBags] = useState(0);

    const customerOptions = customers.map(c => ({ value: c.id, label: c.name }));

    const filteredRecords = useMemo(() => 
        selectedCustomerId ? records.filter(r => r.customerId === selectedCustomerId) : [],
        [records, selectedCustomerId]
    );

    const selectedRecords = useMemo(() => 
        filteredRecords.filter(r => selectedRecordIds.includes(r.id)),
        [filteredRecords, selectedRecordIds]
    );

    const totalPayable = totalRent + totalPendingHamali - (Number(discount) || 0);

    useEffect(() => {
        // Reset selections when customer changes
        setSelectedRecordIds([]);
    }, [selectedCustomerId]);

    useEffect(() => {
        // Recalculate totals when selection or date changes
        if (selectedRecords.length > 0) {
            let runningRent = 0;
            let runningHamali = 0;
            let runningBags = 0;

            selectedRecords.forEach(record => {
                const hamaliPaid = (record.payments || [])
                    .filter(p => p.type === 'hamali')
                    .reduce((acc, p) => acc + p.amount, 0);
                const pending = (record.hamaliPayable || 0) - hamaliPaid;
                runningHamali += pending > 0 ? pending : 0;
                
                const safeRecord = { ...record, storageStartDate: toDate(record.storageStartDate) };
                runningBags += record.bagsStored;

                const { rent } = calculateFinalRent(safeRecord, withdrawalDate, record.bagsStored);
                runningRent += rent;
            });
            
            setTotalRent(runningRent);
            setTotalPendingHamali(runningHamali);
            setTotalBags(runningBags);
        } else {
            setTotalRent(0);
            setTotalPendingHamali(0);
            setTotalBags(0);
        }
    }, [selectedRecords, withdrawalDate]);
    
    const handleCustomerChange = (customerId: string) => {
        setSelectedCustomerId(customerId);
        setSelectedRecordIds([]);
        setAmountPaidNow('');
        setDiscount('');
    }

    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const dateValue = e.target.valueAsDate ? new Date(e.target.valueAsDate.valueOf() + e.target.valueAsDate.getTimezoneOffset() * 60 * 1000) : new Date();
        setWithdrawalDate(dateValue);
    }
    
    const handleSelectRecord = (recordId: string) => {
        setSelectedRecordIds(prev => 
            prev.includes(recordId) ? prev.filter(id => id !== recordId) : [...prev, recordId]
        );
    }
    
    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        
        if (!firestore || selectedRecords.length === 0) {
            toast({ title: 'Error', description: 'Please select a customer and at least one record.', variant: 'destructive' });
            return;
        }

        startTransition(async () => {
            try {
                const batch = writeBatch(firestore);
                const discountAmount = Number(discount) || 0;
                
                // Simple case: single record withdrawal
                if (selectedRecords.length === 1) {
                    const record = selectedRecords[0];
                    const recordRef = doc(firestore, 'storageRecords', record.id);
                    
                    const newOutflow: Partial<Outflow> = {
                        date: withdrawalDate,
                        bagsWithdrawn: record.bagsStored,
                        rentBilled: totalRent,
                        discount: discountAmount,
                    };

                    const updateData: any = {
                        bagsOut: (record.bagsOut || 0) + record.bagsStored,
                        bagsStored: 0,
                        totalRentBilled: (record.totalRentBilled || 0) + totalRent,
                        storageEndDate: Timestamp.fromDate(withdrawalDate),
                        billingCycle: 'Completed',
                        outflows: arrayUnion(cleanForFirestore(newOutflow)),
                    };
                    
                    const paidNow = Number(amountPaidNow) || 0;
                    if (paidNow > 0) {
                        const newPayment: Partial<Payment> = { amount: paidNow, date: withdrawalDate, type: 'rent' };
                        updateData.payments = arrayUnion(cleanForFirestore(newPayment));
                    }
                    
                    batch.update(recordRef, updateData);
                    await batch.commit();
                    toast({ title: 'Success', description: 'Withdrawal processed successfully.' });
                    router.push(`/outflow/receipt/${record.id}?withdrawn=${record.bagsStored}&rent=${totalRent}&paidNow=${paidNow}&discount=${discountAmount}`);

                } else { // Bulk withdrawal case
                    for (const record of selectedRecords) {
                        const recordRef = doc(firestore, 'storageRecords', record.id);
                        
                        // Recalculate rent for THIS specific record
                        const { rent: recordRent } = calculateFinalRent({ ...record, storageStartDate: toDate(record.storageStartDate) }, withdrawalDate, record.bagsStored);

                        const newOutflow: Partial<Outflow> = {
                            date: withdrawalDate,
                            bagsWithdrawn: record.bagsStored,
                            rentBilled: recordRent,
                            discount: 0, // Discount is applied globally later if needed, not per record
                        };
                        
                        const updateData: any = {
                            bagsOut: (record.bagsOut || 0) + record.bagsStored,
                            bagsStored: 0,
                            totalRentBilled: (record.totalRentBilled || 0) + recordRent,
                            storageEndDate: Timestamp.fromDate(withdrawalDate),
                            billingCycle: 'Completed',
                            outflows: arrayUnion(cleanForFirestore(newOutflow)),
                        };
                        batch.update(recordRef, updateData);
                    }
                    
                    await batch.commit();
                    toast({ title: 'Success', description: `${selectedRecords.length} records processed in bulk. You can apply a bulk payment from the Pending Payments page.` });
                    router.push(`/reports?report=customer-statement&customerId=${selectedCustomerId}`);
                }

            } catch (error) {
                console.error("Outflow failed:", error);
                toast({ title: 'Error', description: 'Failed to process outflow.', variant: 'destructive' });
            }
        });
    }

  return (
    <div className="flex justify-center">
        <form onSubmit={handleSubmit} className="w-full max-w-2xl">
            <Card>
                <CardHeader>
                <CardTitle>Withdrawal Details</CardTitle>
                <CardDescription>Select a customer, then choose one or more records for full withdrawal.</CardDescription>
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
                                        <TableHead className="w-12"></TableHead>
                                        <TableHead>Bill No</TableHead>
                                        <TableHead>Commodity</TableHead>
                                        <TableHead>Lot</TableHead>
                                        <TableHead className="text-right">Bags</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredRecords.length > 0 ? filteredRecords.map(record => (
                                        <TableRow 
                                            key={record.id}
                                            onClick={() => handleSelectRecord(record.id)}
                                            className="cursor-pointer"
                                            data-state={selectedRecordIds.includes(record.id) ? "selected" : ""}
                                        >
                                            <TableCell className="p-2" onClick={(e) => e.stopPropagation()}>
                                                <Checkbox
                                                    checked={selectedRecordIds.includes(record.id)}
                                                    onCheckedChange={() => handleSelectRecord(record.id)}
                                                />
                                            </TableCell>
                                            <TableCell>{record.id}</TableCell>
                                            <TableCell>{record.commodityDescription}</TableCell>
                                            <TableCell>{record.location}</TableCell>
                                            <TableCell className="text-right font-mono">{record.bagsStored}</TableCell>
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


                    {selectedRecords.length > 0 && (
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
                                        <span className="text-muted-foreground">Total Bags Selected</span>
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
                                        max={totalPayable.toFixed(2)}
                                        disabled={selectedRecords.length > 1}
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        {selectedRecords.length > 1 ? "Payment can only be recorded for single record withdrawals. For bulk, use the Pending Payments page after." : "Enter amount paid by customer. Leave blank if unpaid."}
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
