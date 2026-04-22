
'use client';

import { useTransition, useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { Customer, Payment, Commodity, Lot, StorageRecord, WarehouseInfo, SmsInfo } from '@/lib/definitions';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { Separator } from '../ui/separator';
import { formatCurrency, cleanForFirestore, toDate } from '@/lib/utils';
import { useFirestore } from '@/firebase/provider';
import { doc, setDoc } from 'firebase/firestore';
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
    const [rate, setRate] = useState<number | ''>('');
    const [hamali, setHamali] = useState(0);
    const [hamaliPaid, setHamaliPaid] = useState<number | ''>('');
    const [selectedCustomerId, setSelectedCustomerId] = useState('');
    const [selectedCommodity, setSelectedCommodity] = useState('');
    const [weight, setWeight] = useState<number | ''>('');
    const [khataAmount, setKhataAmount] = useState<number | ''>('');
    const [selectedLot, setSelectedLot] = useState('');
    const [lorryTractorNo, setLorryTractorNo] = useState('');
    const [storageStartDate, setStorageStartDate] = useState(new Date().toISOString().split('T')[0]);

    const smsInfoRef = useMemoFirebase(() => (firestore && appUser ? doc(firestore, 'settings', 'sms') : null), [firestore, appUser]);
    const { data: smsInfo } = useDoc<SmsInfo>(smsInfoRef);

    const warehouseInfoRef = useMemoFirebase(() => (firestore && appUser ? doc(firestore, 'settings', 'main') : null), [firestore, appUser]);
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


    useEffect(() => {
        const bagsValue = bags || 0;
        const rateValue = rate || 0;
        
        const currentHamali = bagsValue * rateValue;
        setHamali(currentHamali);

    }, [bags, rate]);

    const resetForm = () => {
        setBags('');
        setRate('');
        setHamali(0);
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
        if (!firestore || !appUser) {
            toast({ title: 'Error', description: 'Firestore not available or user not logged in.', variant: 'destructive' });
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

        const receiptUrl = `/inflow/receipt/${nextId}`;
        const receiptWindow = window.open(receiptUrl, '_blank');
        if (!receiptWindow) {
            toast({
                title: "Popup Blocked",
                description: "Please allow popups for this site to view receipts.",
                variant: "destructive",
            });
            return;
        }

        startTransition(async () => {
            try {
                const weightValue = Number(weight) || 0;
                const hamaliRate = Number(rate) || 0;
                const hamaliPaidAmount = Number(hamaliPaid) || 0;

                const hamaliPayable = bagsStored * hamaliRate;

                const payments: Payment[] = [];
                if (hamaliPaidAmount > 0) {
                    payments.push({
                        amount: hamaliPaidAmount,
                        date: new Date(storageStartDate),
                        type: 'hamali'
                    });
                }
                
                const rawRecord: Omit<StorageRecord, 'id'> = {
                    customerId: selectedCustomerId,
                    commodityDescription: selectedCommodity,
                    location: selectedLot,
                    bagsIn: bagsStored,
                    bagsOut: 0,
                    bagsStored,
                    storageStartDate: new Date(storageStartDate),
                    storageEndDate: null,
                    billingCycle: '6-Month Initial' as const,
                    payments,
                    hamaliPayable,
                    hamaliRate: hamaliRate,
                    workerHamaliPayable: hamaliPayable,
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

                const docRef = doc(firestore, "storageRecords", nextId);
                await setDoc(docRef, cleanForFirestore(rawRecord));

                if (sendSmsNotification && smsInfo?.textbeeApiKey && selectedCustomer?.phone) {
                    const message = `Dear ${selectedCustomer.name}, your inflow of ${bagsStored} bags of ${selectedCommodity} has been recorded on ${format(new Date(storageStartDate), 'dd/MM/yy')}. Bill No: ${nextId}. Thank you. - ${warehouseInfo?.name || 'GrainDost'}`;
                    sendSms({
                        apiKey: smsInfo.textbeeApiKey,
                        to: selectedCustomer.phone,
                        message: message,
                    }).catch(console.error); // Send SMS in background, don't block UI
                }
                
                toast({ title: 'Success', description: 'Inflow record created successfully.' });
                
                resetForm();
                
            } catch (error) {
                console.error(error);
                toast({ title: 'Error', description: 'Failed to create inflow record.', variant: 'destructive' });
                if (receiptWindow) receiptWindow.close();
            }
        });
    }

  return (
    <div className="flex justify-center">
        <form onSubmit={handleSubmit} className="w-full max-w-lg">
            <Card>
                <CardHeader>
                    <CardTitle>New Storage Record Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                     <div className="space-y-2">
                        <Label htmlFor="customerId">Customer</Label>
                        <Combobox
                            options={customerOptions}
                            value={selectedCustomerId}
                            onChange={setSelectedCustomerId}
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
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="commodityDescription">Product</Label>
                             <Combobox
                                options={commodityOptions}
                                value={selectedCommodity}
                                onChange={setSelectedCommodity}
                                placeholder="Select a product..."
                                searchPlaceholder="Search products..."
                                emptyPlaceholder="No products found."
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
                                emptyPlaceholder="No lots found."
                            />
                        </div>
                    </div>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="lorryTractorNo">Lorry / Tractor No. <span className="text-muted-foreground text-xs">(Optional)</span></Label>
                            <Input id="lorryTractorNo" name="lorryTractorNo" placeholder="e.g., AP 21 1234" value={lorryTractorNo} onChange={e => setLorryTractorNo(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="storageStartDate">Date</Label>
                            <Input 
                                id="storageStartDate" 
                                name="storageStartDate" 
                                type="date"
                                value={storageStartDate}
                                onChange={e => setStorageStartDate(e.target.value)}
                                required 
                            />
                        </div>
                    </div>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="bagsStored">No. of Bags</Label>
                            <Input 
                                id="bagsStored" 
                                name="bagsStored" 
                                type="number" 
                                placeholder="0" 
                                required
                                value={bags}
                                onChange={(e) => setBags(e.target.value === '' ? '' : Number(e.target.value))}
                            />
                        </div>
                         <div className="space-y-2">
                            <Label htmlFor="weight">Weight <span className="text-muted-foreground text-xs">(Optional)</span></Label>
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
                            <Label htmlFor="hamaliRate">Storage Inflow Hamali Rate (per bag)</Label>
                            <Input id="hamaliRate" name="hamaliRate" type="number" placeholder="0.00" step="0.01" value={rate} onChange={e => setRate(e.target.value === '' ? '' : Number(e.target.value))}/>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="hamaliPaid">Hamali Paid Now</Label>
                            <Input id="hamaliPaid" name="hamaliPaid" type="number" placeholder="0.00" step="0.01" value={hamaliPaid} onChange={e => setHamaliPaid(e.target.value === '' ? '' : Number(e.target.value))}/>
                        </div>
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="khataAmount">Khata Amount (Weighbridge)</Label>
                        <Input id="khataAmount" name="khataAmount" type="number" placeholder="0.00" step="0.01" value={khataAmount} onChange={e => setKhataAmount(e.target.value === '' ? '' : Number(e.target.value))} />
                    </div>
                     <Separator />
                     <div className="space-y-4">
                        <h4 className="font-medium">Billing Summary</h4>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between items-center">
                                <span className="text-muted-foreground">Storage Inflow Hamali</span>
                                <span className="font-mono">{formatCurrency((Number(bags) || 0) * (Number(rate) || 0))}</span>
                            </div>
                            <Separator />
                            <div className="flex justify-between items-center font-semibold">
                                <span className="text-foreground">Total Hamali Payable</span>
                                <span className="font-mono">{formatCurrency(hamali)}</span>
                            </div>
                            <div className="flex justify-between items-center font-semibold">
                                <span className="text-destructive">Hamali Pending</span>
                                <span className="font-mono text-destructive">{formatCurrency(hamali - (Number(hamaliPaid) || 0))}</span>
                            </div>
                            <p className="text-xs text-muted-foreground pt-2">
                                Rent will be calculated at the time of withdrawal.
                            </p>
                        </div>
                    </div>
                     <div className="flex items-center space-x-2 pt-4">
                        <Checkbox 
                            id="sendSms" 
                            checked={sendSmsNotification}
                            onCheckedChange={(checked) => setSendSmsNotification(Boolean(checked))}
                            disabled={!smsInfo?.textbeeApiKey || !selectedCustomer?.phone}
                        />
                        <label
                            htmlFor="sendSms"
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
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
