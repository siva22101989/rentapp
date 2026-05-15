'use client';

import { useTransition, useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { Customer, Payment, Commodity, Lot, StorageRecord, WarehouseInfo } from '@/lib/definitions';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Sparkles } from 'lucide-react';
import { Separator } from '../ui/separator';
import { formatCurrency, cleanForFirestore, toDate, formatManualDate, parseManualDate } from '@/lib/utils';
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
      <Button type="submit" disabled={isPending} className="w-full">
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

export function InflowForm({ customers, commodities, lots, records, nextId }: { customers: Customer[], commodities: Commodity[], lots: Lot[], records: StorageRecord[], nextId: string }) {
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
    const [storageStartDate, setStorageStartDate] = useState(formatManualDate(new Date()));
    const [storageId, setStorageId] = useState(nextId);

    useEffect(() => {
        setStorageId(nextId);
    }, [nextId]);

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


    const { customerHamali, workerHamali } = useMemo(() => {
        const bagsValue = Number(bags) || 0;
        const custRateValue = Number(customerRate) || 0;
        const workRateValue = Number(workerRate) || custRateValue;
        
        return {
            customerHamali: bagsValue * custRateValue,
            workerHamali: bagsValue * workRateValue
        }
    }, [bags, customerRate, workerRate]);

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
        setStorageStartDate(formatManualDate(new Date()));
        setStorageId(nextId);
    };
    
    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!firestore || !appUser?.warehouseId) {
            toast({ title: 'Error', description: 'Could not create record: user or warehouse context is missing.', variant: 'destructive' });
            return;
        }

        const finalDate = parseManualDate(storageStartDate);
        if (!finalDate) {
            toast({ title: 'Invalid Date', description: 'Please enter the date in DD-MM-YYYY format.', variant: 'destructive' });
            return;
        }

        if (!storageId) {
            toast({ title: 'Error', description: 'Storage ID is required.', variant: 'destructive' });
            return;
        }

        const bagsStored = Number(bags);
         if (!bagsStored || bagsStored <= 0) {
             toast({ title: 'Error', description: 'Number of bags must be a positive number.', variant: 'destructive' });
             return;
        }
        if (!selectedCustomerId) {
            toast({ title: 'Error', description: 'Please select a customer.', variant: 'destructive' });
            return;
        }
        const commodityDetails = commodities.find(c => c.name === selectedCommodity);
         if (!commodityDetails) {
            toast({ title: 'Error', description: 'Please select a product.', variant: 'destructive' });
            return;
        }

        startTransition(async () => {
            try {
                const existingRef = doc(firestore, 'storageRecords', storageId);
                const existingSnap = await getDoc(existingRef);
                if (existingSnap.exists()) {
                    toast({ title: 'Duplicate ID', description: `A record with Storage ID #${storageId} already exists.`, variant: 'destructive' });
                    return;
                }

                const receiptUrl = `/inflow/receipt/${storageId}`;
                const receiptWindow = window.open(receiptUrl, '_blank');

                const weightValue = Number(weight) || 0;
                const customerHamaliRate = Number(customerRate) || 0;
                const workerHamaliRate = Number(workerRate) || customerHamaliRate;
                const hamaliPaidAmount = Number(hamaliPaid) || 0;

                const hamaliPayable = bagsStored * customerHamaliRate;
                const workerHamaliPayable = bagsStored * workerHamaliRate;

                const payments: Payment[] = [];
                if (hamaliPaidAmount > 0) {
                    payments.push({
                        amount: hamaliPaidAmount,
                        date: finalDate,
                        type: 'hamali'
                    });
                }
                
                const rawRecord: Omit<StorageRecord, 'id'> = {
                    warehouseId: appUser.warehouseId,
                    customerId: selectedCustomerId,
                    commodityDescription: selectedCommodity,
                    location: selectedLot,
                    bagsIn: bagsStored,
                    bagsOut: 0,
                    bagsStored,
                    storageStartDate: finalDate,
                    storageEndDate: null,
                    billingCycle: '6-Month Initial' as const,
                    payments,
                    hamaliPayable,
                    hamaliRate: customerHamaliRate,
                    workerHamaliPayable: workerHamaliPayable,
                    totalRentBilled: 0,
                    lorryTractorNo: lorryTractorNo,
                    weight: weightValue,
                    inflowType: 'Direct' as const,
                    dryingRecordId: '',
                    khataAmount: Number(khataAmount) || 0,
                    billingType: commodityDetails.billingType,
                    monthlyRate: commodityDetails.monthlyRate,
                    minBillingMonths: commodityDetails.minBillingMonths,
                    insuranceRate: commodityDetails.insuranceRate,
                    rate6Months: commodityDetails.rate6Months,
                    rate1Year: commodityDetails.rate1Year,
                };

                const docRef = doc(firestore, "storageRecords", storageId);
                await setDoc(docRef, cleanForFirestore(rawRecord));

                if (sendSmsNotification && warehouseInfo?.textbeeApiKey && selectedCustomer?.phone) {
                    const defaultTemplate = `Dear {customerName}, your inflow of {bags} bags of {commodity} has been recorded on {date}. ID: {billNo}. Hamali: {hamaliAmount}. Thank you. - {warehouseName}`;
                    const template = warehouseInfo?.smsInflowTemplate || defaultTemplate;

                    const message = template
                        .replace('{customerName}', selectedCustomer.name)
                        .replace('{bags}', String(bagsStored))
                        .replace('{commodity}', selectedCommodity)
                        .replace('{billNo}', storageId)
                        .replace('{date}', format(finalDate, 'dd/MM/yy'))
                        .replace('{hamaliAmount}', formatCurrency(hamaliPayable))
                        .replace('{warehouseName}', warehouseInfo?.name || 'Sri Lakshmi Warehouse');

                    sendSms({
                        apiKey: warehouseInfo.textbeeApiKey,
                        deviceId: warehouseInfo.textbeeDeviceId,
                        to: selectedCustomer.phone,
                        message: message,
                    }).catch(console.error);
                }
                
                toast({ title: 'Success', description: 'Storage record created successfully.' });
                resetForm();
                
            } catch (error) {
                console.error(error);
                toast({ title: 'Error', description: 'Failed to create inflow record.', variant: 'destructive' });
            }
        });
    }

  return (
    <div className="flex justify-center">
        <form onSubmit={handleSubmit} className="w-full max-w-lg">
            <Card>
                <CardHeader>
                    <CardTitle>New Storage Record Details</CardTitle>
                    <CardDescription>The Storage ID is automatically generated. Format: DD-MM-YYYY.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                     <div className="space-y-2">
                        <Label htmlFor="storageId" className="flex items-center gap-2">
                            Storage ID
                            <Badge variant="outline" className="text-[10px] uppercase font-bold py-0 h-4 bg-primary/5 text-primary border-primary/20">
                                <Sparkles className="h-2 w-2 mr-1" />
                                Auto-Generated
                            </Badge>
                        </Label>
                        <Input 
                            id="storageId" 
                            type="text" 
                            className="font-mono font-bold text-lg bg-muted/50 cursor-not-allowed"
                            value={storageId} 
                            readOnly
                        />
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="customerId">Customer</Label>
                        <Combobox
                            options={customerOptions}
                            value={selectedCustomerId}
                            onChange={setSelectedCustomerId}
                            placeholder="Select a customer..."
                            searchPlaceholder="Search customers..."
                        />
                    </div>

                    {selectedCustomer && (
                        <div className="text-sm text-muted-foreground p-3 border rounded-md bg-secondary/50 space-y-1 -mt-2">
                            <p><strong>Father's Name:</strong> {selectedCustomer.fatherName || 'N/A'}</p>
                            <p><strong>Village:</strong> {selectedCustomer.village || 'N/A'}</p>
                            <p><strong>Phone:</strong> {selectedCustomer.phone}</p>
                        </div>
                    )}
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="commodityDescription">Product</Label>
                             <Combobox
                                options={commodityOptions}
                                value={selectedCommodity}
                                onChange={setSelectedCommodity}
                                placeholder="Select a product..."
                                searchPlaceholder="Search products..."
                            />
                        </div>
                         <div className="space-y-2">
                            <Label htmlFor="location">Lot No.</Label>
                             <Combobox
                                options={lotOptions}
                                value={selectedLot}
                                onChange={setSelectedLot}
                                placeholder="Select a lot..."
                                searchPlaceholder="Search lots..."
                            />
                        </div>
                    </div>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="lorryTractorNo">Lorry / Tractor No.</Label>
                            <Input id="lorryTractorNo" name="lorryTractorNo" placeholder="e.g., AP 21 1234" value={lorryTractorNo} onChange={e => setLorryTractorNo(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="storageStartDate">Inflow Date (DD-MM-YYYY)</Label>
                            <Input 
                                id="storageStartDate" 
                                name="storageStartDate" 
                                type="text"
                                placeholder="DD-MM-YYYY"
                                value={storageStartDate}
                                onChange={e => setStorageStartDate(e.target.value)}
                                required 
                            />
                        </div>
                    </div>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="bagsStored">No. of Bags (Packed)</Label>
                            <Input 
                                id="bagsStored" 
                                name="bagsStored" 
                                type="number" 
                                step="0.01"
                                placeholder="0" 
                                required
                                value={bags}
                                onChange={(e) => setBags(e.target.value === '' ? '' : Number(e.target.value))}
                            />
                        </div>
                         <div className="space-y-2">
                            <Label htmlFor="weight">Weight (Kgs)</Label>
                            <Input 
                                id="weight" 
                                name="weight" 
                                type="number" 
                                step="0.01" 
                                placeholder="0.00" 
                                value={weight}
                                onChange={(e) => setWeight(e.target.value === '' ? '' : Number(e.target.value))}
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="customerHamaliRate">Cust Hamali Rate</Label>
                            <Input id="customerHamaliRate" name="customerHamaliRate" type="number" placeholder="0.00" step="0.01" value={customerRate} onChange={e => setCustomerRate(e.target.value === '' ? '' : Number(e.target.value))}/>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="workerHamaliRate">Worker Hamali Rate</Label>
                            <Input id="workerHamaliRate" name="workerHamaliRate" type="number" placeholder="0.00" step="0.01" value={workerRate} onChange={e => setWorkerRate(e.target.value === '' ? '' : Number(e.target.value))}/>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="hamaliPaid">Hamali Paid Now</Label>
                            <Input id="hamaliPaid" name="hamaliPaid" type="number" placeholder="0.00" step="0.01" value={hamaliPaid} onChange={e => setHamaliPaid(e.target.value === '' ? '' : Number(e.target.value))}/>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="khataAmount">Khata Amount</Label>
                            <Input id="khataAmount" name="khataAmount" type="number" placeholder="0.00" step="0.01" value={khataAmount} onChange={e => setKhataAmount(e.target.value === '' ? '' : Number(e.target.value))} />
                        </div>
                    </div>
                     <Separator />
                     <div className="space-y-4">
                        <h4 className="font-medium">Billing Summary</h4>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between items-center font-semibold">
                                <span className="text-foreground">Total Hamali (Customer)</span>
                                <span className="font-mono">{formatCurrency(customerHamali)}</span>
                            </div>
                             <div className="flex justify-between items-center text-sm">
                                <span className="text-muted-foreground">Total Hamali (Worker)</span>
                                <span className="font-mono">{formatCurrency(workerHamali)}</span>
                            </div>
                            <Separator />
                            <div className="flex justify-between items-center font-semibold">
                                <span className="text-destructive">Hamali Pending</span>
                                <span className="font-mono text-destructive">{formatCurrency(customerHamali - (Number(hamaliPaid) || 0))}</span>
                            </div>
                        </div>
                    </div>
                     <div className="flex items-center space-x-2 pt-4">
                        <Checkbox 
                            id="sendSms" 
                            checked={sendSmsNotification}
                            onCheckedChange={(checked) => setSendSmsNotification(Boolean(checked))}
                            disabled={!warehouseInfo?.textbeeApiKey || !selectedCustomer?.phone}
                        />
                        <label
                            htmlFor="sendSms"
                            className="text-sm font-medium leading-none"
                        >
                            Send SMS Notification to Customer
                        </label>
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
