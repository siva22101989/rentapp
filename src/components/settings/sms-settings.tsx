
'use client';

import { useTransition, useEffect, useState } from 'react';
import { Loader2, MessageSquare, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase/provider';
import type { SmsInfo } from '@/lib/definitions';
import { doc, setDoc } from 'firebase/firestore';
import { useDoc } from '@/firebase/firestore/use-doc';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { cleanForFirestore } from '@/lib/utils';
import { Skeleton } from '../ui/skeleton';
import { useAppUser } from '@/firebase/auth/use-user';
import { Separator } from '../ui/separator';
import { sendSms } from '@/lib/sms';
import { Label } from '../ui/label';

const defaultTemplates = {
    inflow: 'Dear {customerName}, your inflow of {bags} bags of {commodity} has been recorded on {date}. Bill No: {billNo}. Hamali: {hamaliAmount}. Thank you. - {warehouseName}',
    outflow: 'Dear {customerName}, your withdrawal of {bags} bags has been processed on {date}. Rent: {rentDue}, Hamali: {hamaliPending}, Total: {totalPayable}. Thank you. - {warehouseName}',
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

    const [textbeeApiKey, setTextbeeApiKey] = useState('');
    const [textbeeDeviceId, setTextbeeDeviceId] = useState('');
    const [smsInflowTemplate, setSmsInflowTemplate] = useState('');
    const [smsOutflowTemplate, setSmsOutflowTemplate] = useState('');
    const [smsUnloadingTemplate, setSmsUnloadingTemplate] = useState('');
    const [smsPaymentTemplate, setSmsPaymentTemplate] = useState('');
    const [smsPendingDuesTemplate, setSmsPendingDuesTemplate] = useState('');

    const smsInfoRef = useMemoFirebase(
        () => (firestore && appUser ? doc(firestore, 'settings', 'sms') : null),
        [firestore, appUser]
    );
    const { data: smsInfo, loading: loadingInfo } = useDoc<SmsInfo>(smsInfoRef);

    useEffect(() => {
        if (smsInfo) {
            setTextbeeApiKey(smsInfo.textbeeApiKey || '');
            setTextbeeDeviceId(smsInfo.textbeeDeviceId || '');
            setSmsInflowTemplate(smsInfo.smsInflowTemplate || '');
            setSmsOutflowTemplate(smsInfo.smsOutflowTemplate || '');
            setSmsUnloadingTemplate(smsInfo.smsUnloadingTemplate || '');
            setSmsPaymentTemplate(smsInfo.smsPaymentTemplate || '');
            setSmsPendingDuesTemplate(smsInfo.smsPendingDuesTemplate || '');
        }
    }, [smsInfo]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!firestore) {
            toast({ title: 'Error', description: 'Firestore not available.', variant: 'destructive' });
            return;
        }
        if (!textbeeApiKey) {
            toast({ title: 'Validation Error', description: 'textbee.dev API Key is required.', variant: 'destructive' });
            return;
        }

        startTransition(async () => {
            try {
                const data = {
                    textbeeApiKey,
                    textbeeDeviceId,
                    smsInflowTemplate,
                    smsOutflowTemplate,
                    smsUnloadingTemplate,
                    smsPaymentTemplate,
                    smsPendingDuesTemplate,
                };
                const docRef = doc(firestore, 'settings', 'sms');
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
    <Card className="mt-6">
        <form onSubmit={handleSubmit}>
            <CardHeader>
                <CardTitle>SMS Configuration</CardTitle>
                <CardDescription>
                    Configure your textbee.dev account to enable sending SMS notifications to customers.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="textbeeApiKey">textbee.dev API Key</Label>
                    <Input id="textbeeApiKey" type="text" placeholder="Enter your API key" value={textbeeApiKey} onChange={e => setTextbeeApiKey(e.target.value)} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="textbeeDeviceId">Device ID (Optional)</Label>
                    <Input id="textbeeDeviceId" type="text" placeholder="Enter your Device ID if using the device gateway" value={textbeeDeviceId} onChange={e => setTextbeeDeviceId(e.target.value)} />
                    <p className="text-xs text-muted-foreground">
                        Only required if you are using your phone to send messages via textbee.dev.
                    </p>
                </div>
                
                <Separator />
                <h3 className="text-md font-semibold pt-2">SMS Templates</h3>

                <div className="space-y-2">
                    <Label htmlFor="smsInflowTemplate">Inflow SMS Template</Label>
                    <Textarea id="smsInflowTemplate" placeholder={defaultTemplates.inflow} value={smsInflowTemplate} onChange={e => setSmsInflowTemplate(e.target.value)} />
                    <p className="text-xs text-muted-foreground">Placeholders: {`{customerName}, {bags}, {commodity}, {billNo}, {date}, {hamaliAmount}, {warehouseName}`}</p>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="smsOutflowTemplate">Outflow SMS Template</Label>
                    <Textarea id="smsOutflowTemplate" placeholder={defaultTemplates.outflow} value={smsOutflowTemplate} onChange={e => setSmsOutflowTemplate(e.target.value)} />
                    <p className="text-xs text-muted-foreground">Placeholders: {`{customerName}, {bags}, {date}, {rentDue}, {hamaliPending}, {totalPayable}, {warehouseName}`}</p>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="smsUnloadingTemplate">Unloading SMS Template</Label>
                    <Textarea id="smsUnloadingTemplate" placeholder={defaultTemplates.unloading} value={smsUnloadingTemplate} onChange={e => setSmsUnloadingTemplate(e.target.value)} />
                    <p className="text-xs text-muted-foreground">Placeholders: {`{customerName}, {bags}, {commodity}, {billNo}, {date}, {hamaliAmount}, {warehouseName}`}</p>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="smsPaymentTemplate">Bulk Payment SMS Template</Label>
                    <Textarea id="smsPaymentTemplate" placeholder={defaultTemplates.payment} value={smsPaymentTemplate} onChange={e => setSmsPaymentTemplate(e.target.value)} />
                    <p className="text-xs text-muted-foreground">Placeholders: {`{customerName}, {paymentAmount}, {date}, {warehouseName}`}</p>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="smsPendingDuesTemplate">Pending Dues Reminder SMS Template</Label>
                    <Textarea id="smsPendingDuesTemplate" placeholder={defaultTemplates.pendingDues} value={smsPendingDuesTemplate} onChange={e => setSmsPendingDuesTemplate(e.target.value)} />
                    <p className="text-xs text-muted-foreground">Placeholders: {`{customerName}, {rentDue}, {hamaliDue}, {totalDue}, {warehouseName}`}</p>
                </div>
            </CardContent>
            <CardFooter className="flex-col items-stretch gap-6">
                <div className="flex justify-end">
                    <Button type="submit" disabled={isPending}>
                        {isPending ? (
                            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>
                        ) : (
                            <><MessageSquare className="mr-2 h-4 w-4" /> Save SMS Settings</>
                        )}
                    </Button>
                </div>
                
                <Separator />

                <div>
                    <h3 className="text-md font-medium">Test SMS Settings</h3>
                    <p className="text-sm text-muted-foreground mb-4">Send a test message to a phone number to verify your saved settings.</p>
                    <div className="flex flex-col sm:flex-row gap-2">
                        <Input 
                            placeholder="Enter 10-digit phone number" 
                            value={testNumber} 
                            onChange={(e) => setTestNumber(e.target.value)}
                            className="sm:flex-1"
                        />
                        <Button onClick={handleTestSms} disabled={isTesting} className="w-full sm:w-auto" type="button">
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
