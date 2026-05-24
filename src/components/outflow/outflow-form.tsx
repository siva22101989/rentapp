'use client';

import { useEffect, useState, useTransition, useMemo } from 'react';
import { useFirestore } from '@/firebase/provider';
import { doc, updateDoc, arrayUnion, writeBatch, Timestamp } from 'firebase/firestore';
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
      <Button type="submit" disabled={isPending} className="w-full text-sm">
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
    const firestore = useFirestore();
    const appUser = useAppUser();
    const [isPending, startTransition] = useTransition();
    const [sendSmsNotification, setSendSmsNotification] = useState(true);
    
    const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
    const [withdrawals, setWithdrawals] = useState<Record<string, number | ''>>({});
    
    const [amountPaidNow, setAmountPaidNow] = useState<number | ''>('');
    const [discount, setDiscount] = useState<number | ''>('');
    const [khataAmountInput, setKhataAmountInput] = useState<number | ''>('');
    const [withdrawalDateStr, setWithdrawalDateStr] = useState(new Date().toISOString().split('T')[0]);
    
    const [totalRent, setTotalRent] = useState(0);
    const [totalPendingHamali, setTotalPendingHamali] = useState(0);
    const [totalKhataFromRecords, setTotalKhataFromRecords] = useState(0);
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
    const totalPayable = totalRent + totalPendingHamali + (Number(khataAmountInput) || 0) - (Number(discount) || 0);

    useEffect(() => {
        setWithdrawals({});
        setKhataAmountInput('');
    }, [selectedCustomerId]);

    useEffect(() => {
        let runningRent = 0;
        let runningHamali = 0;
        let runningKhata = 0;
        let runningBags = 0;
        const processedRecords = new Set<string>();

        const wDate = new Date(withdrawalDateStr);
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

                const { rent } = calculateFinalRent({ ...recordWithRates, storageStartDate: toDate(recordWithRates.storageStartDate) }, wDate, bagsToWithdraw);
                runningRent += rent;
                
                if (!processedRecords.has(recordId)) {
                    const hamaliPaid = (record.payments || []).filter(p => p.type === 'hamali').reduce((acc, p) => acc + p.amount, 0);
                    const pendingHamali = (record.hamaliPayable || 0) - hamaliPaid;
                    runningHamali += Math.max(0, pendingHamali);
                    runningKhata += (record.khataAmount || 0);
                    processedRecords.add(recordId);
                }
                runningBags += bagsToWithdraw;
            }
        });
        
        setTotalRent(runningRent);
        setTotalPendingHamali(runningHamali);
        setTotalKhataFromRecords(runningKhata);
        setTotalBags(runningBags);
        
        if (khataAmountInput === '' && runningKhata > 0) {
            setKhataAmountInput(runningKhata);
        }
    }, [withdrawals, withdrawalDateStr, records, commodities, khataAmountInput]);

    const resetForm = () => {
        setSelectedCustomerId('');
        setWithdrawals({});
        setAmountPaidNow('');
        setDiscount('');
        setKhataAmountInput('');
        setWithdrawalDateStr(new Date().toISOString().split('T')[0]);
    }
    
    const handleCustomerChange = (customerId: string) => {
        setSelectedCustomerId(customerId);
        setWithdrawals({});
        setAmountPaidNow('');
        setDiscount('');
        setKhataAmountInput('');
    }

    const handleWithdrawalChange = (recordId: string, value: string, maxBags: number) => {
        const numValue = value === '' ? '' : Number(value);
        if (numValue === '' || (numValue >= 0 && numValue <= maxBags && !isNaN(numValue))) {
            setWithdrawals(prev => ({ ...prev, [recordId]: numValue }));
        }
    };
    
    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        
        const finalDate = new Date(withdrawalDateStr);
        if (!firestore || withdrawalEntries.length === 0) {
            toast({ title: 'Error', description: 'Please select items to withdraw.', variant: 'destructive' });
            return;
        }

        let receiptUrl: string | null = null;
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

            const { rent: rentForThisWithdrawal } = calculateFinalRent({ ...recordWithRates, storageStartDate: toDate(recordWithRates.storageStartDate) }, finalDate, bagsToWithdraw);
            
            queryParams.set('recordId', recordId);
            queryParams.set('withdrawn', String(bagsToWithdraw));
            queryParams.set('rent', String(rentForThisWithdrawal));
            queryParams.set('paidNow', String(Number(amountPaidNow) || 0));
            queryParams.set('discount', String(Number(discount) || 0));
            queryParams.set('khata', String(Number(khataAmountInput) || 0));
            
            receiptUrl = `/outflow/receipt?${queryParams.toString()}`;
        }

        startTransition(async () => {
            try {
                const batch = writeBatch(firestore);
                const discountAmount = !isMultiLotWithdrawal ? (Number(discount) || 0) : 0;
                const khataAmount = !isMultiLotWithdrawal ? (Number(khataAmountInput) || 0) : totalKhataFromRecords;
                
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

                    const { rent: rentForThisWithdrawal } = calculateFinalRent({ ...recordWithRates, storageStartDate: toDate(recordWithRates.storageStartDate) }, finalDate, bagsToWithdraw);
                    
                    const newOutflow: Partial<Outflow> = {
                        date: finalDate,
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

                    if (!isMultiLotWithdrawal && khataAmount !== record.khataAmount) {
                        updateData.khataAmount = khataAmount;
                    }

                    if (newBagsStored <= 0) {
                        updateData.storageEndDate = Timestamp.fromDate(finalDate);
                        updateData.billingCycle = 'Completed';
                    }
                    
                    const paidNow = Number(amountPaidNow) || 0;
                    if (!isMultiLotWithdrawal && paidNow > 0) {
                        const newPayment: Partial<Payment> = { amount: paidNow, date: finalDate, type: 'rent' };
                        updateData.payments = arrayUnion(cleanForFirestore(newPayment));
                    }
                    
                    const recordRef = doc(firestore, 'storageRecords', record.id);
                    batch.update(recordRef, updateData);
                }
                
                await batch.commit();

                if (sendSmsNotification && warehouseInfo?.textbeeApiKey && selectedCustomer?.phone) {
                    const defaultTemplate = `Dear {customerName}, withdrawal of {bags} bags of {commodity} recorded. Patti: {billNo},\nRent: {rent},\nTotal: {total}.\nThank you. - {warehouseName}.`;
                    const template = warehouseInfo?.smsOutflowTemplate || defaultTemplate;

                    let commodity = 'various items';
                    let billNo = 'Multiple';

                    if (withdrawalEntries.length === 1) {
                        const recordId = withdrawalEntries[0][0];
                        const record = records.find(r => r.id === recordId);
                        if (record) commodity = record.commodityDescription;
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
                        .replace('{warehouseName}', warehouseInfo?.name || 'Sri Lakshmi Warehouse');

                    sendSms({ apiKey: warehouseInfo.textbeeApiKey, deviceId: warehouseInfo.textbeeDeviceId, to: selectedCustomer.phone, message }).catch(console.error);
                }

                toast({ title: 'Success', description: 'Withdrawal processed successfully.' });
                resetForm();
                if (receiptUrl) window.open(receiptUrl, '_blank');

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
                <CardTitle className="text-lg">Create Withdrawal</CardTitle>
                <CardDescription className="text-xs">Select records for the chosen customer to process outflow.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-1.5">
                        <Label htmlFor="customerId" className="text-xs">Customer</Label>
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
                        <div className="text-[11px] text-muted-foreground p-3 border rounded-md bg-secondary/50 space-y-0.5 -mt-2">
                            <p><strong>Father's Name:</strong> {selectedCustomer.fatherName || 'N/A'}</p>
                            <p><strong>Village:</strong> {selectedCustomer.village || 'N/A'}</p>
                            <p><strong>Phone:</strong> {selectedCustomer.phone}</p>
                        </div>
                    )}

                    {selectedCustomerId && (
                        <div className="border rounded-md overflow-hidden">
                            <Table className="text-sm">
                                <TableHeader>
                                    <TableRow className="text-xs">
                                        <TableHead>Storage ID</TableHead>
                                        <TableHead>Commodity</TableHead>
                                        <TableHead>Lot</TableHead>
                                        <TableHead className="text-right">Stock</TableHead>
                                        <TableHead className="w-[100px]">Withdraw</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredRecords.length > 0 ? filteredRecords.map(record => (
                                        <TableRow key={record.id} className="text-sm">
                                            <TableCell>{record.id}</TableCell>
                                            <TableCell>{record.commodityDescription}</TableCell>
                                            <TableCell>{record.location}</TableCell>
                                            <TableCell className="text-right font-mono">{record.bagsStored}</TableCell>
                                            <TableCell>
                                                <Input
                                                    type="number"
                                                    step="0.01"
                                                    placeholder="0"
                                                    min="0"
                                                    max={record.bagsStored}
                                                    value={withdrawals[record.id] || ''}
                                                    onChange={(e) => handleWithdrawalChange(record.id, e.target.value, record.bagsStored)}
                                                    className="text-right h-8 text-sm"
                                                />
                                            </TableCell>
                                        </TableRow>
                                    )) : (
                                        <TableRow>
                                            <TableCell colSpan={5} className="text-center h-24 text-muted-foreground italic">
                                                No active records found.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    )}

                    {withdrawalEntries.length > 0 && (
                        <>
                            <div className="space-y-1.5">
                                <Label htmlFor="withdrawalDate" className="text-xs">Withdrawal Date</Label>
                                <Input 
                                    id="withdrawalDate" 
                                    name="withdrawalDate" 
                                    type="date"
                                    value={withdrawalDateStr}
                                    required
                                    onChange={(e) => setWithdrawalDateStr(e.target.value)}
                                    className="text-sm"
                                    />
                            </div>
                            <Separator />
                            <div className="space-y-4">
                                <h4 className="text-xs font-bold uppercase">Billing Summary</h4>
                                <div className="space-y-2 text-xs">
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
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                                <div className="space-y-1.5">
                                    <Label htmlFor="khataAmountInput" className="text-xs">Khata Amount (Weighbridge)</Label>
                                    <Input
                                        id="khataAmountInput"
                                        name="khataAmountInput"
                                        type="number"
                                        placeholder="0.00"
                                        step="0.01"
                                        value={khataAmountInput}
                                        onChange={e => setKhataAmountInput(e.target.value === '' ? '' : Number(e.target.value))}
                                        className="text-sm"
                                    />
                                    <p className="text-[10px] text-muted-foreground">Record default: {formatCurrency(totalKhataFromRecords)}</p>
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="discount" className="text-xs">Discount Amount</Label>
                                    <Input
                                        id="discount"
                                        name="discount"
                                        type="number"
                                        placeholder="0.00"
                                        step="0.01"
                                        value={discount}
                                        onChange={e => setDiscount(e.target.value === '' ? '' : Number(e.target.value))}
                                        disabled={isMultiLotWithdrawal}
                                        className="text-sm"
                                    />
                                </div>
                            </div>

                            <Separator className="my-4"/>

                            <div className="space-y-4 pt-2">
                                <div className="flex justify-between items-center font-semibold text-lg">
                                    <span className="text-foreground">Total Payable</span>
                                    <span className="font-mono">{formatCurrency(totalPayable)}</span>
                                </div>
                                
                                <div className="space-y-1.5">
                                    <Label htmlFor="amountPaidNow" className="text-xs">Total Amount Paid Now</Label>
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
                                        className="text-sm"
                                    />
                                    <p className="text-[10px] text-muted-foreground">
                                        {isMultiLotWithdrawal ? "Payment logic disabled for multi-lot withdrawals." : "Enter cash collected now. Leave blank for credit."}
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
                                    className="text-xs font-medium leading-none"
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