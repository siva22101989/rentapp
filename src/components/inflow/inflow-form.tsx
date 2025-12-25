
'use client';

import { useActionState, useEffect, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { addInflow, type InflowFormState } from '@/lib/actions';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Customer, DryingRecord } from '@/lib/definitions';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Info } from 'lucide-react';
import { Separator } from '../ui/separator';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { format, differenceInDays } from 'date-fns';
import { toDate, formatCurrency } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';

function SubmitButton() {
    const { pending } = useFormStatus();
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

export function InflowForm({ customers, dryingRecords, nextSerialNumber }: { customers: Customer[], dryingRecords: DryingRecord[], nextSerialNumber: string }) {
    const { toast } = useToast();
    const initialState: InflowFormState = { message: '', success: false };
    const [state, formAction] = useActionState(addInflow, initialState);

    const [bags, setBags] = useState(0);
    const [commodityDescription, setCommodityDescription] = useState('');
    const [rate, setRate] = useState(0);
    const [hamali, setHamali] = useState(0);
    const [hamaliPaid, setHamaliPaid] = useState(0);
    const [selectedCustomerId, setSelectedCustomerId] = useState('');
    const [inflowType, setInflowType] = useState<'Direct' | 'Plot'>('Direct');
    
    const [selectedDryingRecordId, setSelectedDryingRecordId] = useState('');

    const selectedCustomer = customers.find(c => c.id === selectedCustomerId);
    const customerDryingRecords = dryingRecords.filter(dr => dr.customerId === selectedCustomerId);
    const selectedDryingRecord = dryingRecords.find(dr => dr.id === selectedDryingRecordId);

    useEffect(() => {
        if (state.message) {
            if (state.success) {
                toast({
                    title: 'Success!',
                    description: state.message,
                });
            } else {
                toast({
                    title: 'Error',
                    description: state.message,
                    variant: 'destructive',
                });
            }
        }
    }, [state, toast]);

    useEffect(() => {
        const bagsValue = inflowType === 'Plot' ? (selectedDryingRecord?.bagsPacked || 0) : bags;
        const rateValue = rate || 0;
        
        const calculatedHamali = (bagsValue || 0) * rateValue;
        setHamali(calculatedHamali);
    }, [bags, selectedDryingRecord, rate, inflowType]);
    
    useEffect(() => {
      if (inflowType === 'Plot' && selectedDryingRecord) {
        setCommodityDescription(selectedDryingRecord.commodityDescription);
        setBags(selectedDryingRecord.bagsPacked || 0);
      } else {
         if (inflowType === 'Direct') {
            setCommodityDescription('');
            setBags(0);
        }
      }
    }, [inflowType, selectedDryingRecord]);

    useEffect(() => {
        setSelectedDryingRecordId('');
    }, [selectedCustomerId]);

    useEffect(() => {
        setBags(0);
        setRate(0);
        setHamali(0);
        setHamaliPaid(0);
        setSelectedCustomerId('');
        setSelectedDryingRecordId('');
        setCommodityDescription('');
    }, [inflowType]);

    const getPlotDuration = () => {
        if (!selectedDryingRecord || !selectedDryingRecord.dryingStartDate || !selectedDryingRecord.packingDate) return 0;
        const start = toDate(selectedDryingRecord.dryingStartDate);
        const end = toDate(selectedDryingRecord.packingDate);
        return differenceInDays(end, start) + 1; // Add 1 to be inclusive
    }


  return (
    <div className="flex justify-center">
        <form action={formAction} className="w-full max-w-lg">
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

                    {selectedCustomer && inflowType === 'Direct' && (
                         <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="fatherName">Father's Name</Label>
                                <Input id="fatherName" name="fatherName" defaultValue={selectedCustomer.fatherName} />
                            </div>
                             <div className="space-y-2">
                                <Label htmlFor="village">Village</Label>
                                <Input id="village" name="village" defaultValue={selectedCustomer.village} />
                            </div>
                        </div>
                    )}
                    
                    {inflowType === 'Plot' && selectedCustomerId && (
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
                    )}

                    {inflowType === 'Plot' && selectedDryingRecord && (
                        <Alert>
                            <Info className="h-4 w-4" />
                            <AlertTitle>Drying Process Summary</AlertTitle>
                            <AlertDescription>
                                <div className="space-y-1 mt-2 text-sm">
                                    <div className="flex justify-between"><span className="text-muted-foreground">Bags Plotted:</span> <strong>{selectedDryingRecord.bagsForDrying}</strong></div>
                                    <div className="flex justify-between"><span className="text-muted-foreground">Bags Packed:</span> <strong>{selectedDryingRecord.bagsPacked}</strong></div>
                                    <div className="flex justify-between"><span className="text-muted-foreground">Drying Hamali:</span> <strong>{formatCurrency(selectedDryingRecord.totalDryingHamali)}</strong></div>
                                    <div className="flex justify-between"><span className="text-muted-foreground">Duration in Plot:</span> <strong>{getPlotDuration()} days</strong></div>
                                </div>
                            </AlertDescription>
                        </Alert>
                    )}


                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="commodityDescription">Product</Label>
                            <Input 
                                id="commodityDescription" 
                                name="commodityDescription" 
                                placeholder="e.g., Paddy (NDL)" 
                                required
                                value={commodityDescription}
                                onChange={(e) => setCommodityDescription(e.target.value)}
                                readOnly={inflowType === 'Plot'}
                             />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="location">Lot No.</Label>
                            <Input id="location" name="location" placeholder="e.g., E2/middle" />
                        </div>
                    </div>
                     <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="lorryTractorNo">Lorry / Tractor No.</Label>
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
                                onChange={e => setBags(Number(e.target.value))}
                                value={bags || ''}
                                readOnly={inflowType === 'Plot'}
                            />
                        </div>
                         <div className="space-y-2">
                            <Label htmlFor="weight">Weight</Label>
                            <Input id="weight" name="weight" type="number" step="0.01" placeholder="0.00" />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="hamaliRate">Hamali Rate (per bag)</Label>
                            <Input id="hamaliRate" name="hamaliRate" type="number" placeholder="0.00" step="0.01" onChange={e => setRate(Number(e.target.value))}/>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="hamaliPaid">Hamali Paid Now</Label>
                            <Input id="hamaliPaid" name="hamaliPaid" type="number" placeholder="0.00" step="0.01" onChange={e => setHamaliPaid(Number(e.target.value))}/>
                        </div>
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="khataAmount">Khata Amount (Weighbridge)</Label>
                        <Input id="khataAmount" name="khataAmount" type="number" placeholder="0.00" step="0.01" />
                    </div>
                     <Separator />
                    <div className="space-y-4">
                        <h4 className="font-medium">Billing Summary</h4>
                        <div className="space-y-2">
                             <div className="flex justify-between items-center text-sm">
                                <span className="text-muted-foreground">Total Hamali Payable</span>
                                <span className="font-mono">₹{hamali.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between items-center font-semibold text-base">
                                <span className="text-destructive">Hamali Pending</span>
                                <span className="font-mono text-destructive">₹{(hamali - hamaliPaid).toFixed(2)}</span>
                            </div>
                            <p className="text-xs text-muted-foreground">
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

    