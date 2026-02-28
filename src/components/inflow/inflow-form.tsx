
'use client';

import { useTransition, useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Customer, Payment, Commodity, Lot, StorageRecord } from '@/lib/definitions';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { Separator } from '../ui/separator';
import { formatCurrency, cleanForFirestore } from '@/lib/utils';
import { useFirestore } from '@/firebase';
import { setDoc, doc } from 'firebase/firestore';
import { Combobox } from '../ui/combobox';

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

export function InflowForm({ customers, commodities, lots, records, nextSerialNumber }: { customers: Customer[], commodities: Commodity[], lots: Lot[], records: StorageRecord[], nextSerialNumber: string }) {
    const { toast } = useToast();
    const router = useRouter();
    const firestore = useFirestore();
    const [isPending, startTransition] = useTransition();

    const [bags, setBags] = useState<number | ''>('');
    const [rate, setRate] = useState<number | ''>('');
    const [hamali, setHamali] = useState(0);
    const [hamaliPaid, setHamaliPaid] = useState<number | ''>('');
    const [selectedCustomerId, setSelectedCustomerId] = useState('');
    const [commodityDescription, setCommodityDescription] = useState('');
    const [weight, setWeight] = useState<number | ''>('');
    const [khataAmount, setKhataAmount] = useState<number | ''>('');
    const [selectedLot, setSelectedLot] = useState('');

    const customerOptions = customers.map(c => ({ value: c.id, label: c.name }));

    const lotOccupancy = useMemo(() => {
        const occupancy: { [lotName: string]: number } = {};
        records.forEach(record => {
            if (record.location && record.bagsStored > 0) {
                occupancy[record.location] = (occupancy[record.location] || 0) + record.bagsStored;
            }
        });
        return occupancy;
    }, [records]);

    useEffect(() => {
        const bagsValue = bags || 0;
        const rateValue = rate || 0;
        
        const currentHamali = bagsValue * rateValue;
        setHamali(currentHamali);

    }, [bags, rate]);
    
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
                 if (!bagsStored || bagsStored <= 0) {
                     toast({ title: 'Error', description: 'Number of bags must be a positive number.', variant: 'destructive' });
                     return;
                }
                const weightValue = Number(data.weight) || 0;
                const hamaliRate = Number(data.hamaliRate) || 0;
                const hamaliPaidAmount = Number(data.hamaliPaid) || 0;

                const hamaliPayable = bagsStored * hamaliRate;

                const payments: Payment[] = [];
                if (hamaliPaidAmount > 0) {
                    payments.push({
                        amount: hamaliPaidAmount,
                        date: new Date(data.storageStartDate as string),
                        type: 'hamali'
                    });
                }
                
                const rawRecord = {
                    id: nextSerialNumber,
                    customerId: data.customerId,
                    commodityDescription: data.commodityDescription,
                    location: data.location,
                    bagsIn: bagsStored,
                    bagsOut: 0,
                    bagsStored,
                    storageStartDate: new Date(data.storageStartDate as string),
                    storageEndDate: null,
                    billingCycle: '6-Month Initial' as const,
                    payments,
                    hamaliPayable,
                    totalRentBilled: 0,
                    lorryTractorNo: data.lorryTractorNo,
                    weight: weightValue,
                    inflowType: 'Direct' as const,
                    dryingRecordId: '',
                    khataAmount: Number(data.khataAmount) || 0
                };

                await setDoc(doc(firestore, "storageRecords", nextSerialNumber), cleanForFirestore(rawRecord));

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
                        <Label htmlFor="customerId">Customer</Label>
                        <Combobox
                            options={customerOptions}
                            value={selectedCustomerId}
                            onChange={setSelectedCustomerId}
                            placeholder="Select a customer..."
                            searchPlaceholder="Search customers..."
                            emptyPlaceholder="No customer found."
                        />
                        <input type="hidden" name="customerId" value={selectedCustomerId} />
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="commodityDescription">Product</Label>
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
                        </div>
                         <div className="space-y-2">
                            <Label htmlFor="location">Lot No.</Label>
                            <Select name="location" required onValueChange={setSelectedLot} value={selectedLot}>
                                <SelectTrigger id="location">
                                    <SelectValue placeholder="Select a lot" />
                                </SelectTrigger>
                                <SelectContent>
                                    {lots
                                        .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
                                        .map(lot => {
                                            const occupied = lotOccupancy[lot.name] || 0;
                                            const capacity = lot.capacity ? ` / ${lot.capacity}` : '';
                                            return (
                                                <SelectItem key={lot.id} value={lot.name}>
                                                    {lot.name} ({occupied}{capacity} bags)
                                                </SelectItem>
                                            )
                                    })}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                </CardContent>
                <CardFooter>
                    <SubmitButton />
                </CardFooter>
            </Card>
        </form>
    </div>
  );
}
