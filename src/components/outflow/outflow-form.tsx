
'use client';

import { useEffect, useState, useTransition, useMemo } from 'react';
import { useFirestore, useAppUser } from '@/firebase';
import { doc, arrayUnion, writeBatch, Timestamp } from 'firebase/firestore';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { Customer, StorageRecord, Payment, Outflow, WarehouseInfo, Commodity, UnloadingRecord } from '@/lib/definitions';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Sparkles } from 'lucide-react';
import { Separator } from '../ui/separator';
import { calculateFinalRent } from '@/lib/billing';
import { format } from 'date-fns';
import { toDate, cleanForFirestore, formatCurrency } from '@/lib/utils';
import { Combobox } from '../ui/combobox';
import { useDoc } from '@/firebase/firestore/use-doc';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { Checkbox } from '@/components/ui/checkbox';
import { sendSms } from '@/lib/sms';

export function OutflowForm({ 
    activeRecords = [], 
    allRecords = [], 
    unloadingRecords = [],
    customers = [], 
    commodities = [] 
}: { 
    activeRecords: StorageRecord[], 
    allRecords: StorageRecord[], 
    unloadingRecords: UnloadingRecord[],
    customers: Customer[], 
    commodities: Commodity[] 
}) {
    const { toast } = useToast();
    const firestore = useFirestore();
    const appUser = useAppUser();
    const [isPending, startTransition] = useTransition();
    const [sendSmsNotification, setSendSmsNotification] = useState(false);
    
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

    // Calculate Global Serialized Bill No
    const nextBillNo = useMemo(() => {
        let max = 1000;
        
        // 1. Check all Storage Records & Outflow Pattis
        allRecords.forEach(r => {
            const idNum = parseInt(String(r.id).replace(/\D/g, ''), 10);
            if (!isNaN(idNum) && idNum > max) max = idNum;

            if (Array.isArray(r.outflows)) {
                r.outflows.forEach(o => {
                    const num = parseInt(String(o.pattiNo || '0').replace(/\D/g, ''), 10);
                    if (!isNaN(num) && num > max) max = num;
                });
            }
        });

        // 2. Check all Unloading Bills
        unloadingRecords.forEach(ur => {
            const billNum = parseInt(String(ur.billNo || ur.id).replace(/\D/g, ''), 10);
            if (!isNaN(billNum) && billNum > max) max = billNum;
        });

        return max + 1;
    }, [allRecords, unloadingRecords]);

    const customerOptions = useMemo(() => (customers || []).map(c => ({ value: c.id, label: c.name })), [customers]);

    const filteredRecordsWithBalance = useMemo(() => {
        if (!selectedCustomerId) return [];
        return (activeRecords || [])
            .filter(r => r.customerId === selectedCustomerId)
            .map(r => {
                const bagsOutSum = Array.isArray(r.outflows) 
                    ? r.outflows.reduce((acc, o) => acc + (Number(o.bagsWithdrawn) || 0), 0) 
                    : (Number(r.bagsOut) || 0);
                
                const initialInflow = Number(r.bagsIn) || (Number(r.bagsStored || 0) + bagsOutSum);
                const currentBalance = Math.max(0, initialInflow - bagsOutSum);
                
                return { ...r, currentBalance, initialInflow, historyBagsOut: bagsOutSum };
            })
            .filter(r => r.currentBalance > 0.1);
    }, [activeRecords, selectedCustomerId]);

    const selectedCustomer = useMemo(() => 
        (customers || []).find(c => c.id === selectedCustomerId)
    , [customers, selectedCustomerId]);

    const withdrawalEntries = useMemo(() => 
        Object.entries(withdrawals || {}).filter(([, bags]) => Number(bags) > 0),
        [withdrawals]
    );

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
        const wDate = toDate(withdrawalDateStr);

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
        const finalDate = toDate(withdrawalDateStr);
        if (!firestore || withdrawalEntries.length === 0) {
            toast({ title: 'Input Required', description: 'Please enter bags for withdrawal.', variant: 'destructive' });
            return;
        }

        startTransition(async () => {
            try {
                const batch = writeBatch(firestore);
                const sharedBillNo = String(nextBillNo); 
                
                const discountTotal = Number(discount) || 0;
                const khataTotal = Number(khataAmountInput) || 0;
                const paymentTotal = Number(amountPaidNow) || 0;

                const entriesToProcess = filteredRecordsWithBalance.filter(r => (Number(withdrawals[r.id]) || 0) > 0);

                for (let i = 0; i < entriesToProcess.length; i++) {
                    const record = entriesToProcess[i];
                    const bagsToWithdraw = Number(withdrawals[record.id]);

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

                    const { rent } = calculateFinalRent({ ...recordWithRates, storageStartDate: toDate(recordWithRates.storageStartDate) }, finalDate, bagsToWithdraw);
                    
                    const d = i === 0 ? discountTotal : 0;
                    const k = i === 0 ? khataTotal : 0;
                    const p = i === 0 ? paymentTotal : 0;

                    const newOutflow: Outflow = {
                        date: finalDate,
                        bagsWithdrawn: bagsToWithdraw,
                        rentBilled: rent || 0,
                        discount: d,
                        pattiNo: sharedBillNo, 
                    };

                    const accurateCurrentBagsOut = (record as any).historyBagsOut;
                    const newTotalBagsOut = accurateCurrentBagsOut + bagsToWithdraw;
                    const newBagsStored = Math.max(0, record.initialInflow - newTotalBagsOut);

                    const updateData: any = {
                        bagsOut: newTotalBagsOut,
                        bagsStored: newBagsStored,
                        totalRentBilled: (Number(record.totalRentBilled) || 0) + (rent || 0),
                        outflows: arrayUnion(cleanForFirestore(newOutflow)),
                    };

                    if (i === 0) updateData.khataAmount = k;

                    if (newBagsStored <= 0.05) {
                        updateData.storageEndDate = Timestamp.fromDate(finalDate);
                        updateData.billingCycle = 'Completed';
                    } else {
                        updateData.storageEndDate = null;
                    }
                    
                    if (p > 0) {
                        const newPayment: Partial<Payment> = { amount: p, date: finalDate, type: 'rent' };
                        updateData.payments = arrayUnion(cleanForFirestore(newPayment));
                    }
                    
                    batch.update(doc(firestore, 'storageRecords', record.id), cleanForFirestore(updateData));
                }
                
                await batch.commit();

                if (sendSmsNotification && warehouseInfo?.textbeeApiKey && selectedCustomer?.phone) {
                    const msg = `Dear ${selectedCustomer.name}, withdrawal of ${totalBags} bags processed. Bill No: ${sharedBillNo}. Total: ${formatCurrency(totalPayable)}.`;
                    sendSms({ apiKey: warehouseInfo.textbeeApiKey, deviceId: warehouseInfo.textbeeDeviceId, to: selectedCustomer.phone, message: msg }).catch(console.error);
                }

                toast({ title: 'Success', description: `Outflow Bill #${sharedBillNo} generated.` });
                resetForm();
                window.open(`/outflow/receipt?pattiNo=${sharedBillNo}`, '_blank');
            } catch (error: any) {
                console.error("Outflow failed:", error);
                toast({ title: 'Error', description: 'Failed to process outflow bill.', variant: 'destructive' });
            }
        });
    }

  return (
    <div className="flex justify-center">
        <form onSubmit={handleSubmit} className="w-full max-w-3xl">
            <Card className="stylish-card border-primary/20 shadow-lg">
                <CardHeader className="bg-secondary/30">
                    <div className="flex justify-between items-start">
                        <div>
                            <CardTitle className="text-xl font-bold tracking-tight">Generate Global Serialized Bill</CardTitle>
                            <CardDescription className="text-xs font-medium text-slate-500">Shared sequence across all warehouse transactions.</CardDescription>
                        </div>
                        <div className="text-right">
                             <Label className="text-[9px] font-black uppercase text-primary/60 tracking-widest">Global Sequence</Label>
                             <div className="flex items-center gap-1.5 justify-end">
                                <Sparkles className="h-3 w-3 text-primary" />
                                <span className="font-mono font-black text-lg text-primary">#{nextBillNo}</span>
                             </div>
                        </div>
                    </div>
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
                            <Table className="text-[13px]">
                                <TableHeader className="bg-muted/50">
                                    <TableRow className="text-xs uppercase font-black">
                                        <TableHead className="w-[120px]">Inflow No.</TableHead>
                                        <TableHead>Lot</TableHead>
                                        <TableHead className="text-right">Balance</TableHead>
                                        <TableHead className="w-[120px] text-right">Withdraw</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredRecordsWithBalance.length > 0 ? filteredRecordsWithBalance.map(record => (
                                        <TableRow key={record.id} className="hover:bg-primary/5 transition-colors border-b">
                                            <TableCell className="font-mono font-bold text-primary">{record.id}</TableCell>
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
                                                        if (v === '' || (v >= 0 && v <= record.currentBalance + 0.1)) {
                                                            setWithdrawals(prev => ({ ...prev, [record.id]: v }));
                                                        }
                                                    }}
                                                    className="text-right font-mono font-black h-9 border-none focus-visible:ring-0 bg-secondary/50 rounded-lg"
                                                />
                                            </TableCell>
                                        </TableRow>
                                    )) : (
                                        <TableRow>
                                            <TableCell colSpan={4} className="text-center h-24 text-muted-foreground italic">
                                                No active Godown stock found for this customer.
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
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Transaction Summary (Bill #{nextBillNo})</h4>
                                <div className="space-y-3 text-sm">
                                    <div className="flex justify-between items-center">
                                        <span className="text-muted-foreground font-medium">Bags to Withdraw</span>
                                        <span className="font-mono font-black text-lg">{totalBags}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-primary">
                                        <span className="font-medium">Calculated Rent</span>
                                        <span className="font-mono font-black">{formatCurrency(totalRent)}</span>
                                    </div>
                                     <div className="flex justify-between items-center text-orange-600">
                                        <span className="font-medium">Unpaid Hamali</span>
                                        <span className="font-mono font-black">{formatCurrency(totalPendingHamali)}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                                <div className="space-y-1.5">
                                    <Label htmlFor="khataAmountInput" className="text-[10px] font-black uppercase tracking-widest text-slate-400">Khata (Weighbridge)</Label>
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
                                    <Label htmlFor="discount" className="text-[10px] font-black uppercase tracking-widest text-slate-400">Bill Discount</Label>
                                    <Input
                                        id="discount"
                                        name="discount"
                                        type="number"
                                        placeholder="0.00"
                                        step="0.01"
                                        value={discount}
                                        onChange={e => setDiscount(e.target.value === '' ? '' : Number(e.target.value))}
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
                                    <Label htmlFor="amountPaidNow" className="text-xs font-black uppercase tracking-widest text-primary">Cash Collected</Label>
                                    <Input
                                        id="amountPaidNow"
                                        name="amountPaidNow"
                                        type="number"
                                        placeholder="Enter amount paid..."
                                        step="0.01"
                                        value={amountPaidNow}
                                        onChange={e => setAmountPaidNow(e.target.value === '' ? '' : Number(e.target.value))}
                                        className="h-12 text-lg font-mono font-black bg-white shadow-inner border-primary/30"
                                    />
                                </div>
                            </div>
                        </>
                    )}
                </CardContent>
                <CardFooter className="pb-8">
                    <Button type="submit" disabled={isPending || withdrawalEntries.length === 0} className="w-full h-12 font-black uppercase tracking-widest">
                        {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : `Confirm Withdrawal (Bill #${nextBillNo})`}
                    </Button>
                </CardFooter>
            </Card>
        </form>
    </div>
  );
}
