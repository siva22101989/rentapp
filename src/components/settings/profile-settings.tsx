
'use client';

import { useUserContext } from "@/firebase/auth/use-user";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Button } from "../ui/button";
import { Mail, Phone, User as UserIcon, Loader2 } from "lucide-react";
import { Badge } from "../ui/badge";
import { Skeleton } from "../ui/skeleton";
import { useTransition, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "../ui/form";
import { useToast } from "@/hooks/use-toast";
import { useFirestore } from "@/firebase/provider";
import { updateUser } from "@/lib/data";

const ProfileSchema = z.object({
  email: z.string().email("A valid email address is required."),
});

type ProfileFormData = z.infer<typeof ProfileSchema>;


export function ProfileSettings() {
    const { user, appUser, loading } = useUserContext();
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();
    const firestore = useFirestore();

    const form = useForm<ProfileFormData>({
        resolver: zodResolver(ProfileSchema),
        defaultValues: { email: '' },
    });

    useEffect(() => {
        if (appUser) {
            form.reset({
                email: appUser.email || '',
            });
        }
    }, [appUser, form]);

    const onSubmit = (data: ProfileFormData) => {
        if (!firestore || !appUser) {
            toast({ title: 'Error', description: 'User or Firestore not available.', variant: 'destructive' });
            return;
        }

        const originalEmail = appUser.email.toLowerCase();
        const newEmail = data.email.toLowerCase();
        
        if (appUser.role !== 'super-admin' || originalEmail === newEmail) {
            toast({ title: 'No Changes', description: 'Only the super-admin can change their email, and the new email must be different.' });
            return;
        }

        startTransition(async () => {
            try {
                await updateUser(firestore, appUser.id, { email: newEmail });
                toast({ 
                    title: 'Success!', 
                    description: 'Super-admin email updated. Please sign out and sign back in with the new email.',
                    duration: 8000,
                });
            } catch (error) {
                console.error(error);
                toast({ title: 'Error', description: 'Failed to update email.', variant: 'destructive' });
            }
        });
    };
    
    if (loading) {
        return (
            <Card className="mt-6">
                <CardHeader>
                     <Skeleton className="h-6 w-48" />
                     <Skeleton className="h-4 w-64" />
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid md:grid-cols-2 gap-6">
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                    </div>
                    <Skeleton className="h-10 w-full" />
                </CardContent>
                 <CardFooter className="justify-end">
                    <Skeleton className="h-10 w-32" />
                </CardFooter>
            </Card>
        )
    }

    const isSuperAdmin = appUser?.role === 'super-admin';

    return (
        <Card className="mt-6">
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)}>
                    <CardHeader>
                        <div className="flex justify-between items-start">
                            <div>
                                <CardTitle>Personal Information</CardTitle>
                                <CardDescription>Manage your personal details and account settings.</CardDescription>
                            </div>
                            <Badge variant="outline" className="capitalize">{appUser?.role}</Badge>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="grid md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label htmlFor="fullName">Full Name</Label>
                                <div className="relative">
                                    <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input id="fullName" value={user?.displayName || 'Admin'} disabled className="pl-8 bg-muted/50" />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="phone">Phone Number</Label>
                                <div className="relative">
                                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input id="phone" value={user?.phoneNumber || 'Not Provided'} disabled className="pl-8 bg-muted/50" />
                                </div>
                            </div>
                        </div>
                        <FormField
                            control={form.control}
                            name="email"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Email Address</FormLabel>
                                    <div className="relative">
                                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        <FormControl>
                                            <Input {...field} disabled={!isSuperAdmin || isPending} className="pl-8" />
                                        </FormControl>
                                    </div>
                                    <FormMessage />
                                    <p className="text-xs text-muted-foreground">
                                        {isSuperAdmin 
                                            ? "As super-admin, changing this transfers your role. You must sign out and sign in with the new email."
                                            : "Only the super-admin can change their login email."
                                        }
                                    </p>
                                </FormItem>
                            )}
                        />
                    </CardContent>
                    <CardFooter className="justify-end">
                        <Button type="submit" disabled={isPending || !isSuperAdmin}>
                           {isPending ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Updating...</>) : ('Update Profile')}
                        </Button>
                    </CardFooter>
                </form>
            </Form>
        </Card>
    );
}
