
'use client';

import { useTransition, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, MessageSquare, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
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

const SmsInfoSchema = z.object({
  textbeeApiKey: z.string().min(1, 'textbee.dev API Key is required.'),
  textbeeDeviceId: z.string().optional(),
  smsInflowTemplate: z.string().optional(),
  smsOutflowTemplate: z.string().optional(),
  smsUnloadingTemplate: z.string().optional(),
  smsPaymentTemplate: z.string().optional(),
  smsPendingDuesTemplate: z.string().optional(),
});

type SmsInfoFormData = z.infer<typeof SmsInfoSchema>;

const defaultTemplates = {
    inflow: 'Dear {customerName}, your inflow of {bags} bags of {commodity} has been recorded on {date}. Bill No: {billNo}. Thank you. - {warehouseName}',
    outflow: 'Dear {customerName}, your withdrawal of {bags} bags has been processed on {date}. Total Payable: {totalPayable}. Thank you. - {warehouseName}',
    unloading: 'Dear {customerName}, we have received your delivery of {bags} bags of {commodity} for unloading on {date}. Bill No: {billNo}. Thank you. - {warehouseName}',
    payment: 'Dear {customerName}, thank you for your payment of {paymentAmount} on {date}. Your account has been updated. - {warehouseName}',
    pendingDues: 'Dear {customerName}, this is a reminder that you have a total outstanding balance of {totalDue}. Please make a payment at your earliest convenience. Thank you. - {warehouseName}',
};

export function SmsSettings() {
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();
    const firestore = useFirestore();
    const appUser = useAppUser();

    const [testNumber, setTestNumber] = useState('');
    const [isTesting, startTestTransition] = useTransition();

    const smsInfoRef = useMemoFirebase(
        () => (firestore && appUser ? doc(firestore, 'settings', 'sms') : null),
        [firestore, appUser]
    );
    const { data: smsInfo, loading: loadingInfo } = useDoc<SmsInfo>(smsInfoRef);

    const form = useForm<SmsInfoFormData>({
        resolver: zodResolver(SmsInfoSchema),
        defaultValues: {
            textbeeApiKey: '',
            textbeeDeviceId: '',
            smsInflowTemplate: '',
            smsOutflowTemplate: '',
            smsUnloadingTemplate: '',
            smsPaymentTemplate: '',
            smsPendingDuesTemplate: '',
        }
    });

    useEffect(() => {
        if (smsInfo) {
            form.reset({
                textbeeApiKey: smsInfo.textbeeApiKey || '',
                textbeeDeviceId: smsInfo.textbeeDeviceId || '',
                smsInflowTemplate: smsInfo.smsInflowTemplate || '',
                smsOutflowTemplate: smsInfo.smsOutflowTemplate || '',
                smsUnloadingTemplate: smsInfo.smsUnloadingTemplate || '',
                smsPaymentTemplate: smsInfo.smsPaymentTemplate || '',
                smsPendingDuesTemplate: smsInfo.smsPendingDuesTemplate || '',
            });
        }
    }, [smsInfo, form]);

    const onSubmit = (data: SmsInfoFormData) => {
        if (!firestore) {
            toast({ title: 'Error', description: 'Firestore not available.', variant: 'destructive' });
            return;
        }

        startTransition(async () => {
            try {
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
        const currentSettings = form.getValues();
        if (!currentSettings.textbeeApiKey) {
            toast({ title: 'API Key Required', description: 'Please save your textbee.dev API key before testing.', variant: 'destructive' });
            return;
        }

        startTestTransition(async () => {
            const result = await sendSms({
                apiKey: currentSettings.textbeeApiKey,
                deviceId: currentSettings.textbeeDeviceId,
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
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
                <CardHeader>
                    <CardTitle>SMS Configuration</CardTitle>
                    <CardDescription>
                        Configure your textbee.dev account to enable sending SMS notifications to customers.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <FormField
                        control={form.control}
                        name="textbeeApiKey"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>textbee.dev API Key</FormLabel>
                                <FormControl><Input type="text" placeholder="Enter your API key" {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="textbeeDeviceId"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Device ID (Optional)</FormLabel>
                                <FormControl><Input type="text" placeholder="Enter your Device ID if using the device gateway" {...field} value={field.value ?? ''} /></FormControl>
                                <p className="text-xs text-muted-foreground">
                                    Only required if you are using your phone to send messages via textbee.dev.
                                </p>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    
                    <Separator />
                    <h3 className="text-md font-semibold pt-2">SMS Templates</h3>
                    <FormField
                        control={form.control}
                        name="smsInflowTemplate"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Inflow SMS Template</FormLabel>
                                <FormControl><Textarea placeholder={defaultTemplates.inflow} {...field} /></FormControl>
                                <FormDescription>Placeholders: {`{customerName}, {bags}, {commodity}, {billNo}, {date}, {warehouseName}`}</FormDescription>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="smsOutflowTemplate"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Outflow SMS Template</FormLabel>
                                <FormControl><Textarea placeholder={defaultTemplates.outflow} {...field} /></FormControl>
                                <FormDescription>Placeholders: {`{customerName}, {bags}, {date}, {totalPayable}, {warehouseName}`}</FormDescription>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="smsUnloadingTemplate"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Unloading SMS Template</FormLabel>
                                <FormControl><Textarea placeholder={defaultTemplates.unloading} {...field} /></FormControl>
                                <FormDescription>Placeholders: {`{customerName}, {bags}, {commodity}, {billNo}, {date}, {warehouseName}`}</FormDescription>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="smsPaymentTemplate"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Bulk Payment SMS Template</FormLabel>
                                <FormControl><Textarea placeholder={defaultTemplates.payment} {...field} /></FormControl>
                                <FormDescription>Placeholders: {`{customerName}, {paymentAmount}, {date}, {warehouseName}`}</FormDescription>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                     <FormField
                        control={form.control}
                        name="smsPendingDuesTemplate"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Pending Dues Reminder SMS Template</FormLabel>
                                <FormControl><Textarea placeholder={defaultTemplates.pendingDues} {...field} /></FormControl>
                                <FormDescription>Placeholders: {`{customerName}, {totalDue}, {warehouseName}`}</FormDescription>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

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
        </Form>
    </Card>
  );
}
