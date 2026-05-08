'use client';

import { useEffect, useState, useTransition, useMemo } from 'react';
import { useFirestore } from '@/firebase/provider';
import { doc, updateDoc, arrayUnion, type Firestore, Timestamp, getDoc, writeBatch } from 'firebase/firestore';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { Customer, StorageRecord, Payment, Outflow, WarehouseInfo, Commodity } from '@/lib/definitions';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { Separator } from '../ui/separator';
import { calculateFinalRent } from '@/lib/billing';
import { format } from 'date-fns';
import { toDate, cleanForFirestore, formatCurrency } from '@/lib/utils';
import { Combobox } from '../ui/combobox';
import { useRouter } from 'next/navigation';
import { useDoc } from '@/firebase/firestore/use-doc';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { Checkbox } from '@/components/ui/checkbox';
import { sendSms } from '@/lib/sms';
import { useAppUser } from '@/firebase/auth/use-user';

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

export function OutflowForm({ records, customers, commodities }: { records: StorageRecord[], customers: Customer[], commodities: Commodity[] }) {
    const { toast } = useToast();
    const router = useRouter();
    const firestore = useFirestore();
    const appUser = useAppUser();
    const [isPending, startTransition] = useTransition();
    const [sendSmsNotification, setSendSmsNotification] = useState(true);
    
    const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
    const [withdrawals, setWithdrawals] = useState<Record<string, number | ''>>({});
    
    const [amountPaidNow, setAmountPaidNow] = useState<number | ''>('');
    const [discount, setDiscount] = useState<number | ''>('');
    const [withdrawalDate, setWithdrawalDate] = useState(new Date());
    
    const [totalRent, setTotalRent] = useState(0);
    const [totalPendingHamali, setTotalPendingHamali] = useState(0);
    const [totalKhata, setTotalKhata] = useState(0);
    const [totalBags, setTotalBags] = useState(0);

    const warehouseInfoRef = useMemoFirebase(
      () => (firestore && appUser?.warehouseId ? doc(firestore, 'warehouses', appUser.warehouseId) : null),
      [firestore, appUser]
    );
    const { data: warehouseInfo } = useDoc<WarehouseInfo>(warehouseInfoRef);

    const customerOptions = customers.map(c => ({ value: c.id, label: c.name }));

    const filteredRecords = useMemo(() => 
        selectedCustomerId ? records.filter(r => r.customerId === selectedCustomerId) : [],
        [records, selectedCustomerId]
    );

    const selectedCustomer = useMemo(() => 
        customers.find(c => c.id === selectedCustomerId)
    , [customers, selectedCustomerId]);

    const withdrawalEntries = useMemo(() => 
        Object.entries(withdrawals).filter(([, bags]) => Number(bags) > 0),
        [withdrawals]
    );

    const isMultiLotWithdrawal = useMemo(() => withdrawalEntries.length > 1, [withdrawalEntries]);

    const totalPayable = totalRent + totalPendingHamali + totalKhata - (Number(discount) || 0);

    useEffect(() => {
        setWithdrawals({});
    }, [selectedCustomerId]);

    useEffect(() => {
        let runningRent = 0;
        let runningHamali = 0;
        let runningKhata = 0;
        let runningBags = 0;
        const processedRecords = new Set<string>();

        const currentWithdrawalEntries = Object.entries(withdrawals).filter(([, bags]) => Number(bags) > 0);

        currentWithdrawalEntries.forEach(([recordId, bags]) => {
            const bagsToWithdraw = Number(bags);
            const record = records.find(r => r.id === recordId);
            if (record) {
                let recordWithRates = { ...record };
                if (record.rate6Months === undefined || record.rate1Year === undefined) {
                    const commodity = commodities.find(c => c.name === record.commodityDescription);
                    if (commodity) {
                        recordWithRates.rate6Months = commodity.rate6Months;
                        recordWithRates.rate1Year = commodity.rate1Year;
                    }
                }

                const { rent } = calculateFinalRent({ ...recordWithRates, storageStartDate: toDate(recordWithRates.storageStartDate) }, withdrawalDate, bagsToWithdraw);
                runningRent += rent;
                
                if (!processedRecords.has(recordId)) {
                    const hamaliPaid = (record.payments || []).filter(p => p.type === 'hamali').reduce((acc, p) => acc + p.amount, 0);
                    const pendingHamali = (record.hamaliPayable || 0) - hamaliPaid;
                    runningHamali += Math.max(0, pendingHamali);
                    
                    // Add Khata if it exists and hasn't been paid as 'other'
                    // For now we assume Khata is added to final bill
                    runningKhata += (record.khataAmount || 0);
                    
                    processedRecords.add(recordId);
                }
                runningBags += bagsToWithdraw;
            }
        });
        
        setTotalRent(runningRent);
        setTotalPendingHamali(runningHamali);
        setTotalKhata(runningKhata);
        setTotalBags(runningBags);
    }, [withdrawals, withdrawalDate, records, commodities]);

    const resetForm = () => {
        setSelectedCustomerId('');
        setWithdrawals({});
        setAmountPaidNow('');
        setDiscount('');
        setWithdrawalDate(new Date());
    }
    
    const handleCustomerChange = (customerId: string) => {
        setSelectedCustomerId(customerId);
        setWithdrawals({});
        setAmountPaidNow('');
        setDiscount('');
    }

    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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

        let receiptWindow: Window | null = null;
        if (!isMultiLotWithdrawal) {
            const [recordId] = withdrawalEntries[0];
            const queryParams = new URLSearchParams();
            const bagsToWithdraw = Number(withdrawals[recordId]);
            
            let recordWithRates = { ...records.find(r => r.id === recordId)! };
             if (recordWithRates.rate6Months === undefined || recordWithRates.rate1Year === undefined) {
                const commodity = commodities.find(c => c.name === recordWithRates.commodityDescription);
                if (commodity) {
                    recordWithRates.rate6Months = commodity.rate6Months;
                    recordWithRates.rate1Year = commodity.rate1Year;
                }
            }

            const { rent: rentForThisWithdrawal } = calculateFinalRent({ ...recordWithRates, storageStartDate: toDate(recordWithRates.storageStartDate) }, withdrawalDate, bagsToWithdraw);
            
            queryParams.set('withdrawn', String(bagsToWithdraw));
            queryParams.set('rent', String(rentForThisWithdrawal));
            queryParams.set('paidNow', String(Number(amountPaidNow) || 0));
            queryParams.set('discount', String(Number(discount) || 0));
            
            const receiptUrl = `/outflow/receipt/${recordId}?${queryParams.toString()}`;
            receiptWindow = window.open(receiptUrl, '_blank');
            
            if (!receiptWindow) {
                toast({ title: "Popup Blocked", description: "Please allow popups for this site to view receipts.", variant: "destructive" });
                return;
            }
        }

        startTransition(async () => {
            try {
                const batch = writeBatch(firestore);
                const discountAmount = !isMultiLotWithdrawal ? (Number(discount) || 0) : 0;
                
                const processedRecordIds = new Set(withdrawalEntries.map(([id]) => id));
                const recordsToProcess = records.filter(r => processedRecordIds.has(r.id));
                
                for (const record of recordsToProcess) {
                    const bagsToWithdraw = Number(withdrawals[record.id]);
                    if (bagsToWithdraw <= 0) continue;

                    let recordWithRates = { ...record };
                    if (record.rate6Months === undefined || record.rate1Year === undefined) {
                        const commodity = commodities.find(c => c.name === record.commodityDescription);
                        if (commodity) {
                            recordWithRates.rate6Months = commodity.rate6Months;
                            recordWithRates.rate1Year = commodity.rate1Year;
                        }
                    }

                    const { rent: rentForThisWithdrawal } = calculateFinalRent({ ...recordWithRates, storageStartDate: toDate(recordWithRates.storageStartDate) }, withdrawalDate, bagsToWithdraw);
                    
                    const newOutflow: Partial<Outflow> = {
                        date: withdrawalDate,
                        bagsWithdrawn: bagsToWithdraw,
                        rentBilled: rentForThisWithdrawal,
                        discount: isMultiLotWithdrawal ? 0 : discountAmount,
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
                    
                    const recordRef = doc(firestore, 'storageRecords', record.id);
                    batch.update(recordRef, updateData);
                }
                
                await batch.commit();

                if (sendSmsNotification && warehouseInfo?.textbeeApiKey && selectedCustomer?.phone) {
                    const defaultTemplate = `Dear {customerName}, withdrawal of {bags} bags of {commodity} recorded. Invoice: {billNo},\nRent: {rent},\nTotal: {total}.\nThank you. - {warehouseName}.`;
                    const template = warehouseInfo?.smsOutflowTemplate || defaultTemplate;

                    let commodity = 'various items';
                    let billNo = 'Multiple';

                    if (withdrawalEntries.length === 1) {
                        const recordId = withdrawalEntries[0][0];
                        const record = records.find(r => r.id === recordId);
                        if (record) {
                            commodity = record.commodityDescription;
                        }
                        billNo = recordId;
                    } else {
                        billNo = withdrawalEntries.map(([id]) => id).join(', ');
                    }
                    
                    const message = template
                        .replace('{customerName}', selectedCustomer.name)
                        .replace('{bags}', String(totalBags))
                        .replace('{commodity}', commodity)
                        .replace('{billNo}', billNo)
                        .replace('{rent}', formatCurrency(totalRent))
                        .replace('{total}', formatCurrency(totalPayable))
                        .replace('{warehouseName}', warehouseInfo?.name || 'GrainDost');

                    sendSms({
                        apiKey: warehouseInfo.textbeeApiKey,
                        deviceId: warehouseInfo.textbeeDeviceId,
                        to: selectedCustomer.phone,
                        message: message,
                    }).catch(console.error);
                }

                if (isMultiLotWithdrawal) {
                    toast({ title: 'Success', description: `${withdrawalEntries.length} records processed. You can make a bulk payment from the Pending Payments page.`, duration: 7000 });
                    resetForm();
                    router.push(`/reports?report=customer-statement&customerId=${selectedCustomerId}`);
                } else {
                    toast({ title: 'Success', description: 'Withdrawal processed successfully.' });
                    resetForm();
                }

            } catch (error) {
                console.error("Outflow failed:", error);
                toast({ title: 'Error', description: 'Failed to process outflow.', variant: 'destructive' });
                if (receiptWindow) receiptWindow.close();
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
                    
                    {selectedCustomer && (
                        <div className="text-sm text-muted-foreground p-3 border rounded-md bg-secondary/50 space-y-1">
                            <p><strong>Father's Name:</strong> {selectedCustomer.fatherName || 'N/A'}</p>
                            <p><strong>Village:</strong> {selectedCustomer.village || 'N/A'}</p>
                            <p><strong>Phone:</strong> {selectedCustomer.phone}</p>
                        </div>
                    )}

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
                                    <div className="flex justify-between items-center text-blue-600">
                                        <span>Calculated Rent Due</span>
                                        <span className="font-mono">{formatCurrency(totalRent)}</span>
                                    </div>
                                     <div className="flex justify-between items-center text-orange-600">
                                        <span>Pending Hamali Charges</span>
                                        <span className="font-mono">{formatCurrency(totalPendingHamali)}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-purple-600">
                                        <span>Pending Khata (Weighbridge)</span>
                                        <span className="font-mono">{formatCurrency(totalKhata)}</span>
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
                             <div className="flex items-center space-x-2 pt-4">
                                <Checkbox 
                                    id="sendSmsOutflow" 
                                    checked={sendSmsNotification}
                                    onCheckedChange={(checked) => setSendSmsNotification(Boolean(checked))}
                                    disabled={!warehouseInfo?.textbeeApiKey || !selectedCustomer?.phone}
                                />
                                <label
                                    htmlFor="sendSmsOutflow"
                                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                >
                                    Send SMS Notification to Customer
                                </label>
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