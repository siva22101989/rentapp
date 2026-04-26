
'use client';

import { useUserContext } from "@/firebase/auth/use-user";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Button } from "../ui/button";
import { Mail, Phone, User as UserIcon, Loader2 } from "lucide-react";
import { Badge } from "../ui/badge";
import { Skeleton } from "../ui/skeleton";
import { useTransition, useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useFirestore } from "@/firebase/provider";
import { updateUser } from "@/lib/data";
import type { AppUser } from "@/lib/definitions";

export function ProfileSettings() {
    const { user, appUser, loading } = useUserContext();
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();
    const firestore = useFirestore();

    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');

    useEffect(() => {
        if (appUser) {
            setEmail(appUser.email || '');
            setPhone(appUser.phone || user?.phoneNumber || '');
        }
    }, [appUser, user]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!firestore || !appUser) {
            toast({ title: 'Error', description: 'User or Firestore not available.', variant: 'destructive' });
            return;
        }

        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
             toast({ title: 'Validation Error', description: 'Please enter a valid email address.', variant: 'destructive' });
            return;
        }

        const updates: Partial<AppUser> = {};
        const originalEmail = (appUser.email || '').toLowerCase();
        const newEmail = (email || '').toLowerCase();
        const originalPhone = appUser.phone || user?.phoneNumber || '';
        const newPhone = phone || '';

        if (newEmail !== originalEmail) {
            updates.email = newEmail;
        }
        if (newPhone !== originalPhone) {
            updates.phone = newPhone;
        }

        if (Object.keys(updates).length === 0) {
            toast({ title: 'No Changes', description: 'No information was changed.' });
            return;
        }

        startTransition(async () => {
            try {
                await updateUser(firestore, appUser.id, updates);
                toast({ title: 'Success!', description: 'Your profile has been updated.' });
            } catch (error) {
                console.error(error);
                toast({ title: 'Error', description: 'Failed to update profile.', variant: 'destructive' });
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

    return (
        <Card className="mt-6">
            <form onSubmit={handleSubmit}>
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
                            <Label htmlFor="email">Email Address</Label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input id="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={isPending} className="pl-8" />
                            </div>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="phone">Phone Number</Label>
                        <div className="relative">
                            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={isPending} className="pl-8" placeholder="Not Provided" />
                        </div>
                        <p className="text-xs text-muted-foreground">Used for customer portal linking.</p>
                    </div>
                </CardContent>
                <CardFooter className="justify-end">
                    <Button type="submit" disabled={isPending}>
                       {isPending ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Updating...</>) : ('Update Profile')}
                    </Button>
                </CardFooter>
            </form>
        </Card>
    );
}
