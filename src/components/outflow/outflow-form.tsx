'use client';

import { useEffect, useState, useTransition, useMemo } from 'react';
import { useFirestore, useAppUser } from '@/firebase';
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

export function OutflowForm({ records = [], customers = [], commodities = [] }: { records: StorageRecord[], customers: Customer[], commodities: Commodity[] }) {
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

    const customerOptions = useMemo(() => (customers || []).map(c => ({ value: c.id, label: c.name })), [customers]);

    const filteredRecordsWithBalance = useMemo(() => {
        if (!selectedCustomerId) return [];
        return (records || [])
            .filter(r => r.customerId === selectedCustomerId)
            .map(r => {
                // ROBUST HISTORICAL CALCULATION
                const bagsOut = (Array.isArray(r.outflows)) ? r.outflows.reduce((acc, o) => acc + (Number(o.bagsWithdrawn) || 0), 0) : (Number(r.bagsOut) || 0);
                const initialInflow = Number(r.bagsIn) || (Number(r.bagsStored || 0) + bagsOut);
                const currentBalance = Math.max(0, initialInflow - bagsOut);
                return { ...r, currentBalance, initialInflow };
            })
            .filter(r => r.currentBalance > 0.5);
    }, [records, selectedCustomerId]);

    const selectedCustomer = useMemo(() => 
        (customers || []).find(c => c.id === selectedCustomerId)
    , [customers, selectedCustomerId]);

    const withdrawalEntries = useMemo(() => 
        Object.entries(withdrawals || {}).filter(([, bags]) => Number(bags) > 0),
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

        withdrawalEntries.forEach(([recordId, bags]) => {
            const bagsToWithdraw = Number(bags) || 0;
            const record = filteredRecordsWithBalance.find(r => r.id === recordId);
            if (record) {
                let recordWithRates: StorageRecord = { ...record };
                
                const normalizedDesc = (record.commodityDescription || '').trim().toLowerCase();
                const commodity = (commodities || []).find(c => (c.name || '').trim().toLowerCase() === normalizedDesc);

                if (record.rate6Months === undefined || record.rate1Year === undefined || record.monthlyRate === undefined) {
                    if (commodity) {
                        recordWithRates.rate6Months = commodity.rate6Months ?? 0;
                        recordWithRates.rate1Year = commodity.rate1Year ?? 0;
                        recordWithRates.billingType = commodity.billingType || 'slab';
                        recordWithRates.monthlyRate = commodity.monthlyRate ?? 0;
                        recordWithRates.minBillingMonths = commodity.minBillingMonths ?? 0;
                        recordWithRates.insuranceRate = commodity.insuranceRate ?? 0;
                    }
                }

                const { rent } = calculateFinalRent({ ...recordWithRates, storageStartDate: toDate(recordWithRates.storageStartDate) }, wDate, bagsToWithdraw);
                runningRent += (rent || 0);
                
                if (!processedRecords.has(recordId)) {
                    const payments = Array.isArray(record.payments) ? record.payments : [];
                    const hamaliPaid = payments.filter(p => p.type === 'hamali' || p.type === 'unloading').reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
                    const pendingHamali = (Number(record.hamaliPayable) || 0) - hamaliPaid;
                    runningHamali += Math.max(0, pendingHamali);
                    runningKhata += (Number(record.khataAmount) || 0);
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
    }, [withdrawals, withdrawalDateStr, filteredRecordsWithBalance, commodities, khataAmountInput, withdrawalEntries]);

    const resetForm = () => {
        setSelectedCustomerId('');
        setWithdrawals({});
        setAmountPaidNow('');
        setDiscount('');
        setKhataAmountInput('');
        setWithdrawalDateStr(new Date().toISOString().split('T')[0]);
    }
    
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
                
                let firstReceiptUrl: string | null = null;

                for (const record of filteredRecordsWithBalance) {
                    const bagsToWithdraw = Number(withdrawals[record.id]) || 0;
                    if (bagsToWithdraw <= 0) continue;

                    let recordWithRates: StorageRecord = { ...record };
                    const normalizedDesc = (record.commodityDescription || '').trim().toLowerCase();
                    const commodity = (commodities || []).find(c => (c.name || '').trim().toLowerCase() === normalizedDesc);

                    if (record.rate6Months === undefined || record.rate1Year === undefined || record.monthlyRate === undefined) {
                        if (commodity) {
                            recordWithRates.rate6Months = commodity.rate6Months ?? 0;
                            recordWithRates.rate1Year = commodity.rate1Year ?? 0;
                            recordWithRates.billingType = commodity.billingType || 'slab';
                            recordWithRates.monthlyRate = commodity.monthlyRate ?? 0;
                            recordWithRates.minBillingMonths = commodity.minBillingMonths ?? 0;
                            recordWithRates.insuranceRate = commodity.insuranceRate ?? 0;
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
                    const newBagsOut = currentBagsOut + bagsToWithdraw;
                    const newBagsStored = Math.max(0, Number(record.initialInflow) - newBagsOut);

                    const updateData: any = {
                        bagsOut: newBagsOut,
                        bagsStored: newBagsStored,
                        totalRentBilled: (Number(record.totalRentBilled) || 0) + (rentForThisWithdrawal || 0),
                        outflows: arrayUnion(cleanForFirestore(newOutflow)),
                    };

                    if (!isMultiLotWithdrawal) {
                        updateData.khataAmount = khataAmount;
                    }

                    if (newBagsStored <= 0.001) {
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

                    if (!firstReceiptUrl) {
                        const qp = new URLSearchParams();
                        qp.set('recordId', record.id);
                        qp.set('withdrawn', String(bagsToWithdraw));
                        qp.set('rent', String(rentForThisWithdrawal || 0));
                        qp.set('paidNow', String(isMultiLotWithdrawal ? 0 : paidNow));
                        qp.set('discount', String(isMultiLotWithdrawal ? 0 : discountAmount));
                        qp.set('khata', String(khataAmount));
                        firstReceiptUrl = `/outflow/receipt?${qp.toString()}`;
                    }
                }
                
                await batch.commit();

                if (sendSmsNotification && warehouseInfo?.textbeeApiKey && selectedCustomer?.phone) {
                    const template = warehouseInfo?.smsOutflowTemplate || `Dear {customerName}, withdrawal of {bags} bags recorded. Bill: {billNo}. Thank you.`;
                    let billIdentifier = withdrawalEntries.length === 1 ? `${withdrawalEntries[0][0]}-${(filteredRecordsWithBalance.find(r => r.id === withdrawalEntries[0][0])?.outflows?.length || 0) + 1}` : 'Multi-Lot';
                    const msg = template.replace('{customerName}', selectedCustomer.name).replace('{bags}', String(totalBags)).replace('{billNo}', billIdentifier);
                    sendSms({ apiKey: warehouseInfo.textbeeApiKey, deviceId: warehouseInfo.textbeeDeviceId, to: selectedCustomer.phone, message: msg }).catch(console.error);
                }

                toast({ title: 'Success', description: `Withdrawal processed for ${totalBags} bags.` });
                resetForm();
                if (firstReceiptUrl) window.open(firstReceiptUrl, '_blank');

            } catch (error: any) {
                console.error("Outflow failed:", error);
                toast({ title: 'Error', description: error.message || 'Failed to process outflow.', variant: 'destructive' });
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
                            onChange={setSelectedCustomerId}
                            placeholder="Select a customer..."
                            searchPlaceholder="Search customers..."
                        />
                    </div>
                    
                    {selectedCustomerId && (
                        <div className="border rounded-xl overflow-hidden shadow-inner bg-card">
                            <Table className="text-sm">
                                <TableHeader className="bg-muted/50">
                                    <TableRow className="text-xs uppercase font-black">
                                        <TableHead className="w-[120px]">Storage ID</TableHead>
                                        <TableHead>Commodity</TableHead>
                                        <TableHead>Lot</TableHead>
                                        <TableHead className="text-right">Balance Bags</TableHead>
                                        <TableHead className="w-[120px] text-right">Withdraw</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredRecordsWithBalance.length > 0 ? filteredRecordsWithBalance.map(record => (
                                        <TableRow key={record.id} className="hover:bg-primary/5 transition-colors border-b">
                                            <TableCell className="font-mono font-bold text-primary">{record.id}</TableCell>
                                            <TableCell className="font-medium">{record.commodityDescription}</TableCell>
                                            <TableCell className="font-mono text-slate-500">{record.location}</TableCell>
                                            <TableCell className="text-right font-mono font-black">{record.currentBalance}</TableCell>
                                            <TableCell className="p-1">
                                                <Input
                                                    type="number"
                                                    step="0.01"
                                                    placeholder="0"
                                                    min="0"
                                                    max={record.currentBalance}
                                                    value={withdrawals[record.id] || ''}
                                                    onChange={(e) => {
                                                        const v = e.target.value === '' ? '' : Number(e.target.value);
                                                        if (v === '' || (v >= 0 && v <= record.currentBalance + 0.01)) {
                                                            setWithdrawals(prev => ({ ...prev, [record.id]: v }));
                                                        }
                                                    }}
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

                            <div className="space-y-4 p-4 rounded-2xl bg-secondary/10 border">
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Patti Billing Summary</h4>
                                <div className="space-y-3 text-sm">
                                    <div className="flex justify-between items-center">
                                        <span className="text-muted-foreground font-medium">Bags for Outflow</span>
                                        <span className="font-mono font-black text-lg">{totalBags}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-primary">
                                        <span className="font-medium">Accrued Storage Rent</span>
                                        <span className="font-mono font-black">{formatCurrency(totalRent)}</span>
                                    </div>
                                     <div className="flex justify-between items-center text-orange-600">
                                        <span className="font-medium">Unpaid Handling (Hamali)</span>
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
                                    <Label htmlFor="amountPaidNow" className="text-xs font-black uppercase tracking-widest text-primary">Cash Collected Now</Label>
                                    <Input
                                        id="amountPaidNow"
                                        name="amountPaidNow"
                                        type="number"
                                        placeholder="Enter amount collected..."
                                        step="0.01"
                                        value={amountPaidNow}
                                        onChange={e => setAmountPaidNow(e.target.value === '' ? '' : Number(e.target.value))}
                                        disabled={isMultiLotWithdrawal}
                                        className="h-12 text-lg font-mono font-black bg-white shadow-inner border-primary/30"
                                    />
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
                                    Transmit SMS Receipt
                                </label>
                            </div>
                        </>
                    )}
                </CardContent>
                <CardFooter className="pb-8">
                    <Button type="submit" disabled={isPending || withdrawalEntries.length === 0} className="w-full h-12 font-black uppercase tracking-widest">
                        {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Generate Patti Bill'}
                    </Button>
                </CardFooter>
            </Card>
        </form>
    </div>
  );
}
