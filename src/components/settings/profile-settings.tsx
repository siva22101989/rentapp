
'use client';

import { useUserContext } from "@/firebase/auth/use-user";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Button } from "../ui/button";
import { Mail, Phone, User as UserIcon } from "lucide-react";
import { Badge } from "../ui/badge";
import { Skeleton } from "../ui/skeleton";

export function ProfileSettings() {
    const { user, appUser, loading } = useUserContext();

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
                            <Input id="fullName" defaultValue={user?.displayName || 'Admin'} className="pl-8" />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="email">Email Address</Label>
                         <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input id="email" value={user?.email || ''} disabled className="pl-8 bg-muted/50" />
                        </div>
                        <p className="text-xs text-muted-foreground">Email cannot be changed.</p>
                    </div>
                </div>
                 <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input id="phone" defaultValue="9999999999" className="pl-8" />
                    </div>
                    <p className="text-xs text-muted-foreground">Used for customer portal linking.</p>
                </div>
            </CardContent>
            <CardFooter className="justify-end">
                <Button>Update Profile</Button>
            </CardFooter>
        </Card>
    );
}
