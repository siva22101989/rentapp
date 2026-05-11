'use client';

import { useTransition, useState, useEffect, useMemo } from 'react';
import { Loader2, Info } from 'lucide-react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase/provider';
import type { Customer, UnloadingRecord, Lot, StorageRecord, HamaliChargeItem, Commodity, WarehouseInfo } from '@/lib/definitions';
import { doc, writeBatch, increment, collection } from 'firebase/firestore';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
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
    
    const selectedCustomer = useMemo(() =>
        selectedUnloadingRecord ? customers.find(c => c.id === selectedUnloadingRecord.customerId) : null
    , [customers, selectedUnloadingRecord]);

    const bagsRemainingOnRecord = selectedUnloadingRecord ? selectedUnloadingRecord.bagsUnloaded - (selectedUnloadingRecord.bagsSentToDrying || 0) : 0;
    
    const { totalCustomerCharge, totalWorkerPayable, extraDryingDays, proportionalUnloadingHamali } = useMemo(() => {
        let extraDays = 0;
        try {
            const start = parseManualDate(dryingStartDate);
            const end = parseManualDate(dryingEndDate);
            if (start && end && end >= start) {
                const days = differenceInDays(end, start);
                extraDays = days > 0 ? days : 0;
            }
        } catch (e) { /* ignore */ }

        const pavH = (Number(bagsForDrying) || 0) * (Number(pavHamaliPerBag) || 0) * extraDays;
        const cuppaH = (Number(bagsForDrying) || 0) * (Number(cuppaHamaliPerBag) || 0) * extraDays;
        const d1DryingHamali = (Number(bagsForDrying) || 0) * (Number(customerDay1HamaliRate) || 0);

        const pUnloadingHamali = selectedUnloadingRecord 
            ? ((selectedUnloadingRecord.hamaliPerBag || 0) * (Number(bagsForDrying) || 0))
            : 0;

        const totalCustCharge = pUnloadingHamali + d1DryingHamali + pavH + cuppaH;
        const wHamaliDay1 = (Number(bagsForDrying) || 0) * (Number(workerHamaliPerBag) || 0);
        const totalWorkerPay = pUnloadingHamali + wHamaliDay1 + pavH + cuppaH;
        
        return {
            totalCustomerCharge: totalCustCharge,
            totalWorkerPayable: totalWorkerPay,
            extraDryingDays: extraDays,
            proportionalUnloadingHamali: pUnloadingHamali,
        }
    }, [bagsForDrying, customerDay1HamaliRate, pavHamaliPerBag, cuppaHamaliPerBag, dryingStartDate, dryingEndDate, selectedUnloadingRecord, workerHamaliPerBag]);

    useEffect(() => {
        if (selectedUnloadingRecord) {
            setFormData((prev: any) => ({
                ...prev,
                bagsForDrying: bagsRemainingOnRecord,
                bagsPacked: bagsRemainingOnRecord, 
            }));
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

    const handlePartialSave = async () => {
        if (!firestore || !appUser?.warehouseId) return;

        const start = parseManualDate(formData.dryingStartDate);
        if (!start) {
            setErrors(prev => ({...prev, dryingStartDate: 'Invalid format. Use DD-MM-YYYY'}));
            return;
        }

        const data = formData;
        const selectedRecordOnSubmit = unloadingRecords.find(ur => ur.id === data.unloadingRecordId);
        if (!selectedRecordOnSubmit || !data.bagsForDrying) return;

        setIsPartialSaving(true);
        try {
            const { bagsForDrying, customerHamaliPerBag, pavHamaliPerBag, cuppaHamaliPerBag, dryingEndDate } = data;
            
            const hamaliDetails: HamaliChargeItem[] = [];
            const currentProportionalUnloadingHamali = (selectedRecordOnSubmit.hamaliPerBag || 0) * bagsForDrying;
            if (currentProportionalUnloadingHamali > 0) {
                hamaliDetails.push({ description: 'Unloading Hamali', bags: bagsForDrying, rate: selectedRecordOnSubmit.hamaliPerBag || 0, amount: currentProportionalUnloadingHamali });
            }
            
            const day1DryingCustomerHamali = bagsForDrying * (customerHamaliPerBag || 0);
            if (day1DryingCustomerHamali > 0) {
                hamaliDetails.push({ description: 'Customer Hamali', bags: bagsForDrying, rate: customerHamaliPerBag || 0, amount: day1DryingCustomerHamali });
            }
            
            let extraDaysForSave = 0;
            const end = parseManualDate(dryingEndDate);
            if (start && end && end >= start) {
                extraDaysForSave = differenceInDays(end, start);
            }

            const pavHamaliAmount = bagsForDrying * (pavHamaliPerBag || 0) * extraDaysForSave;
            const cuppaHamaliAmount = bagsForDrying * (cuppaHamaliPerBag || 0) * extraDaysForSave;
            if (pavHamaliAmount > 0) hamaliDetails.push({ description: 'Pav Hamali', bags: bagsForDrying, rate: pavHamaliPerBag || 0, amount: pavHamaliAmount });
            if (cuppaHamaliAmount > 0) hamaliDetails.push({ description: 'Cuppa Hamali', bags: bagsForDrying, rate: cuppaHamaliPerBag || 0, amount: cuppaHamaliAmount });

            const totalCustomerChargeForSave = hamaliDetails.reduce((sum, item) => sum + item.amount, 0);

            const newDryingRecordData = {
                warehouseId: appUser.warehouseId,
                unloadingRecordId: data.unloadingRecordId,
                customerId: selectedRecordOnSubmit.customerId,
                commodityDescription: selectedRecordOnSubmit.commodityDescription,
                bagsForDrying: data.bagsForDrying,
                bagsPacked: data.bagsPacked,
                status: 'Drying' as const,
                dryingStartDate: start,
                packingDate: end,
                hamaliDetails,
                totalDryingHamali: totalCustomerChargeForSave,
                workerHamaliPayable: totalWorkerPayable,
            };

            const batch = writeBatch(firestore);
            const newDryingRecordRef = doc(collection(firestore, 'dryingRecords'));
            batch.set(newDryingRecordRef, cleanForFirestore(newDryingRecordData));
            const unloadingRecordRef = doc(firestore, 'unloadingRecords', data.unloadingRecordId);
            batch.update(unloadingRecordRef, { bagsSentToDrying: increment(data.bagsForDrying) });
            await batch.commit();

            toast({ title: "Partial Save Successful", description: `${data.bagsForDrying} bags moved to plot.` });
            setFormData(initialFormData);
        } catch (error) {
            console.error(error);
            toast({ title: 'Error', description: 'Failed to save.', variant: 'destructive' });
        } finally {
            setIsPartialSaving(false);
        }
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

        const receiptUrl = `/inflow/receipt/${nextId}`;
        const receiptWindow = window.open(receiptUrl, '_blank');

        startTransition(async () => {
            try {
                const commodityDetails = commodities.find(c => c.name === selectedRecordOnSubmit.commodityDescription);
                if (!commodityDetails) {
                    toast({ title: 'Error', description: `Commodity "${selectedRecordOnSubmit.commodityDescription}" not configured.`, variant: 'destructive' });
                    if (receiptWindow) receiptWindow.close();
                    return;
                }
                
                const bagsStored = data.bagsPacked;
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
                    bagsIn: bagsStored,
                    bagsForDrying: data.bagsForDrying,
                    bagsOut: 0,
                    bagsStored: bagsStored,
                    storageStartDate: endDate,
                    storageEndDate: null,
                    billingCycle: '6-Month Initial' as const,
                    payments: [],
                    hamaliPayable: totalHamaliForCustomer,
                    workerHamaliPayable: totalWorkerPayable,
                    totalRentBilled: 0,
                    lorryTractorNo: selectedRecordOnSubmit?.lorryTractorNo || '',
                    weight: 0,
                    inflowType: 'Plot' as const,
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
                
            } catch (error) {
                console.error(error);
                toast({ title: 'Error', description: 'Failed to create storage record.', variant: 'destructive' });
                if (receiptWindow) receiptWindow.close();
            }
        });
    };

  return (
    <Card>
        <form onSubmit={handleSubmit}>
            <CardHeader>
                <CardTitle>Finalize Drying & Create Storage Record</CardTitle>
                <CardDescription>
                    Manual date entry format: DD-MM-YYYY.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex flex-col space-y-2">
                    <Label>Unloading Queue (Select Record)</Label>
                    <Combobox
                        options={unloadingQueueOptions}
                        value={formData.unloadingRecordId}
                        onChange={(value) => handleValueChange('unloadingRecordId', value)}
                        placeholder="Select an unloading bill..."
                        searchPlaceholder="Search by bill, customer..."
                    />
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="bagsForDrying">Bags Plotted for Drying</Label>
                        <Input id="bagsForDrying" name="bagsForDrying" type="number" step="0.01" value={formData.bagsForDrying} onChange={handleInputChange} disabled={!selectedUnloadingRecord} />
                        {errors.bagsForDrying && <p className="text-sm font-medium text-destructive">{errors.bagsForDrying}</p>}
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="bagsPacked">Bags Packed (Final)</Label>
                        <Input id="bagsPacked" name="bagsPacked" type="number" step="0.01" value={formData.bagsPacked} onChange={handleInputChange} disabled={!selectedUnloadingRecord}/>
                        {errors.bagsPacked && <p className="text-sm font-medium text-destructive">{errors.bagsPacked}</p>}
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="dryingStartDate">Drying Start Date (DD-MM-YYYY)</Label>
                        <Input id="dryingStartDate" name="dryingStartDate" placeholder="DD-MM-YYYY" value={formData.dryingStartDate} onChange={handleInputChange} disabled={!selectedUnloadingRecord} />
                        {errors.dryingStartDate && <p className="text-sm font-medium text-destructive">{errors.dryingStartDate}</p>}
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="dryingEndDate">Packing/Storage Date (DD-MM-YYYY)</Label>
                        <Input id="dryingEndDate" name="dryingEndDate" placeholder="DD-MM-YYYY" value={formData.dryingEndDate} onChange={handleInputChange} disabled={!selectedUnloadingRecord} />
                        {errors.dryingEndDate && <p className="text-sm font-medium text-destructive">{errors.dryingEndDate}</p>}
                    </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="customerHamaliPerBag">Cust. Hamali Rate</Label>
                        <Input id="customerHamaliPerBag" name="customerHamaliPerBag" type="number" step="0.01" value={formData.customerHamaliPerBag} onChange={handleInputChange} disabled={!selectedUnloadingRecord} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="workerHamaliPerBag">Worker Rate</Label>
                        <Input id="workerHamaliPerBag" name="workerHamaliPerBag" type="number" step="0.01" value={formData.workerHamaliPerBag} onChange={handleInputChange} disabled={!selectedUnloadingRecord} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="pavHamaliPerBag">Pav Rate/Day</Label>
                        <Input id="pavHamaliPerBag" name="pavHamaliPerBag" type="number" step="0.01" value={formData.pavHamaliPerBag} onChange={handleInputChange} disabled={!selectedUnloadingRecord} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="cuppaHamaliPerBag">Cuppa Rate/Day</Label>
                        <Input id="cuppaHamaliPerBag" name="cuppaHamaliPerBag" type="number" step="0.01" value={formData.cuppaHamaliPerBag} onChange={handleInputChange} disabled={!selectedUnloadingRecord} />
                    </div>
                </div>

                <Separator />

                <div className="space-y-2 pt-2">
                    <div className="flex justify-between items-center font-semibold text-lg">
                        <span>Total Hamali (Customer)</span>
                        <span className="font-mono">{formatCurrency(totalCustomerCharge)}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm text-muted-foreground">
                        <span>Total Hamali (Worker)</span>
                        <span className="font-mono">{formatCurrency(totalWorkerPayable)}</span>
                    </div>
                </div>
            </CardContent>
            <CardFooter className="flex flex-col sm:flex-row gap-2">
                <Button type="button" variant="secondary" onClick={handlePartialSave} disabled={isPending || isPartialSaving || !selectedUnloadingRecord} className="w-full">
                    {isPartialSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Start Drying (Save)'}
                </Button>
                <Button type="submit" disabled={isPending || isPartialSaving || !selectedUnloadingRecord} className="w-full">
                    {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Create Final Inflow'}
                </Button>
            </CardFooter>
        </form>
    </Card>
  );
}
