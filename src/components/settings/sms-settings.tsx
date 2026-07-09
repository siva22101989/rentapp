'use client';

import { useTransition, useEffect, useState } from 'react';
import { Loader2, MessageSquare, Send, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useDoc, useAppUser } from '@/firebase';
import type { WarehouseInfo } from '@/lib/definitions';
import { doc, setDoc } from 'firebase/firestore';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { cleanForFirestore } from '@/lib/utils';
import { Skeleton } from '../ui/skeleton';
import { Separator } from '../ui/separator';
import { sendSms } from '@/lib/sms';
import { Label } from '../ui/label';
import { Switch } from '@/components/ui/switch';

const defaultTemplates = {
    inflow: 'Dear {customerName}, your inflow of {bags} bags of {commodity} has been recorded on {date}. Bill No: {billNo}. Hamali: {hamaliAmount}. Thank you. - {warehouseName}',
    outflow: 'Dear {customerName}, withdrawal of {bags} bags of {commodity} recorded. Invoice: {billNo},\nRent: {rent},\nTotal: {total}.\nThank you. - {warehouseName}.',
    unloading: 'Dear {customerName}, we have received your delivery of {bags} bags of {commodity} on {date}. Bill No: {billNo}. Hamali: {hamaliAmount}. Thank you. - {warehouseName}',
    payment: 'Dear {customerName}, thank you for your payment of {paymentAmount} on {date}. Your account has been updated. - {warehouseName}',
    pendingDues: 'Dear {customerName}, this is a reminder that you have an outstanding balance. Rent Due: {rentDue}, Hamali Due: {hamaliDue}, Total Due: {totalDue}. Please pay at your earliest convenience. Thank you. - {warehouseName}',
};

export function SmsSettings() {
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();
    const firestore = useFirestore();
    const appUser = useAppUser();

    const [testNumber, setTestNumber] = useState('');
    const [isTesting, startTestTransition] = useTransition();

    const [smsEnabled, setSmsEnabled] = useState(false);
    const [textbeeApiKey, setTextbeeApiKey] = useState('');
    const [textbeeDeviceId, setTextbeeDeviceId] = useState('');
    const [smsInflowTemplate, setSmsInflowTemplate] = useState('');
    const [smsOutflowTemplate, setSmsOutflowTemplate] = useState('');
    const [smsUnloadingTemplate, setSmsUnloadingTemplate] = useState('');
    const [smsPaymentTemplate, setSmsPaymentTemplate] = useState('');
    const [smsPendingDuesTemplate, setSmsPendingDuesTemplate] = useState('');

    const warehouseInfoRef = useMemoFirebase(
        () => (firestore && appUser?.warehouseId ? doc(firestore, 'warehouses', appUser.warehouseId) : null),
        [firestore, appUser]
    );
    const { data: warehouseInfo, loading: loadingInfo } = useDoc<WarehouseInfo>(warehouseInfoRef);

    useEffect(() => {
        if (warehouseInfo) {
            setSmsEnabled(warehouseInfo.smsEnabled ?? false);
            setTextbeeApiKey(warehouseInfo.textbeeApiKey || '');
            setTextbeeDeviceId(warehouseInfo.textbeeDeviceId || '');
            setSmsInflowTemplate(warehouseInfo.smsInflowTemplate || '');
            setSmsOutflowTemplate(warehouseInfo.smsOutflowTemplate || '');
            setSmsUnloadingTemplate(warehouseInfo.smsUnloadingTemplate || '');
            setSmsPaymentTemplate(warehouseInfo.smsPaymentTemplate || '');
            setSmsPendingDuesTemplate(warehouseInfo.smsPendingDuesTemplate || '');
        }
    }, [warehouseInfo]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!firestore || !appUser?.warehouseId) {
            toast({ title: 'Error', description: 'Firestore or user context not available.', variant: 'destructive' });
            return;
        }

        startTransition(async () => {
            try {
                const data = {
                    smsEnabled,
                    textbeeApiKey,
                    textbeeDeviceId,
                    smsInflowTemplate,
                    smsOutflowTemplate,
                    smsUnloadingTemplate,
                    smsPaymentTemplate,
                    smsPendingDuesTemplate,
                };
                const docRef = doc(firestore, 'warehouses', appUser.warehouseId);
                await setDoc(docRef, cleanForFirestore(data), { merge: true });
                toast({ title: 'Success', description: 'SMS settings saved.' });
            } catch (error) {
                console.error(error);
                toast({ title: 'Error', description: 'Failed to save SMS settings.', variant: 'destructive' });
            }
        });
    };

    const handleTestSms = () => {
        if (!testNumber) {
            toast({ title: 'Phone Number Required', description: 'Please enter a phone number to send a test SMS to.', variant: 'destructive' });
            return;
        }
        if (!textbeeApiKey) {
            toast({ title: 'API Key Required', description: 'Please save your textbee.dev API key before testing.', variant: 'destructive' });
            return;
        }

        startTestTransition(async () => {
            const result = await sendSms({
                apiKey: textbeeApiKey,
                deviceId: textbeeDeviceId,
                to: testNumber,
                message: 'This is a test message from your GrainDost application setup.'
            });

            if (result.success) {
                toast({ title: 'Test SMS Sent!', description: result.message });
            } else {
                toast({ title: 'Test SMS Failed', description: result.message, variant: 'destructive', duration: 10000 });
            }
        });
    }

    if (loadingInfo) {
        return (
            <Card className="mt-6">
                <CardHeader>
                    <Skeleton className="h-6 w-48" />
                    <Skeleton className="h-4 w-full max-w-lg" />
                </CardHeader>
                <CardContent className="space-y-4">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <div className="flex justify-end">
                        <Skeleton className="h-10 w-32" />
                    </div>
                </CardContent>
            </Card>
        );
    }

  return (
    <Card className="mt-6 border-primary/20 shadow-lg">
        <form onSubmit={handleSubmit}>
            <CardHeader className="bg-secondary/10 border-b">
                <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5 text-primary" />
                    SMS Configuration
                </CardTitle>
                <CardDescription>
                    Configure your textbee.dev account to enable sending SMS notifications to customers.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
                <div className="flex items-center justify-between p-4 rounded-xl border-2 border-primary/20 bg-primary/5">
                    <div className="space-y-0.5">
                        <Label htmlFor="smsEnabled" className="text-sm font-black uppercase tracking-widest text-primary">Global SMS Feature</Label>
                        <p className="text-xs text-muted-foreground font-medium">Turn this on to enable automated messaging across the entire application.</p>
                    </div>
                    <Switch 
                        id="smsEnabled" 
                        checked={smsEnabled} 
                        onCheckedChange={setSmsEnabled} 
                    />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                        <Label htmlFor="textbeeApiKey" className="text-[10px] font-black uppercase text-slate-500 tracking-wider">textbee.dev API Key</Label>
                        <Input id="textbeeApiKey" type="text" placeholder="Enter your API key" value={textbeeApiKey} onChange={e => setTextbeeApiKey(e.target.value)} className="h-10 font-mono text-[13px]" />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="textbeeDeviceId" className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Device ID (Optional)</Label>
                        <Input id="textbeeDeviceId" type="text" placeholder="Enter your Device ID" value={textbeeDeviceId} onChange={e => setTextbeeDeviceId(e.target.value)} className="h-10 font-mono text-[13px]" />
                    </div>
                </div>
                
                <Separator className="my-4" />
                <h3 className="text-sm font-black uppercase tracking-[0.2em] text-slate-400 mb-2">SMS Templates</h3>

                <div className="space-y-4">
                    <div className="space-y-1.5">
                        <Label htmlFor="smsInflowTemplate" className="text-xs font-bold text-slate-700">Inflow Template</Label>
                        <Textarea id="smsInflowTemplate" placeholder={defaultTemplates.inflow} value={smsInflowTemplate} onChange={e => setSmsInflowTemplate(e.target.value)} className="text-sm min-h-[80px]" />
                        <p className="text-[10px] text-muted-foreground font-medium italic">Placeholders: {`{customerName}, {bags}, {commodity}, {billNo}, {date}, {hamaliAmount}`}</p>
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="smsOutflowTemplate" className="text-xs font-bold text-slate-700">Outflow Template</Label>
                        <Textarea id="smsOutflowTemplate" placeholder={defaultTemplates.outflow} value={smsOutflowTemplate} onChange={e => setSmsOutflowTemplate(e.target.value)} className="text-sm min-h-[80px]" />
                        <p className="text-[10px] text-muted-foreground font-medium italic">Placeholders: {`{customerName}, {bags}, {commodity}, {billNo}, {rent}, {total}`}</p>
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="smsUnloadingTemplate" className="text-xs font-bold text-slate-700">Unloading Template</Label>
                        <Textarea id="smsUnloadingTemplate" placeholder={defaultTemplates.unloading} value={smsUnloadingTemplate} onChange={e => setSmsUnloadingTemplate(e.target.value)} className="text-sm min-h-[80px]" />
                        <p className="text-[10px] text-muted-foreground font-medium italic">Placeholders: {`{customerName}, {bags}, {commodity}, {billNo}, {date}, {hamaliAmount}`}</p>
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="smsPaymentTemplate" className="text-xs font-bold text-slate-700">Bulk Payment Template</Label>
                        <Textarea id="smsPaymentTemplate" placeholder={defaultTemplates.payment} value={smsPaymentTemplate} onChange={e => setSmsPaymentTemplate(e.target.value)} className="text-sm min-h-[80px]" />
                        <p className="text-[10px] text-muted-foreground font-medium italic">Placeholders: {`{customerName}, {paymentAmount}, {date}`}</p>
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="smsPendingDuesTemplate" className="text-xs font-bold text-slate-700">Pending Dues Reminder</Label>
                        <Textarea id="smsPendingDuesTemplate" placeholder={defaultTemplates.pendingDues} value={smsPendingDuesTemplate} onChange={e => setSmsPendingDuesTemplate(e.target.value)} className="text-sm min-h-[80px]" />
                        <p className="text-[10px] text-muted-foreground font-medium italic">Placeholders: {`{customerName}, {rentDue}, {hamaliDue}, {totalDue}`}</p>
                    </div>
                </div>
            </CardContent>
            <CardFooter className="flex-col items-stretch gap-8 bg-slate-50/50 border-t p-6">
                <div className="flex justify-end">
                    <Button type="submit" disabled={isPending} className="font-black uppercase tracking-widest px-8">
                        {isPending ? (
                            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>
                        ) : (
                            'Save All SMS Settings'
                        )}
                    </Button>
                </div>
                
                <Separator />

                <div className="space-y-4">
                    <div className="space-y-1">
                        <h3 className="text-sm font-black uppercase text-slate-700">Test SMS Gateway</h3>
                        <p className="text-[11px] text-muted-foreground font-medium">Verify your configuration by sending a manual test message.</p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3">
                        <Input 
                            placeholder="Enter 10-digit phone number" 
                            value={testNumber} 
                            onChange={(e) => setTestNumber(e.target.value)}
                            className="sm:flex-1 h-11 font-bold"
                        />
                        <Button onClick={handleTestSms} disabled={isTesting || !smsEnabled} className="w-full sm:w-auto h-11 font-black uppercase tracking-wider" type="button" variant="secondary">
                            {isTesting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                            Send Test
                        </Button>
                    </div>
                </div>
            </CardFooter>
        </form>
    </Card>
  );
}