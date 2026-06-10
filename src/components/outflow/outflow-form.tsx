'use client';

import { useEffect, useState, useTransition, useMemo } from 'react';
import { useFirestore } from '@/firebase/provider';
import { doc, arrayUnion, writeBatch, Timestamp } from 'firebase/firestore';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { Customer, StorageRecord, Payment, Outflow, WarehouseInfo, Commodity } from '@/lib/definitions';
import { useToast } from '@/hooks/use-toast';
import { Loader2, AlertTriangle } from 'lucide-react';
import { Separator } from '../ui/separator';
import { calculateFinalRent } from '@/lib/billing';
import { format } from 'date-fns';
import { toDate, cleanForFirestore, formatCurrency } from '@/lib/utils';
import { Combobox } from '../ui/combobox';
import { useDoc } from '@/firebase/firestore/use-doc';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { Checkbox } from '@/components/ui/checkbox';
import { sendSms } from '@/lib/sms';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';

function SubmitButton({ isPending, disabled }: { isPending: boolean; disabled: boolean }) {
    return (
      <Button type="submit" disabled={isPending || disabled} className="w-full text-sm font-bold uppercase tracking-wider">
        {isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Synchronizing Ledger...
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
        if (isNaN(wDate.getTime())) return;

        const currentWithdrawalEntries = Object.entries(withdrawals).filter(([, bags]) => Number(bags) > 0);

        currentWithdrawalEntries.forEach(([recordId, bags]) => {
            const bagsToWithdraw = Number(bags);
            const record = records.find(r => r.id === recordId);
            if (record) {
                let recordWithRates: StorageRecord = { ...record };
                
                // Robust matching: trim and case-insensitive
                const normalizedDesc = (record.commodityDescription || '').trim().toLowerCase();
                const commodity = commodities.find(c => (c.name || '').trim().toLowerCase() === normalizedDesc);

                if (record.rate6Months === undefined || record.rate1Year === undefined || record.monthlyRate === undefined) {
                    if (commodity) {
                        recordWithRates.rate6Months = commodity.rate6Months;
                        recordWithRates.rate1Year = commodity.rate1Year;
                        recordWithRates.billingType = commodity.billingType;
                        recordWithRates.monthlyRate = commodity.monthlyRate;
                        recordWithRates.minBillingMonths = commodity.minBillingMonths;
                        recordWithRates.insuranceRate = commodity.insuranceRate;
                    }
                }

                const { rent } = calculateFinalRent({ ...recordWithRates, storageStartDate: toDate(recordWithRates.storageStartDate) }, wDate, bagsToWithdraw);
                runningRent += (rent || 0);
                
                if (!processedRecords.has(recordId)) {
                    const hamaliPaid = (record.payments || []).filter(p => p.type === 'hamali').reduce((acc, p) => acc + (p.amount || 0), 0);
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
        if (isNaN(finalDate.getTime())) {
            toast({ title: 'Invalid Date', description: 'Please select a valid withdrawal date.', variant: 'destructive' });
            return;
        }

        if (!firestore || withdrawalEntries.length === 0) {
            toast({ title: 'Input Required', description: 'Please enter the number of bags to withdraw.', variant: 'destructive' });
            return;
        }

        startTransition(async () => {
            try {
                const batch = writeBatch(firestore);
                const discountAmount = !isMultiLotWithdrawal ? (Number(discount) || 0) : 0;
                const khataAmount = !isMultiLotWithdrawal ? (Number(khataAmountInput) || 0) : totalKhataFromRecords;
                
                const processedRecordIds = new Set(withdrawalEntries.map(([id]) => id));
                const recordsToProcess = records.filter(r => processedRecordIds.has(r.id));
                
                let firstReceiptUrl: string | null = null;

                for (const record of recordsToProcess) {
                    const bagsToWithdraw = Number(withdrawals[record.id]);
                    if (bagsToWithdraw <= 0) continue;

                    let recordWithRates: StorageRecord = { ...record };
                    const normalizedDesc = (record.commodityDescription || '').trim().toLowerCase();
                    const commodity = commodities.find(c => (c.name || '').trim().toLowerCase() === normalizedDesc);

                    if (record.rate6Months === undefined || record.rate1Year === undefined || record.monthlyRate === undefined) {
                        if (commodity) {
                            recordWithRates.rate6Months = commodity.rate6Months;
                            recordWithRates.rate1Year = commodity.rate1Year;
                            recordWithRates.billingType = commodity.billingType;
                            recordWithRates.monthlyRate = commodity.monthlyRate;
                            recordWithRates.minBillingMonths = commodity.minBillingMonths;
                            recordWithRates.insuranceRate = commodity.insuranceRate;
                        }
                    }

                    const { rent: rentForThisWithdrawal } = calculateFinalRent({ ...recordWithRates, storageStartDate: toDate(recordWithRates.storageStartDate) }, finalDate, bagsToWithdraw);
                    
                    const newOutflow: Partial<Outflow> = {
                        date: finalDate,
                        bagsWithdrawn: bagsToWithdraw,
                        rentBilled: rentForThisWithdrawal || 0,
                        discount: isMultiLotWithdrawal ? 0 : discountAmount,
                    };

                    const currentBagsOut = Number(record.bagsOut) || 0;
                    const currentBagsStored = Number(record.bagsStored) || (Number(record.bagsIn) - currentBagsOut);
                    
                    const newBagsOut = currentBagsOut + bagsToWithdraw;
                    const newBagsStored = currentBagsStored - bagsToWithdraw;

                    if (newBagsStored < 0) {
                        throw new Error(`Insufficient stock for Record #${record.id}. Requested: ${bagsToWithdraw}, Available: ${currentBagsStored}`);
                    }

                    const updateData: any = {
                        bagsOut: newBagsOut,
                        bagsStored: newBagsStored,
                        totalRentBilled: (Number(record.totalRentBilled) || 0) + (rentForThisWithdrawal || 0),
                        outflows: arrayUnion(cleanForFirestore(newOutflow)),
                    };

                    // Sync rates to record for history permanence if missing
                    if (record.rate6Months === undefined && commodity) {
                        updateData.rate6Months = commodity.rate6Months || 0;
                        updateData.rate1Year = commodity.rate1Year || 0;
                        updateData.billingType = commodity.billingType || 'slab';
                        updateData.monthlyRate = commodity.monthlyRate || 0;
                        updateData.minBillingMonths = commodity.minBillingMonths || 0;
                        updateData.insuranceRate = commodity.insuranceRate || 0;
                    }

                    if (!isMultiLotWithdrawal) {
                        updateData.khataAmount = khataAmount;
                    }

                    if (newBagsStored <= 0) {
                        updateData.storageEndDate = Timestamp.fromDate(finalDate);
                        updateData.billingCycle = 'Completed';
                    } else {
                        updateData.storageEndDate = null;
                        updateData.billingCycle = record.billingCycle || '6-Month Initial';
                    }
                    
                    const paidNow = Number(amountPaidNow) || 0;
                    if (!isMultiLotWithdrawal && paidNow > 0) {
                        const newPayment: Partial<Payment> = { amount: paidNow, date: finalDate, type: 'rent' };
                        updateData.payments = arrayUnion(cleanForFirestore(newPayment));
                    }
                    
                    const recordRef = doc(firestore, 'storageRecords', record.id);
                    batch.update(recordRef, cleanForFirestore(updateData));

                    // Build receipt URL for the first (or only) record
                    if (!firstReceiptUrl) {
                        const queryParams = new URLSearchParams();
                        queryParams.set('recordId', record.id);
                        queryParams.set('withdrawn', String(bagsToWithdraw));
                        queryParams.set('rent', String(rentForThisWithdrawal || 0));
                        queryParams.set('paidNow', String(isMultiLotWithdrawal ? 0 : paidNow));
                        queryParams.set('discount', String(isMultiLotWithdrawal ? 0 : discountAmount));
                        queryParams.set('khata', String(khataAmount));
                        firstReceiptUrl = `/outflow/receipt?${queryParams.toString()}`;
                    }
                }
                
                await batch.commit();

                // SMS Notification
                if (sendSmsNotification && warehouseInfo?.textbeeApiKey && selectedCustomer?.phone) {
                    const defaultTemplate = `Dear {customerName}, withdrawal of {bags} bags of {commodity} recorded. Patti: {billNo},\nRent: {rent},\nTotal: {total}.\nThank you. - {warehouseName}.`;
                    const template = warehouseInfo?.smsOutflowTemplate || defaultTemplate;

                    let commodityName = 'various items';
                    let billIdentifier = 'Multiple';

                    if (withdrawalEntries.length === 1) {
                        const rId = withdrawalEntries[0][0];
                        const r = records.find(r => r.id === rId);
                        if (r) {
                            commodityName = r.commodityDescription;
                            billIdentifier = `${r.id}-${(r.outflows?.length || 0) + 1}`;
                        }
                    }
                    
                    const message = template
                        .replace('{customerName}', selectedCustomer.name)
                        .replace('{bags}', String(totalBags))
                        .replace('{commodity}', commodityName)
                        .replace('{billNo}', billIdentifier)
                        .replace('{rent}', formatCurrency(totalRent))
                        .replace('{total}', formatCurrency(totalPayable))
                        .replace('{warehouseName}', warehouseInfo?.name || 'Sri Lakshmi Warehouse');

                    sendSms({ apiKey: warehouseInfo.textbeeApiKey, deviceId: warehouseInfo.textbeeDeviceId, to: selectedCustomer.phone, message }).catch(console.error);
                }

                toast({ title: 'Success', description: `Withdrawal processed for ${totalBags} bags.` });
                resetForm();
                if (firstReceiptUrl) window.open(firstReceiptUrl, '_blank');

            } catch (error: any) {
                console.error("Outflow failed:", error);
                toast({ 
                    title: 'System Error', 
                    description: error.message || 'Failed to process outflow. Check console for details.', 
                    variant: 'destructive' 
                });
            }
        });
    }

  return (
    <div className="flex justify-center">
        <form onSubmit={handleSubmit} className="w-full max-w-3xl">
            <Card className="stylish-card border-primary/20 shadow-lg">
                <CardHeader className="bg-secondary/30">
                <CardTitle className="text-xl font-bold tracking-tight">Generate Withdrawal Bill (Patti)</CardTitle>
                <CardDescription className="text-xs font-medium">Select active godown records to process a customer withdrawal.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 pt-6">
                    <div className="space-y-1.5">
                        <Label htmlFor="customerId" className="text-[10px] font-black uppercase tracking-widest text-slate-400">Target Customer</Label>
                        <Combobox
                            options={customerOptions}
                            value={selectedCustomerId}
                            onChange={handleCustomerChange}
                            placeholder="Select a customer to view active stock..."
                            searchPlaceholder="Search customers by name..."
                            emptyPlaceholder="No active records found for this customer."
                        />
                    </div>
                    
                    {selectedCustomer && (
                        <div className="text-[11px] text-muted-foreground p-3 border rounded-xl bg-slate-50 space-y-0.5 -mt-2">
                            <p><strong>Father's Name:</strong> {selectedCustomer.fatherName || 'N/A'}</p>
                            <p><strong>Village:</strong> {selectedCustomer.village || 'N/A'}</p>
                            <p><strong>Phone:</strong> {selectedCustomer.phone}</p>
                        </div>
                    )}

                    {selectedCustomerId && (
                        <div className="border rounded-xl overflow-hidden shadow-inner bg-card">
                            <Table className="text-sm">
                                <TableHeader className="bg-muted/50">
                                    <TableRow className="text-xs uppercase font-black">
                                        <TableHead className="w-[120px]">Storage ID</TableHead>
                                        <TableHead>Commodity</TableHead>
                                        <TableHead>Lot</TableHead>
                                        <TableHead className="text-right">Active Stock</TableHead>
                                        <TableHead className="w-[120px] text-right">Withdraw</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredRecords.length > 0 ? filteredRecords.map(record => (
                                        <TableRow key={record.id} className="hover:bg-primary/5 transition-colors border-b">
                                            <TableCell className="font-mono font-bold text-primary">{record.id}</TableCell>
                                            <TableCell className="font-medium">{record.commodityDescription}</TableCell>
                                            <TableCell className="font-mono text-slate-500">{record.location}</TableCell>
                                            <TableCell className="text-right font-mono font-black">{record.bagsStored}</TableCell>
                                            <TableCell className="p-1">
                                                <Input
                                                    type="number"
                                                    step="0.01"
                                                    placeholder="0"
                                                    min="0"
                                                    max={record.bagsStored}
                                                    value={withdrawals[record.id] || ''}
                                                    onChange={(e) => handleWithdrawalChange(record.id, e.target.value, record.bagsStored)}
                                                    className="text-right font-mono font-black h-9 border-none focus-visible:ring-0 bg-secondary/50 rounded-lg"
                                                />
                                            </TableCell>
                                        </TableRow>
                                    )) : (
                                        <TableRow>
                                            <TableCell colSpan={5} className="text-center h-24 text-muted-foreground italic">
                                                No active godown inventory found for this depositor.
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
                                <Label htmlFor="withdrawalDate" className="text-[10px] font-black uppercase tracking-widest text-slate-400">Withdrawal Date</Label>
                                <Input 
                                    id="withdrawalDate" 
                                    name="withdrawalDate" 
                                    type="date"
                                    value={withdrawalDateStr}
                                    required
                                    onChange={(e) => setWithdrawalDateStr(e.target.value)}
                                    className="h-10 font-bold"
                                    />
                            </div>
                            <Separator />

                            {totalRent === 0 && totalBags > 0 && (
                                <Alert variant="destructive" className="bg-destructive/5 rounded-xl border-dashed">
                                    <AlertTriangle className="h-4 w-4" />
                                    <AlertTitle className="text-xs font-black uppercase">Rate Synchronization Warning</AlertTitle>
                                    <AlertDescription className="text-[11px] font-medium leading-relaxed">
                                        Calculated rent is ₹0.00. This happens if crop rates are missing or names mismatch. Please verify crop configuration in Settings.
                                    </AlertDescription>
                                </Alert>
                            )}

                            <div className="space-y-4 p-4 rounded-2xl bg-secondary/10 border">
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Patti Billing Summary</h4>
                                <div className="space-y-3 text-sm">
                                    <div className="flex justify-between items-center">
                                        <span className="text-muted-foreground font-medium">Bags Selected for Outflow</span>
                                        <span className="font-mono font-black text-lg">{totalBags}</span>
                                    </div>
                                    <div className={`flex justify-between items-center ${totalRent > 0 ? 'text-primary' : 'text-destructive font-bold'}`}>
                                        <span className="font-medium">Accrued Storage Rent</span>
                                        <span className="font-mono font-black">{formatCurrency(totalRent)}</span>
                                    </div>
                                     <div className="flex justify-between items-center text-orange-600">
                                        <span className="font-medium">Unpaid Handling Charges (Hamali)</span>
                                        <span className="font-mono font-black">{formatCurrency(totalPendingHamali)}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                                <div className="space-y-1.5">
                                    <Label htmlFor="khataAmountInput" className="text-[10px] font-black uppercase tracking-widest text-slate-400">Khata Amount (Weighbridge)</Label>
                                    <Input
                                        id="khataAmountInput"
                                        name="khataAmountInput"
                                        type="number"
                                        placeholder="0.00"
                                        step="0.01"
                                        value={khataAmountInput}
                                        onChange={e => setKhataAmountInput(e.target.value === '' ? '' : Number(e.target.value))}
                                        className="h-10 font-mono font-bold"
                                    />
                                    <p className="text-[9px] font-bold text-muted-foreground uppercase">Original Record Default: {formatCurrency(totalKhataFromRecords)}</p>
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="discount" className="text-[10px] font-black uppercase tracking-widest text-slate-400">Patti Discount</Label>
                                    <Input
                                        id="discount"
                                        name="discount"
                                        type="number"
                                        placeholder="0.00"
                                        step="0.01"
                                        value={discount}
                                        onChange={e => setDiscount(e.target.value === '' ? '' : Number(e.target.value))}
                                        disabled={isMultiLotWithdrawal}
                                        className="h-10 font-mono font-bold text-green-600"
                                    />
                                </div>
                            </div>

                            <Separator className="my-2"/>

                            <div className="space-y-5 pt-2">
                                <div className="flex justify-between items-center">
                                    <span className="font-black text-2xl uppercase tracking-tighter text-slate-900">Total Payable</span>
                                    <span className="font-mono font-black text-2xl text-primary">{formatCurrency(totalPayable)}</span>
                                </div>
                                
                                <div className="space-y-1.5 p-5 bg-primary/5 rounded-2xl border-2 border-primary/20">
                                    <Label htmlFor="amountPaidNow" className="text-xs font-black uppercase tracking-widest text-primary">Cash Collected Now (Receipt)</Label>
                                    <Input
                                        id="amountPaidNow"
                                        name="amountPaidNow"
                                        type="number"
                                        placeholder="Enter amount collected..."
                                        step="0.01"
                                        value={amountPaidNow}
                                        onChange={e => setAmountPaidNow(e.target.value === '' ? '' : Number(e.target.value))}
                                        max={totalPayable > 0 ? totalPayable.toFixed(2) : undefined}
                                        disabled={isMultiLotWithdrawal}
                                        className="h-12 text-lg font-mono font-black bg-white shadow-inner border-primary/30"
                                    />
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase leading-relaxed mt-2">
                                        {isMultiLotWithdrawal ? "Direct cash logging disabled for combined withdrawals." : "Leave blank to record as credit dues."}
                                    </p>
                                </div>
                            </div>
                             <div className="flex items-center space-x-2 pt-4 bg-slate-50 p-4 rounded-xl">
                                <Checkbox 
                                    id="sendSmsOutflow" 
                                    checked={sendSmsNotification}
                                    onCheckedChange={(checked) => setSendSmsNotification(Boolean(checked))}
                                    disabled={!warehouseInfo?.textbeeApiKey || !selectedCustomer?.phone}
                                />
                                <label
                                    htmlFor="sendSmsOutflow"
                                    className="text-xs font-black uppercase tracking-wider cursor-pointer"
                                >
                                    Transmit SMS Receipt to Customer
                                </label>
                            </div>
                        </>
                    )}
                </CardContent>
                <CardFooter className="pb-8">
                    <SubmitButton isPending={isPending} disabled={withdrawalEntries.length === 0} />
                </CardFooter>
            </Card>
        </form>
    </div>
  );
}
