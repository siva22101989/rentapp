'use client';

import { useTransition, useState, useEffect, useMemo } from 'react';
import { Loader2, Calculator } from 'lucide-react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase/provider';
import type { Customer, UnloadingRecord, Lot, StorageRecord, HamaliChargeItem, Commodity, WarehouseInfo } from '@/lib/definitions';
import { doc, writeBatch, increment, collection } from 'firebase/firestore';
import { formatCurrency, cleanForFirestore, toDate, formatManualDate, parseManualDate } from '@/lib/utils';
import { Separator } from '../ui/separator';
import { Combobox } from '../ui/combobox';
import { differenceInDays, format } from 'date-fns';
import { useDoc } from '@/firebase/firestore/use-doc';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { useAppUser } from '@/firebase/auth/use-user';
import { sendSms } from '@/lib/sms';
import { z } from 'zod';

const InitiateDryingSchema = z.object({
  unloadingRecordId: z.string().min(1, 'An unloading bill is required.'),
  dryingStartDate: z.string().min(1, "Start date is required."),
  dryingEndDate: z.string().min(1, "End date is required."),
  customerHamaliPerBag: z.coerce.number().nonnegative('Customer hamali rate must be non-negative.'),
  workerHamaliPerBag: z.coerce.number().nonnegative('Worker hamali rate must be non-negative.'),
  pavHamaliPerBag: z.coerce.number().nonnegative('Pav hamali rate must be non-negative.').optional(),
  cuppaHamaliPerBag: z.coerce.number().nonnegative('Cuppa hamali rate must be non-negative.').optional(),
  bagsForDrying: z.coerce.number().positive('Bags sent to plot for drying must be positive.'),
  bagsPacked: z.coerce.number().positive("Bags packed must be a positive number."),
});

interface InitiateDryingFormProps {
    customers: Customer[];
    unloadingRecords: UnloadingRecord[];
    lots: Lot[];
    storageRecords: StorageRecord[];
    commodities: Commodity[];
}

export function InitiateDryingForm({ customers, unloadingRecords, storageRecords, commodities }: InitiateDryingFormProps) {
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();
    const [isPartialSaving, setIsPartialSaving] = useState(false);
    const firestore = useFirestore();
    const appUser = useAppUser();
    const [sendSmsNotification, setSendSmsNotification] = useState(true);

    const initialFormData = {
      unloadingRecordId: '',
      dryingStartDate: formatManualDate(new Date()),
      dryingEndDate: formatManualDate(new Date()),
      customerHamaliPerBag: 0,
      workerHamaliPerBag: 0,
      pavHamaliPerBag: 0,
      cuppaHamaliPerBag: 0,
      bagsForDrying: 0,
      bagsPacked: 0,
    };
    const [formData, setFormData] = useState<any>(initialFormData);
    const [errors, setErrors] = useState<Record<string, string | undefined>>({});

    const warehouseInfoRef = useMemoFirebase(
      () => (firestore && appUser?.warehouseId ? doc(firestore, 'warehouses', appUser.warehouseId) : null),
      [firestore, appUser]
    );
    const { data: warehouseInfo } = useDoc<WarehouseInfo>(warehouseInfoRef);

    const unloadingQueueOptions = useMemo(() => {
        const customerMap = new Map(customers.map(c => [c.id, c.name]));
        return unloadingRecords
            .sort((a, b) => toDate(a.unloadingDate).getTime() - toDate(b.unloadingDate).getTime())
            .map(ur => ({
                value: ur.id,
                label: `Bill #${ur.billNo} - ${customerMap.get(ur.customerId) || 'Unknown'} - ${ur.bagsUnloaded - (ur.bagsSentToDrying || 0)} bags`
            }));
    }, [unloadingRecords, customers]);

    const { unloadingRecordId: selectedUnloadingRecordId, bagsForDrying, customerHamaliPerBag: customerDay1HamaliRate, pavHamaliPerBag, cuppaHamaliPerBag, dryingStartDate, dryingEndDate, workerHamaliPerBag } = formData;
    
    const selectedUnloadingRecord = useMemo(() => 
        unloadingRecords.find(ur => ur.id === selectedUnloadingRecordId)
    , [unloadingRecords, selectedUnloadingRecordId]);
    
    const bagsRemainingOnRecord = selectedUnloadingRecord ? selectedUnloadingRecord.bagsUnloaded - (selectedUnloadingRecord.bagsSentToDrying || 0) : 0;
    
    const { totalCustomerCharge, totalWorkerPayable, extraDryingDays, proportionalUnloadingHamali, unloadingRate } = useMemo(() => {
        let extraDays = 0;
        try {
            const start = parseManualDate(dryingStartDate);
            const end = parseManualDate(dryingEndDate);
            if (start && end && end >= start) {
                const days = differenceInDays(end, start);
                extraDays = days > 0 ? days : 0;
            }
        } catch (e) { }

        const bags = Number(bagsForDrying) || 0;
        const uRate = selectedUnloadingRecord?.hamaliPerBag || 0;
        
        const pUnloadingHamali = uRate * bags;
        const d1DryingHamali = bags * (Number(customerDay1HamaliRate) || 0);
        const pavH = bags * (Number(pavHamaliPerBag) || 0) * extraDays;
        const cuppaH = bags * (Number(cuppaHamaliPerBag) || 0) * extraDays;

        const totalCustCharge = pUnloadingHamali + d1DryingHamali + pavH + cuppaH;
        const wHamaliDay1 = bags * (Number(workerHamaliPerBag) || 0);
        const totalWorkerPay = pUnloadingHamali + wHamaliDay1 + pavH + cuppaH;
        
        return { totalCustomerCharge: totalCustCharge, totalWorkerPayable: totalWorkerPay, extraDryingDays: extraDays, proportionalUnloadingHamali: pUnloadingHamali, unloadingRate: uRate }
    }, [bagsForDrying, customerDay1HamaliRate, pavHamaliPerBag, cuppaHamaliPerBag, dryingStartDate, dryingEndDate, selectedUnloadingRecord, workerHamaliPerBag]);

    useEffect(() => {
        if (selectedUnloadingRecord) {
            setFormData((prev: any) => ({ ...prev, bagsForDrying: bagsRemainingOnRecord, bagsPacked: bagsRemainingOnRecord }));
        }
    }, [selectedUnloadingRecordId, bagsRemainingOnRecord, selectedUnloadingRecord]);

    const nextId = useMemo(() => {
        if (!storageRecords) return '1';
        const maxId = storageRecords.reduce((max, r) => {
            const idNum = parseInt(r.id.replace(/[^0-9]/g, ''), 10);
            return isNaN(idNum) ? max : Math.max(max, idNum);
        }, 0);
        return (maxId + 1).toString();
    }, [storageRecords]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData((prev: any) => ({ ...prev, [name]: value }));
    };

    const handleValueChange = (name: string, value: any) => {
        setFormData((prev: any) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setErrors({});

        const startDate = parseManualDate(formData.dryingStartDate);
        const endDate = parseManualDate(formData.dryingEndDate);

        if (!startDate || !endDate) {
            toast({ title: 'Invalid Dates', description: 'Please use DD-MM-YYYY format.', variant: 'destructive' });
            return;
        }

        const validationResult = InitiateDryingSchema.safeParse(formData);
        if (!validationResult.success) {
          toast({ title: 'Validation Error', description: 'Please fix the errors in the form.', variant: 'destructive' });
          return;
        }

        const data = validationResult.data;
        const selectedRecordOnSubmit = unloadingRecords.find(ur => ur.id === data.unloadingRecordId);
        if (!selectedRecordOnSubmit || !firestore || !appUser?.warehouseId) return;

        // Run your asynchronous business logic cleanly
        const submitData = async () => {
            try {
                const commodityDetails = commodities.find(c => c.name === selectedRecordOnSubmit.commodityDescription);
                if (!commodityDetails) {
                    toast({ title: 'Error', description: `Commodity not configured.`, variant: 'destructive' });
                    return;
                }
                
                const hamaliDetails: HamaliChargeItem[] = [];
                const currentProportionalUnloadingHamali = (selectedRecordOnSubmit.hamaliPerBag || 0) * data.bagsForDrying;
                if (currentProportionalUnloadingHamali > 0) hamaliDetails.push({ description: 'Unloading Hamali', bags: data.bagsForDrying, rate: selectedRecordOnSubmit.hamaliPerBag || 0, amount: currentProportionalUnloadingHamali });
                
                const dryingDay1CustomerHamali = data.bagsForDrying * data.customerHamaliPerBag;
                if (dryingDay1CustomerHamali > 0) hamaliDetails.push({ description: 'Customer Hamali', bags: data.bagsForDrying, rate: data.customerHamaliPerBag, amount: dryingDay1CustomerHamali });
                
                const totalDryingDays = differenceInDays(endDate, startDate) + 1;
                const extraDays = totalDryingDays > 1 ? totalDryingDays - 1 : 0;
                
                const pavHamaliAmount = data.bagsForDrying * (data.pavHamaliPerBag || 0) * extraDays;
                if (pavHamaliAmount > 0) hamaliDetails.push({ description: 'Pav Hamali', bags: data.bagsForDrying, rate: data.pavHamaliPerBag || 0, amount: pavHamaliAmount });
                
                const cuppaHamaliAmount = data.bagsForDrying * (data.cuppaHamaliPerBag || 0) * extraDays;
                if (cuppaHamaliAmount > 0) hamaliDetails.push({ description: 'Cuppa Hamali', bags: data.bagsForDrying, rate: data.cuppaHamaliPerBag || 0, amount: cuppaHamaliAmount });
                
                const totalHamaliForCustomer = hamaliDetails.reduce((sum, item) => sum + item.amount, 0);
                const batch = writeBatch(firestore);

                const newStorageRecord: Omit<StorageRecord, 'id'> = {
                    warehouseId: appUser.warehouseId,
                    customerId: selectedRecordOnSubmit.customerId,
                    commodityDescription: selectedRecordOnSubmit.commodityDescription,
                    location: selectedRecordOnSubmit.location || '',
                    bagsIn: data.bagsPacked,
                    bagsForDrying: data.bagsForDrying,
                    bagsOut: 0,
                    bagsStored: data.bagsPacked,
                    storageStartDate: endDate,
                    storageEndDate: null,
                    billingCycle: '6-Month Initial',
                    payments: [],
                    hamaliPayable: totalHamaliForCustomer,
                    workerHamaliPayable: totalWorkerPayable,
                    totalRentBilled: 0,
                    lorryTractorNo: selectedRecordOnSubmit?.lorryTractorNo || '',
                    weight: 0,
                    inflowType: 'Plot',
                    dryingRecordId: data.unloadingRecordId,
                    khataAmount: 0,
                    dryingStartDate: startDate,
                    dryingEndDate: endDate,
                    hamaliDetails: hamaliDetails,
                    billingType: commodityDetails.billingType,
                    monthlyRate: commodityDetails.monthlyRate,
                    minBillingMonths: commodityDetails.minBillingMonths,
                    insuranceRate: commodityDetails.insuranceRate,
                    rate6Months: commodityDetails.rate6Months,
                    rate1Year: commodityDetails.rate1Year,
                };
                
                const newStorageRecordRef = doc(firestore, 'storageRecords', nextId);
                batch.set(newStorageRecordRef, cleanForFirestore(newStorageRecord));
                const unloadingRecordRef = doc(firestore, 'unloadingRecords', data.unloadingRecordId);
                batch.update(unloadingRecordRef, { bagsSentToDrying: increment(data.bagsForDrying) });
                await batch.commit();
                
                toast({ title: 'Success', description: `Storage record created.` });
                setFormData(initialFormData);
                window.open(`/inflow/receipt?recordId=${nextId}`, '_blank');
            } catch (error) {
                console.error(error);
                toast({ title: 'Error', description: 'Failed to create storage record.', variant: 'destructive' });
            }
        };

        // Wrap execution inside the synchronous startTransition block
        startTransition(() => {
            submitData();
        });
    };

  return (
    <Card>
        <form onSubmit={handleSubmit}>
            <CardHeader>
                <CardTitle>Finalize Drying & Create Storage Record</CardTitle>
                <CardDescription>Format: DD-MM-YYYY. Calculations are based on Truck/Plot Bags.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex flex-col space-y-2">
                    <Label>Unloading Queue (Select Record)</Label>
                    <Combobox options={unloadingQueueOptions} value={formData.unloadingRecordId} onChange={(value) => handleValueChange('unloadingRecordId', value)} placeholder="Select an unloading bill..." searchPlaceholder="Search by bill, customer..." />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="bagsForDrying">Bags for Drying (Truck Count)</Label>
                        <Input id="bagsForDrying" name="bagsForDrying" type="number" step="0.01" value={formData.bagsForDrying} onChange={handleInputChange} disabled={!selectedUnloadingRecord} />
                        {errors.bagsForDrying && <p className="text-sm font-medium text-destructive">{errors.bagsForDrying}</p>}
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="bagsPacked">Bags Packed (Godown Final)</Label>
                        <Input id="bagsPacked" name="bagsPacked" type="number" step="0.01" value={formData.bagsPacked} onChange={handleInputChange} disabled={!selectedUnloadingRecord}/>
                        {errors.bagsPacked && <p className="text-sm font-medium text-destructive">{errors.bagsPacked}</p>}
                    </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="dryingStartDate">Drying Start Date (DD-MM-YYYY)</Label>
                        <Input id="dryingStartDate" name="dryingStartDate" placeholder="DD-MM-YYYY" value={formData.dryingStartDate} onChange={handleInputChange} disabled={!selectedUnloadingRecord} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="dryingEndDate">Packing/Storage Date (DD-MM-YYYY)</Label>
                        <Input id="dryingEndDate" name="dryingEndDate" placeholder="DD-MM-YYYY" value={formData.dryingEndDate} onChange={handleInputChange} disabled={!selectedUnloadingRecord} />
                    </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 border rounded-lg bg-muted/20">
                    <div className="space-y-2"><Label>Drying Rate</Label><Input name="customerHamaliPerBag" type="number" step="0.01" value={formData.customerHamaliPerBag} onChange={handleInputChange} disabled={!selectedUnloadingRecord} /></div>
                    <div className="space-y-2"><Label>Worker Rate</Label><Input name="workerHamaliPerBag" type="number" step="0.01" value={formData.workerHamaliPerBag} onChange={handleInputChange} disabled={!selectedUnloadingRecord} /></div>
                    <div className="space-y-2"><Label>Pav Rate</Label><Input name="pavHamaliPerBag" type="number" step="0.01" value={formData.pavHamaliPerBag} onChange={handleInputChange} disabled={!selectedUnloadingRecord} /></div>
                    <div className="space-y-2"><Label>Cuppa Rate</Label><Input name="cuppaHamaliPerBag" type="number" step="0.01" value={formData.cuppaHamaliPerBag} onChange={handleInputChange} disabled={!selectedUnloadingRecord} /></div>
                </div>
                <Separator />
                <div className="space-y-3 pt-2">
                    <h4 className="text-sm font-bold flex items-center gap-2"><Calculator className="h-4 w-4" /> Calculation Summary</h4>
                    <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
                        <div className="flex justify-between"><span>Unloading @ {unloadingRate}:</span><span className="font-mono">{formatCurrency(proportionalUnloadingHamali)}</span></div>
                        <div className="flex justify-between"><span>Drying (Day 1):</span><span className="font-mono">{formatCurrency((Number(bagsForDrying) || 0) * (Number(customerDay1HamaliRate) || 0))}</span></div>
                        <div className="flex justify-between"><span>Pav ({extraDryingDays} days):</span><span className="font-mono">{formatCurrency((Number(bagsForDrying) || 0) * (Number(pavHamaliPerBag) || 0) * extraDryingDays)}</span></div>
                        <div className="flex justify-between"><span>Cuppa ({extraDryingDays} days):</span><span className="font-mono">{formatCurrency((Number(bagsForDrying) || 0) * (Number(cuppaHamaliPerBag) || 0) * extraDryingDays)}</span></div>
                        <Separator className="col-span-2 my-2" />
                        <div className="col-span-2 flex justify-between items-center font-bold text-lg text-primary"><span>TOTAL BILLABLE HAMALI</span><span className="font-mono">{formatCurrency(totalCustomerCharge)}</span></div>
                    </div>
                </div>
            </CardContent>
            <CardFooter>
                <Button type="submit" disabled={isPending || !selectedUnloadingRecord} className="w-full">
                    {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Finalize & Create Bill'}
                </Button>
            </CardFooter>
        </form>
    </Card>
  );
}