
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
import { useAppUser } from '@/firebase/auth/use-user';

const SmsInfoSchema = z.object({
  textbeeApiKey: z.string().min(1, 'textbee.dev API Key is required.'),
  textbeeDeviceId: z.string().optional(),
});

type SmsInfoFormData = z.infer<typeof SmsInfoSchema>;

export function SmsSettings() {
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();
    const firestore = useFirestore();
    const appUser = useAppUser();

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
        }
    });

    useEffect(() => {
        if (smsInfo) {
            form.reset({
                textbeeApiKey: smsInfo.textbeeApiKey || '',
                textbeeDeviceId: smsInfo.textbeeDeviceId || '',
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
                Configure your textbee.dev account to enable sending SMS notifications to customers.
            </CardDescription>
        </CardHeader>
        <CardContent>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField
                        control={form.control}
                        name="textbeeApiKey"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>textbee.dev API Key</FormLabel>
                                <FormControl><Input type="password" placeholder="Enter your API key" {...field} /></FormControl>
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
                                <FormControl><Input placeholder="Enter your Device ID if using the device gateway" {...field} value={field.value ?? ''} /></FormControl>
                                <p className="text-xs text-muted-foreground">
                                    Only required if you are using your phone to send messages via textbee.dev.
                                </p>
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
