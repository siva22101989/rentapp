'use client';

import { useTransition, useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import type { Customer, Payment, Commodity, Lot, StorageRecord, WarehouseInfo } from '@/lib/definitions';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Sparkles } from 'lucide-react';
import { Separator } from '../ui/separator';
import { formatCurrency, cleanForFirestore } from '@/lib/utils';
import { useFirestore } from '@/firebase/provider';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { Combobox } from '../ui/combobox';
import { useAppUser } from '@/firebase/auth/use-user';
import { useDoc } from '@/firebase/firestore/use-doc';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { Checkbox } from '@/components/ui/checkbox';
import { sendSms } from '@/lib/sms';
import { format } from 'date-fns';

export function InflowForm({ customers, commodities, lots, records, nextId }: { customers: Customer[], commodities: Commodity[], lots: Lot[], records: StorageRecord[], nextId: string }) {
    const { toast } = useToast();
    const firestore = useFirestore();
    const appUser = useAppUser();
    const [isPending, startTransition] = useTransition();
    const [sendSmsNotification, setSendSmsNotification] = useState(true);

    const [bags, setBags] = useState<number | ''>('');
    const [customerRate, setCustomerRate] = useState<number | ''>('');
    const [workerRate, setWorkerRate] = useState<number | ''>('');
    
    // New Manual Override States
    const [hamaliPayableOverride, setHamaliPayableOverride] = useState<number | ''>('');
    const [workerPayableOverride, setWorkerPayableOverride] = useState<number | ''>('');

    const [hamaliPaid, setHamaliPaid] = useState<number | ''>('');
    const [selectedCustomerId, setSelectedCustomerId] = useState('');
    const [selectedCommodity, setSelectedCommodity] = useState('');
    const [weight, setWeight] = useState<number | ''>('');
    const [khataAmount, setKhataAmount] = useState<number | ''>('');
    const [selectedLot, setSelectedLot] = useState('');
    const [lorryTractorNo, setLorryTractorNo] = useState('');
    const [storageStartDate, setStorageStartDate] = useState(new Date().toISOString().split('T')[0]);

    const [storageId, setStorageId] = useState(String(nextId).replace(/\D/g, ''));

    useEffect(() => {
        setStorageId(String(nextId).replace(/\D/g, ''));
    }, [nextId]);

    // Sync manual fields when rate or bags change (Auto-calculate)
    useEffect(() => {
        const b = Number(bags) || 0;
        const cR = Number(customerRate) || 0;
        const wR = Number(workerRate) || cR;
        setHamaliPayableOverride(b * cR);
        setWorkerPayableOverride(b * wR);
    }, [bags, customerRate, workerRate]);

    const warehouseInfoRef = useMemoFirebase(
      () => (firestore && appUser?.warehouseId ? doc(firestore, 'warehouses', appUser.warehouseId) : null),
      [firestore, appUser]
    );
    const { data: warehouseInfo } = useDoc<WarehouseInfo>(warehouseInfoRef);

    const customerOptions = customers.map(c => ({ value: c.id, label: c.name }));
    const commodityOptions = commodities.map(c => ({ value: c.name, label: c.name }));

    const lotOccupancy = useMemo(() => {
        const occupancy: { [lotName: string]: number } = {};
        records.forEach(record => {
            if (record.location && record.bagsStored > 0) {
                occupancy[record.location] = (occupancy[record.location] || 0) + record.bagsStored;
            }
        });
        return occupancy;
    }, [records]);
    
    const lotOptions = useMemo(() => {
        return lots
            .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
            .map(lot => {
                const occupied = lotOccupancy[lot.name] || 0;
                return ({ value: lot.name, label: `${lot.name} (${occupied} bags)` })
            });
    }, [lots, lotOccupancy]);

    const selectedCustomer = useMemo(() => customers.find(c => c.id === selectedCustomerId), [selectedCustomerId, customers]);

    const resetForm = () => {
        setBags('');
        setCustomerRate('');
        setWorkerRate('');
        setHamaliPayableOverride('');
        setWorkerPayableOverride('');
        setHamaliPaid('');
        setSelectedCustomerId('');
        setSelectedCommodity('');
        setWeight('');
        setKhataAmount('');
        setSelectedLot('');
        setLorryTractorNo('');
        setStorageStartDate(new Date().toISOString().split('T')[0]);
    };
    
    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const cleanId = String(storageId).replace(/\D/g, '');
        if (!firestore || !appUser?.warehouseId || !cleanId || !selectedCustomerId || !selectedCommodity) {
            toast({ title: 'Error', description: 'Required fields missing.', variant: 'destructive' });
            return;
        }

        startTransition(async () => {
            try {
                const existingSnap = await getDoc(doc(firestore, 'storageRecords', cleanId));
                if (existingSnap.exists()) {
                    toast({ title: 'Duplicate ID', description: `ID #${cleanId} already exists.`, variant: 'destructive' });
                    return;
                }

                const finalDate = new Date(storageStartDate);
                const custRate = Number(customerRate) || 0;
                
                // Use override values
                const hPayable = Number(hamaliPayableOverride) || 0;
                const wPayable = Number(workerPayableOverride) || hPayable;

                const payments: Payment[] = [];
                if (Number(hamaliPaid) > 0) payments.push({ amount: Number(hamaliPaid), date: finalDate, type: 'hamali' });

                const commodityDetails = commodities.find(c => c.name === selectedCommodity);
                
                const rawRecord = {
                    warehouseId: appUser.warehouseId,
                    customerId: selectedCustomerId,
                    commodityDescription: selectedCommodity,
                    location: selectedLot,
                    bagsIn: Number(bags),
                    bagsOut: 0,
                    bagsStored: Number(bags),
                    storageStartDate: finalDate,
                    storageEndDate: null,
                    billingCycle: '6-Month Initial',
                    payments,
                    hamaliPayable: hPayable,
                    hamaliRate: custRate,
                    workerHamaliPayable: wPayable,
                    totalRentBilled: 0,
                    lorryTractorNo,
                    weight: Number(weight) || 0,
                    inflowType: 'Direct',
                    khataAmount: Number(khataAmount) || 0,
                    billingType: commodityDetails?.billingType || 'slab',
                    monthlyRate: commodityDetails?.monthlyRate,
                    minBillingMonths: commodityDetails?.minBillingMonths,
                    insuranceRate: commodityDetails?.insuranceRate,
                    rate6Months: commodityDetails?.rate6Months,
                    rate1Year: commodityDetails?.rate1Year,
                };

                await setDoc(doc(firestore, "storageRecords", cleanId), cleanForFirestore(rawRecord));

                if (sendSmsNotification && warehouseInfo?.textbeeApiKey && selectedCustomer?.phone) {
                    const msg = (warehouseInfo.smsInflowTemplate || `Dear {customerName}, inflow of {bags} bags of {commodity} recorded. Bill: {billNo}.`)
                        .replace('{customerName}', selectedCustomer.name)
                        .replace('{bags}', String(bags))
                        .replace('{commodity}', selectedCommodity)
                        .replace('{billNo}', cleanId)
                        .replace('{date}', format(finalDate, 'dd/MM/yy'));
                    sendSms({ apiKey: warehouseInfo.textbeeApiKey, deviceId: warehouseInfo.textbeeDeviceId, to: selectedCustomer.phone, message: msg }).catch(console.error);
                }
                
                toast({ title: 'Success', description: 'Record created.' });
                resetForm();
                window.open(`/inflow/receipt?recordId=${cleanId}`, '_blank');
            } catch (error) {
                toast({ title: 'Error', description: 'Failed to create record.', variant: 'destructive' });
            }
        });
    }

  return (
    <div className="flex justify-center">
        <form onSubmit={handleSubmit} className="w-full max-w-lg">
            <Card className="stylish-card">
                <CardHeader>
                    <CardTitle className="text-lg font-bold">New Storage Record Details</CardTitle>
                    <CardDescription className="text-xs">Identifier is strictly numerical.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                     <div className="space-y-1.5">
                        <Label className="flex items-center gap-2 text-xs font-semibold">
                            Storage ID (Numerical)
                            <Badge variant="outline" className="text-[9px] uppercase font-bold py-0 h-4 bg-primary/5 text-primary">
                                <Sparkles className="h-2 w-2 mr-1" /> Auto-Generated
                            </Badge>
                        </Label>
                        <Input className="font-mono font-bold bg-muted/50 text-sm h-9" value={storageId} readOnly />
                    </div>
                     <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">Customer</Label>
                        <Combobox options={customerOptions} value={selectedCustomerId} onChange={setSelectedCustomerId} placeholder="Select a customer..." modal={true} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold">Product</Label>
                             <Combobox options={commodityOptions} value={selectedCommodity} onChange={setSelectedCommodity} placeholder="Select..." modal={true} />
                        </div>
                         <div className="space-y-1.5">
                            <Label className="text-xs font-semibold">Lot No.</Label>
                             <Combobox options={lotOptions} value={selectedLot} onChange={setSelectedLot} placeholder="Select..." modal={true} />
                        </div>
                    </div>
                     <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold">Vehicle No.</Label>
                            <Input placeholder="e.g. AP 21" value={lorryTractorNo} onChange={e => setLorryTractorNo(e.target.value)} className="text-sm h-9" />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold">Inflow Date</Label>
                            <Input type="date" value={storageStartDate} onChange={e => setStorageStartDate(e.target.value)} className="text-sm h-9" required />
                        </div>
                    </div>
                     <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold">No. of Bags</Label>
                            <Input type="number" step="0.01" required value={bags} onChange={e => setBags(e.target.value === '' ? '' : Number(e.target.value))} className="text-sm h-9" />
                        </div>
                         <div className="space-y-1.5">
                            <Label className="text-xs font-semibold">Weight (Kgs)</Label>
                            <Input type="number" step="0.01" value={weight} onChange={e => setWeight(e.target.value === '' ? '' : Number(e.target.value))} className="text-sm h-9" />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold">Cust Rate</Label>
                            <Input type="number" step="0.01" value={customerRate} onChange={e => setCustomerRate(e.target.value === '' ? '' : Number(e.target.value))} className="text-sm h-9" />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold">Worker Rate</Label>
                            <Input type="number" step="0.01" value={workerRate} onChange={e => setWorkerRate(e.target.value === '' ? '' : Number(e.target.value))} className="text-sm h-9" />
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold text-primary">Total Cust Hamali</Label>
                            <Input type="number" step="0.01" value={hamaliPayableOverride} onChange={e => setHamaliPayableOverride(e.target.value === '' ? '' : Number(e.target.value))} className="text-sm h-9 border-primary/50" />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold text-orange-600">Total Worker Payable</Label>
                            <Input type="number" step="0.01" value={workerPayableOverride} onChange={e => setWorkerPayableOverride(e.target.value === '' ? '' : Number(e.target.value))} className="text-sm h-9 border-orange-400" />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold">Paid Now</Label>
                            <Input type="number" step="0.01" value={hamaliPaid} onChange={e => setHamaliPaid(e.target.value === '' ? '' : Number(e.target.value))} className="text-sm h-9" />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold">Khata Amount</Label>
                            <Input type="number" step="0.01" value={khataAmount} onChange={e => setKhataAmount(e.target.value === '' ? '' : Number(e.target.value))} className="text-sm h-9" />
                        </div>
                    </div>
                     <Separator />
                     <div className="space-y-2 text-sm">
                        <div className="flex justify-between font-bold">
                            <span className="text-destructive uppercase text-[10px]">Net Balance (Customer)</span>
                            <span className="font-mono text-destructive">{formatCurrency((Number(hamaliPayableOverride) || 0) - (Number(hamaliPaid) || 0))}</span>
                        </div>
                    </div>
                     <div className="flex items-center space-x-2 pt-2">
                        <Checkbox id="sms" checked={sendSmsNotification} onCheckedChange={(c) => setSendSmsNotification(Boolean(c))} disabled={!warehouseInfo?.textbeeApiKey || !selectedCustomer?.phone} />
                        <label htmlFor="sms" className="text-xs font-medium cursor-pointer">Send SMS Notification</label>
                    </div>
                </CardContent>
                <CardFooter>
                    <Button type="submit" disabled={isPending} className="w-full text-sm">
                        {isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : 'Create Storage Record'}
                    </Button>
                </CardFooter>
            </Card>
        </form>
    </div>
  );
}
