
'use client';

import { useTransition, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase/provider';
import type { SmsInfo } from '@/lib/definitions';
import { doc, setDoc } from 'firebase/firestore';
import { useDoc } from '@/firebase/firestore/use-doc';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { cleanForFirestore } from '@/lib/utils';
import { Skeleton } from '../ui/skeleton';

const SmsInfoSchema = z.object({
  twilioAccountSid: z.string().min(1, 'Twilio Account SID is required.'),
  twilioAuthToken: z.string().min(1, 'Twilio Auth Token is required.'),
  twilioPhoneNumber: z.string().min(1, 'Twilio Phone Number is required.'),
});

type SmsInfoFormData = z.infer<typeof SmsInfoSchema>;

export function SmsSettings() {
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();
    const firestore = useFirestore();

    const smsInfoRef = useMemoFirebase(
        () => (firestore ? doc(firestore, 'settings', 'sms') : null),
        [firestore]
    );
    const { data: smsInfo, loading: loadingInfo } = useDoc<SmsInfo>(smsInfoRef);

    const form = useForm<SmsInfoFormData>({
        resolver: zodResolver(SmsInfoSchema),
        defaultValues: {
            twilioAccountSid: '',
            twilioAuthToken: '',
            twilioPhoneNumber: '',
        }
    });

    useEffect(() => {
        if (smsInfo) {
            form.reset({
                twilioAccountSid: smsInfo.twilioAccountSid || '',
                twilioAuthToken: smsInfo.twilioAuthToken || '',
                twilioPhoneNumber: smsInfo.twilioPhoneNumber || '',
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
        <CardHeader>
            <CardTitle>SMS Configuration</CardTitle>
            <CardDescription>
                Configure your Twilio account to enable sending SMS notifications to customers.
            </CardDescription>
        </CardHeader>
        <CardContent>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField
                        control={form.control}
                        name="twilioAccountSid"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Twilio Account SID</FormLabel>
                                <FormControl><Input placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="twilioAuthToken"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Twilio Auth Token</FormLabel>
                                <FormControl><Input type="password" placeholder="••••••••••••••••••••" {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="twilioPhoneNumber"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Twilio Phone Number</FormLabel>
                                <FormControl><Input placeholder="+1234567890" {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <div className="flex justify-end pt-4">
                        <Button type="submit" disabled={isPending}>
                            {isPending ? (
                                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>
                            ) : (
                                <><MessageSquare className="mr-2 h-4 w-4" /> Save SMS Settings</>
                            )}
                        </Button>
                    </div>
                </form>
            </Form>
        </CardContent>
    </Card>
  );
}
