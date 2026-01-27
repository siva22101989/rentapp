'use client';

import { useTransition, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Customer, DryingRecord, Payment, Commodity } from '@/lib/definitions';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Info } from 'lucide-react';
import { Separator } from '../ui/separator';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { format, differenceInDays } from 'date-fns';
import { toDate, formatCurrency } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { useFirestore } from '@/firebase';
import { setDoc, doc, Timestamp, updateDoc } from 'firebase/firestore';

function SubmitButton() {
    const [pending, setPending] = useState(false);
    // useFormStatus is not used because we are doing a client-side write first.
    return (
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? (
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

export function InflowForm({ customers, dryingRecords, commodities, nextSerialNumber, fromDryingRecordId }: { customers: Customer[], dryingRecords: DryingRecord[], commodities: Commodity[], nextSerialNumber: string, fromDryingRecordId?: string | null }) {
    const { toast } = useToast();
    const router = useRouter();
    const firestore = useFirestore();
    const [isPending, startTransition] = useTransition();

    const [bags, setBags] = useState<number | ''>('');
    const [rate, setRate] = useState<number | ''>('');
    const [hamali, setHamali] = useState(0);
    const [hamaliPaid, setHamaliPaid] = useState<number | ''>('');
    const [selectedCustomerId, setSelectedCustomerId] = useState('');
    const [inflowType, setInflowType] = useState<'Direct' | 'Plot'>('Direct');
    
    const [selectedDryingRecordId, setSelectedDryingRecordId] = useState('');
    const [commodityDescription, setCommodityDescription] = useState('');
    const [weight, setWeight] = useState<number | ''>('');
    const [khataAmount, setKhataAmount] = useState<number | ''>('');


    const selectedCustomer = customers.find(c => c.id === selectedCustomerId);
    const customerDryingRecords = dryingRecords.filter(dr => dr.customerId === selectedCustomerId);
    const selectedDryingRecord = dryingRecords.find(dr => dr.id === selectedDryingRecordId);

    const [dryingSummary, setDryingSummary] = useState({ unloadingHamali: 0, dryingHamali: 0 });

    useEffect(() => {
        if (fromDryingRecordId && dryingRecords.length > 0 && customers.length > 0) {
            const recordToPreFill = dryingRecords.find(dr => dr.id === fromDryingRecordId);
            if (recordToPreFill) {
                setInflowType('Plot');
                setSelectedCustomerId(recordToPreFill.customerId);
                setSelectedDryingRecordId(recordToPreFill.id);
                // The other useEffects will trigger based on these state changes
            }
        }
    }, [fromDryingRecordId, dryingRecords, customers]);

    useEffect(() => {
        const bagsValue = inflowType === 'Plot' ? (selectedDryingRecord?.bagsPacked || 0) : (bags || 0);
        const rateValue = rate || 0;
        
        const currentHamali = (bagsValue || 0) * rateValue;
        const dryingHamaliTotal = inflowType === 'Plot' ? (selectedDryingRecord?.totalDryingHamali || 0) : 0;
        
        setHamali(currentHamali + dryingHamaliTotal);

        if (inflowType === 'Plot' && selectedDryingRecord && selectedDryingRecord.hamaliCharges) {
            const unloading = selectedDryingRecord.hamaliCharges.find(c => c.description.toLowerCase().includes('unloading'))?.amount || 0;
            const drying = selectedDryingRecord.totalDryingHamali - unloading;
            setDryingSummary({ unloadingHamali: unloading, dryingHamali: drying });
        } else {
            setDryingSummary({ unloadingHamali: 0, dryingHamali: 0 });
        }

    }, [bags, selectedDryingRecord, rate, inflowType]);
    
    useEffect(() => {
      if (inflowType === 'Plot' && selectedDryingRecord) {
        setCommodityDescription(selectedDryingRecord.commodityDescription || '');
        setBags(selectedDryingRecord.bagsPacked || 0);
        setWeight('');
      } else {
         if (inflowType === 'Direct') {
            setCommodityDescription('');
            setBags('');
            setWeight('');
        }
      }
    }, [inflowType, selectedDryingRecord]);

    useEffect(() => {
        // Don't reset if we are pre-filling from a drying record
        if (fromDryingRecordId) return;

        setSelectedDryingRecordId('');
    }, [selectedCustomerId, fromDryingRecordId]);

    useEffect(() => {
        // Don't reset if we are pre-filling from a drying record
        if (fromDryingRecordId && inflowType === 'Plot') return;
        
        setBags('');
        setRate('');
        setHamali(0);
        setHamaliPaid('');
        setKhataAmount('');
        setWeight('');
        setSelectedCustomerId('');
        setSelectedDryingRecordId('');
        setCommodityDescription('');
    }, [inflowType, fromDryingRecordId]);

    const getPlotDuration = () => {
        if (!selectedDryingRecord || !selectedDryingRecord.dryingStartDate || !selectedDryingRecord.packingDate) return 0;
        const start = toDate(selectedDryingRecord.dryingStartDate);
        const end = toDate(selectedDryingRecord.packingDate);
        return differenceInDays(end, start) + 1; // Add 1 to be inclusive
    }
    
    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        if (!firestore) {
            toast({ title: 'Error', description: 'Firestore not available', variant: 'destructive' });
            return;
        }

        startTransition(async () => {
            try {
                // Client-side validation could be added here for a better UX
                const data = Object.fromEntries(formData.entries());

                const bagsStored = Number(data.bagsStored);
                const hamaliRate = Number(data.hamaliRate) || 0;
                const hamaliPaidAmount = Number(data.hamaliPaid) || 0;

                const dryingHamali = inflowType === 'Plot' ? (selectedDryingRecord?.totalDryingHamali || 0) : 0;
                const hamaliPayable = (bagsStored * hamaliRate) + dryingHamali;

                const payments: Payment[] = [];
                if (hamaliPaidAmount > 0) {
                    payments.push({
                        amount: hamaliPaidAmount,
                        date: Timestamp.fromDate(new Date(data.storageStartDate as string)),
                        type: 'hamali'
                    });
                }
                
                const newRecord = {
                    id: nextSerialNumber,
                    customerId: data.customerId,
                    commodityDescription: data.commodityDescription,
                    location: data.location,
                    bagsIn: bagsStored,
                    bagsOut: 0,
                    bagsStored,
                    storageStartDate: Timestamp.fromDate(new Date(data.storageStartDate as string)),
                    storageEndDate: null,
                    billingCycle: '6-Month Initial' as const,
                    payments,
                    hamaliPayable,
                    totalRentBilled: 0,
                    lorryTractorNo: data.lorryTractorNo,
                    weight: Number(data.weight) || 0,
                    inflowType: inflowType,
                    dryingRecordId: inflowType === 'Plot' ? data.dryingRecordId : '',
                    khataAmount: Number(data.khataAmount) || 0
                };

                await setDoc(doc(firestore, "storageRecords", nextSerialNumber), newRecord);

                if (inflowType === 'Plot' && selectedDryingRecord) {
                    // This status is already set to billed before redirecting, but let's be safe
                    const dryingRecordRef = doc(firestore, 'dryingRecords', selectedDryingRecord.id);
                    await updateDoc(dryingRecordRef, { status: 'Billed' });
                }

                toast({ title: 'Success', description: 'Inflow record created successfully.' });
                router.push(`/inflow/receipt/${nextSerialNumber}`);
                
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
                    <CardDescription>
                        Next Serial No: <span className="font-bold text-primary">{nextSerialNumber}</span>
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label>Inflow Type</Label>
                        <RadioGroup 
                            name="inflowType"
                            defaultValue="Direct"
                            className="flex gap-4"
                            onValueChange={(value: 'Direct' | 'Plot') => setInflowType(value)}
                            value={inflowType}
                        >
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="Direct" id="direct" />
                                <Label htmlFor="direct">Direct</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="Plot" id="plot" />
                                <Label htmlFor="plot">From Plot</Label>
                            </div>
                        </RadioGroup>
                    </div>

                     <div className="space-y-2">
                        <Label htmlFor="customerId">Customer</Label>
                        <Select name="customerId" required onValueChange={setSelectedCustomerId} value={selectedCustomerId}>
                            <SelectTrigger id="customerId">
                                <SelectValue placeholder="Select a customer" />
                            </SelectTrigger>
                            <SelectContent>
                                {customers.map(customer => (
                                    <SelectItem key={customer.id} value={customer.id}>
                                        {customer.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    
                    {inflowType === 'Plot' && selectedCustomerId && (
                        <>
                            <div className="space-y-2">
                                <Label htmlFor="dryingRecordId">Drying Bill</Label>
                                <Select name="dryingRecordId" required onValueChange={setSelectedDryingRecordId} value={selectedDryingRecordId}>
                                    <SelectTrigger id="dryingRecordId">
                                        <SelectValue placeholder="Select a completed drying bill" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {customerDryingRecords.length > 0 ? (
                                            customerDryingRecords.map(dr => (
                                                <SelectItem key={dr.id} value={dr.id}>
                                                    {dr.commodityDescription} ({dr.bagsPacked} bags, Billed: {format(toDate(dr.billingDate!), 'dd MMM yyyy')})
                                                </SelectItem>
                                            ))
                                        ) : (
                                            <SelectItem value="none" disabled>No completed drying records for this customer</SelectItem>
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>

                            {selectedDryingRecord && (
                                <Alert>
                                    <Info className="h-4 w-4" />
                                    <AlertTitle>Drying Process Summary</AlertTitle>
                                    <AlertDescription>
                                        <div className="space-y-1 mt-2 text-sm">
                                            <div className="flex justify-between"><span className="text-muted-foreground">Bags Plotted:</span> <strong>{selectedDryingRecord.bagsForDrying}</strong></div>
                                            <div className="flex justify-between"><span className="text-muted-foreground">Bags Packed:</span> <strong>{selectedDryingRecord.bagsPacked}</strong></div>
                                            <div className="flex justify-between"><span className="text-muted-foreground">Total Drying Hamali:</span> <strong>{formatCurrency(selectedDryingRecord.totalDryingHamali)}</strong></div>
                                            <div className="flex justify-between"><span className="text-muted-foreground">Duration in Plot:</span> <strong>{getPlotDuration()} days</strong></div>
                                        </div>
                                    </AlertDescription>
                                </Alert>
                            )}
                        </>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="commodityDescription">Product</Label>
                            {inflowType === 'Plot' ? (
                                <Input 
                                    id="commodityDescription" 
                                    name="commodityDescription"
                                    value={commodityDescription}
                                    readOnly
                                />
                            ) : (
                                <Select 
                                    name="commodityDescription" 
                                    required 
                                    onValueChange={setCommodityDescription} 
                                    value={commodityDescription}
                                >
                                    <SelectTrigger id="commodityDescription">
                                        <SelectValue placeholder="Select a product" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {commodities.map(commodity => (
                                            <SelectItem key={commodity.id} value={commodity.name}>
                                                {commodity.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="location">Lot No. <span className="text-muted-foreground text-xs">(Optional)</span></Label>
                            <Input id="location" name="location" placeholder="e.g., E2/middle" />
                        </div>
                    </div>
                     <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="lorryTractorNo">Lorry / Tractor No. <span className="text-muted-foreground text-xs">(Optional)</span></Label>
                            <Input id="lorryTractorNo" name="lorryTractorNo" placeholder="e.g., AP 21 1234" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="storageStartDate">Date</Label>
                            <Input 
                                id="storageStartDate" 
                                name="storageStartDate" 
                                type="date"
                                defaultValue={new Date().toISOString().split('T')[0]}
                                required 
                            />
                        </div>
                    </div>
                     <div className="grid grid-cols-2 gap-4">
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
                                readOnly={inflowType === 'Plot'}
                            />
                        </div>
                         <div className="space-y-2">
                            <Label htmlFor="weight">Weight {inflowType === 'Direct' && '*'}</Label>
                            <Input 
                                id="weight" 
                                name="weight" 
                                type="number" 
                                step="0.01" 
                                placeholder="0.00" 
                                required={inflowType === 'Direct'}
                                value={weight}
                                onChange={(e) => setWeight(e.target.value === '' ? '' : Number(e.target.value))}
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
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
                            {inflowType === 'Plot' && selectedDryingRecord && (
                                <>
                                    <div className="flex justify-between items-center">
                                        <span className="text-muted-foreground">Unloading Hamali</span>
                                        <span className="font-mono">{formatCurrency(dryingSummary.unloadingHamali)}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-muted-foreground">Drying Hamali</span>
                                        <span className="font-mono">{formatCurrency(dryingSummary.dryingHamali)}</span>
                                    </div>
                                </>
                            )}
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
                </CardContent>
                <CardFooter>
                    <SubmitButton />
                </CardFooter>
            </Card>
        </form>
    </div>
  );
}
