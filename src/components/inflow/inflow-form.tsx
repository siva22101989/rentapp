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
import { formatCurrency, cleanForFirestore, toDate } from '@/lib/utils';
import { useFirestore } from '@/firebase/provider';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { Combobox } from '../ui/combobox';
import { useAppUser } from '@/firebase/auth/use-user';
import { useDoc } from '@/firebase/firestore/use-doc';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { Checkbox } from '@/components/ui/checkbox';
import { sendSms } from '@/lib/sms';
import { format } from 'date-fns';

function SubmitButton({ isPending }: { isPending: boolean }) {
    return (
      <Button type="submit" disabled={isPending} className="w-full text-sm">
        {isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Saving...
          </>
        ) : (
          'Create Storage Record'
        )}
      </Button>
    );
}

export function InflowForm({ customers, commodities, lots, records }: { customers: Customer[], commodities: Commodity[], lots: Lot[], records: StorageRecord[] }) {
    const { toast } = useToast();
    const firestore = useFirestore();
    const appUser = useAppUser();
    const [isPending, startTransition] = useTransition();
    const [sendSmsNotification, setSendSmsNotification] = useState(true);

    const [bags, setBags] = useState<number | ''>('');
    const [customerRate, setCustomerRate] = useState<number | ''>('');
    const [workerRate, setWorkerRate] = useState<number | ''>('');
    const [hamaliPaid, setHamaliPaid] = useState<number | ''>('');
    const [selectedCustomerId, setSelectedCustomerId] = useState('');
    const [selectedCommodity, setSelectedCommodity] = useState('');
    const [weight, setWeight] = useState<number | ''>('');
    const [khataAmount, setKhataAmount] = useState<number | ''>('');
    const [selectedLot, setSelectedLot] = useState('');
    const [lorryTractorNo, setLorryTractorNo] = useState('');
    const [storageStartDate, setStorageStartDate] = useState(new Date().toISOString().split('T')[0]);

    const generatedId = useMemo(() => {
        if (!records || records.length === 0) return 'S-1001';
        const maxId = records.reduce((max, r) => {
            const idNum = parseInt(r.id.replace(/[^0-9]/g, ''), 10);
            return isNaN(idNum) ? max : Math.max(max, idNum);
        }, 0);
        return `S-${Math.max(1001, maxId + 1)}`;
    }, [records]);

    const [storageId, setStorageId] = useState(generatedId);

    useEffect(() => {
        setStorageId(generatedId);
    }, [generatedId]);

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
                const capacity = lot.capacity ? ` / ${lot.capacity}` : '';
                return ({
                    value: lot.name,
                    label: `${lot.name} (${occupied}${capacity} bags)`
                })
            });
    }, [lots, lotOccupancy]);

    const selectedCustomer = useMemo(() => {
        return customers.find(c => c.id === selectedCustomerId);
    }, [selectedCustomerId, customers]);


    const { customerHamali } = useMemo(() => {
        const bagsValue = Number(bags) || 0;
        const custRateValue = Number(customerRate) || 0;
        return {
            customerHamali: bagsValue * custRateValue
        }
    }, [bags, customerRate]);

    const resetForm = () => {
        setBags('');
        setCustomerRate('');
        setWorkerRate('');
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
        if (!firestore || !appUser?.warehouseId) {
            toast({ title: 'Error', description: 'Context missing.', variant: 'destructive' });
            return;
        }

        if (!storageId) {
            toast({ title: 'Error', description: 'Storage ID is required.', variant: 'destructive' });
            return;
        }

        const bagsValue = Number(bags);
        if (!bagsValue || bagsValue <= 0) {
             toast({ title: 'Error', description: 'Number of bags must be positive.', variant: 'destructive' });
             return;
        }
        if (!selectedCustomerId) {
            toast({ title: 'Error', description: 'Please select a customer.', variant: 'destructive' });
            return;
        }
        if (!selectedCommodity) {
            toast({ title: 'Error', description: 'Please select a product.', variant: 'destructive' });
            return;
        }

        startTransition(async () => {
            try {
                const existingRef = doc(firestore, 'storageRecords', storageId);
                const existingSnap = await getDoc(existingRef);
                if (existingSnap.exists()) {
                    toast({ title: 'Duplicate ID', description: `Storage ID #${storageId} already exists.`, variant: 'destructive' });
                    return;
                }

                const finalDate = new Date(storageStartDate);
                const customerHamaliRate = Number(customerRate) || 0;
                const workerHamaliRate = Number(workerRate) || customerHamaliRate;
                const hamaliPayable = bagsValue * customerHamaliRate;
                const workerHamaliPayable = bagsValue * workerHamaliRate;

                const payments: Payment[] = [];
                if (Number(hamaliPaid) > 0) {
                    payments.push({ amount: Number(hamaliPaid), date: finalDate, type: 'hamali' });
                }

                const commodityDetails = commodities.find(c => c.name === selectedCommodity);
                
                const rawRecord: Omit<StorageRecord, 'id'> = {
                    warehouseId: appUser.warehouseId,
                    customerId: selectedCustomerId,
                    commodityDescription: selectedCommodity,
                    location: selectedLot,
                    bagsIn: bagsValue,
                    bagsOut: 0,
                    bagsStored: bagsValue,
                    storageStartDate: finalDate,
                    storageEndDate: null,
                    billingCycle: '6-Month Initial',
                    payments,
                    hamaliPayable,
                    hamaliRate: customerHamaliRate,
                    workerHamaliPayable,
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

                await setDoc(doc(firestore, "storageRecords", storageId), cleanForFirestore(rawRecord));

                if (sendSmsNotification && warehouseInfo?.textbeeApiKey && selectedCustomer?.phone) {
                    const msg = (warehouseInfo.smsInflowTemplate || `Dear {customerName}, inflow of {bags} bags of {commodity} recorded. Bill: {billNo}. Thank you.`)
                        .replace('{customerName}', selectedCustomer.name)
                        .replace('{bags}', String(bagsValue))
                        .replace('{commodity}', selectedCommodity)
                        .replace('{billNo}', storageId)
                        .replace('{date}', format(finalDate, 'dd/MM/yy'))
                        .replace('{warehouseName}', warehouseInfo.name || 'Sri Lakshmi Warehouse');

                    sendSms({ apiKey: warehouseInfo.textbeeApiKey, deviceId: warehouseInfo.textbeeDeviceId, to: selectedCustomer.phone, message: msg }).catch(console.error);
                }
                
                toast({ title: 'Success', description: 'Record created.' });
                resetForm();
                window.open(`/inflow/receipt/${storageId}`, '_blank');
                
            } catch (error) {
                console.error(error);
                toast({ title: 'Error', description: 'Failed to create record.', variant: 'destructive' });
            }
        });
    }

  return (
    <div className="flex justify-center">
        <form onSubmit={handleSubmit} className="w-full max-w-lg">
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg font-bold">New Storage Record Details</CardTitle>
                    <CardDescription className="text-xs">Storage ID is strictly auto-generated and locked for accuracy.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                     <div className="space-y-1.5">
                        <Label htmlFor="storageId" className="flex items-center gap-2 text-xs font-semibold">
                            Storage ID
                            <Badge variant="outline" className="text-[9px] uppercase font-bold py-0 h-4 bg-primary/5 text-primary border-primary/20">
                                <Sparkles className="h-2 w-2 mr-1" />
                                Auto-Generated
                            </Badge>
                        </Label>
                        <Input 
                            id="storageId" 
                            className="font-mono font-bold text-sm bg-muted/50 cursor-not-allowed h-9"
                            value={storageId} 
                            readOnly
                        />
                    </div>
                     <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">Customer</Label>
                        <Combobox
                            options={customerOptions}
                            value={selectedCustomerId}
                            onChange={setSelectedCustomerId}
                            placeholder="Select a customer..."
                            modal={true}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold">Product</Label>
                             <Combobox
                                options={commodityOptions}
                                value={selectedCommodity}
                                onChange={setSelectedCommodity}
                                placeholder="Select a product..."
                                modal={true}
                            />
                        </div>
                         <div className="space-y-1.5">
                            <Label className="text-xs font-semibold">Lot No.</Label>
                             <Combobox
                                options={lotOptions}
                                value={selectedLot}
                                onChange={setSelectedLot}
                                placeholder="Select a lot..."
                                modal={true}
                            />
                        </div>
                    </div>
                     <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <Label htmlFor="lorry" className="text-xs font-semibold">Vehicle No.</Label>
                            <Input id="lorry" placeholder="e.g. AP 21 1234" value={lorryTractorNo} onChange={e => setLorryTractorNo(e.target.value)} className="text-sm h-9" />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="date" className="text-xs font-semibold">Inflow Date</Label>
                            <Input id="date" type="date" value={storageStartDate} onChange={e => setStorageStartDate(e.target.value)} className="text-sm h-9" required />
                        </div>
                    </div>
                     <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <Label htmlFor="bags" className="text-xs font-semibold">No. of Bags</Label>
                            <Input id="bags" type="number" step="0.01" required value={bags} onChange={(e) => setBags(e.target.value === '' ? '' : Number(e.target.value))} className="text-sm h-9" />
                        </div>
                         <div className="space-y-1.5">
                            <Label htmlFor="wt" className="text-xs font-semibold">Weight (Kgs)</Label>
                            <Input id="wt" type="number" step="0.01" value={weight} onChange={(e) => setWeight(e.target.value === '' ? '' : Number(e.target.value))} className="text-sm h-9" />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <Label htmlFor="cRate" className="text-xs font-semibold">Cust Hamali Rate</Label>
                            <Input id="cRate" type="number" step="0.01" value={customerRate} onChange={e => setCustomerRate(e.target.value === '' ? '' : Number(e.target.value))} className="text-sm h-9" />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="wRate" className="text-xs font-semibold">Worker Rate</Label>
                            <Input id="wRate" type="number" step="0.01" value={workerRate} onChange={e => setWorkerRate(e.target.value === '' ? '' : Number(e.target.value))} className="text-sm h-9" />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <Label htmlFor="hPaid" className="text-xs font-semibold">Paid Now</Label>
                            <Input id="hPaid" type="number" step="0.01" value={hamaliPaid} onChange={e => setHamaliPaid(e.target.value === '' ? '' : Number(e.target.value))} className="text-sm h-9" />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="khata" className="text-xs font-semibold">Khata Amount</Label>
                            <Input id="khata" type="number" step="0.01" value={khataAmount} onChange={e => setKhataAmount(e.target.value === '' ? '' : Number(e.target.value))} className="text-sm h-9" />
                        </div>
                    </div>
                     <Separator />
                     <div className="space-y-2 text-sm">
                        <div className="flex justify-between font-bold">
                            <span className="text-destructive uppercase text-[10px]">Net Hamali Pending</span>
                            <span className="font-mono text-destructive">{formatCurrency(customerHamali - (Number(hamaliPaid) || 0))}</span>
                        </div>
                    </div>
                     <div className="flex items-center space-x-2 pt-2">
                        <Checkbox id="sms" checked={sendSmsNotification} onCheckedChange={(c) => setSendSmsNotification(Boolean(c))} disabled={!warehouseInfo?.textbeeApiKey || !selectedCustomer?.phone} />
                        <label htmlFor="sms" className="text-xs font-medium cursor-pointer leading-none">Send SMS Notification</label>
                    </div>
                </CardContent>
                <CardFooter>
                    <SubmitButton isPending={isPending} />
                </CardFooter>
            </Card>
        </form>
    </div>
  );
}