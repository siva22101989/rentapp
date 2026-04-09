
'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { Logo } from './logo';
import { Button } from '@/components/ui/button';
import { LogOut, Loader2 } from 'lucide-react';
import { useUserContext } from '@/firebase/auth/use-user';
import { useAuth, useDateFilter } from '@/firebase/provider';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { User } from 'firebase/auth';
import type { AppUser } from '@/lib/definitions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '../ui/card';

function LiveClock() {
  const [currentTime, setCurrentTime] = React.useState<Date | null>(null);

  React.useEffect(() => {
    setCurrentTime(new Date());
    const timerId = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timerId);
  }, []);

  if (!currentTime) {
    return <span className="text-sm font-mono text-muted-foreground w-[80px] text-center hidden md:inline-block">...</span>;
  }

  return (
    <span className="text-sm font-mono text-muted-foreground w-[80px] text-center hidden md:inline-block">
      {currentTime.toLocaleTimeString()}
    </span>
  );
}

function DateFilters() {
    const { 
        financialYear,
        handleFinancialYearChange,
        financialYears,
    } = useDateFilter();

    return (
        <div className="flex items-center gap-2">
            <Select value={financialYear} onValueChange={handleFinancialYearChange}>
                <SelectTrigger className="w-[130px] h-8 text-xs">
                    <SelectValue placeholder="Select FY" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all-time">All Time</SelectItem>
                    {financialYears.map(fy => (
                        <SelectItem key={fy} value={fy}>
                            FY {fy}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const { user, appUser, loading, provisioningError } = useUserContext();
    const auth = useAuth();

    const handleSignOut = async () => {
      if (auth) {
        await auth.signOut();
        router.push('/login');
      }
    };
  
    React.useEffect(() => {
        if (!loading && !user && !pathname.includes('/login')) {
            router.push('/login');
        }
    }, [user, loading, router, pathname]);

    if (user && provisioningError) {
        return (
            <div className="flex h-screen w-full flex-col">
                 <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-card px-4 md:px-6 print-hide">
                    <Link href="/" className="flex items-center gap-3">
                        <Logo />
                    </Link>
                </header>
                <main className="flex flex-1 items-center justify-center p-4">
                    <Card className="w-full max-w-md text-center">
                        <CardHeader>
                            <CardTitle className="text-destructive">Authorization Error</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p>{provisioningError}</p>
                            <p className="mt-4 text-sm text-muted-foreground">
                                You have successfully signed in, but your account (<span className="font-medium">{user.email}</span>) is not configured for access to this application.
                            </p>
                        </CardContent>
                        <CardFooter className="flex-col gap-4">
                            <Button onClick={handleSignOut}>Sign Out</Button>
                            <p className="text-xs text-muted-foreground">If you believe this is an error, please contact the super-admin.</p>
                        </CardFooter>
                    </Card>
                </main>
            </div>
        );
    }

    if (loading || !user) {
        if (pathname.includes('/login')) {
            return <>{children}</>;
        }
        return (
        <div className="flex h-screen w-full items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
        );
    }
  
    if (user && appUser && pathname.includes('/login')) {
        if (appUser.role === 'super-admin') {
            router.push('/settings');
        } else {
            router.push('/');
        }
        return (
            <div className="flex h-screen w-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    const getInitials = (user: User | null, appUser: AppUser | null) => {
        if (!user) return '?';
        if (user.displayName) return user.displayName.charAt(0).toUpperCase();
        if (user.email) return user.email.charAt(0).toUpperCase();
        if (appUser?.phone) return 'U';
        return '?';
    };

    const getUserName = (user: User | null, appUser: AppUser | null) => {
        if (!user) return 'User';
        if (user.displayName) return user.displayName;
        if (user.email) {
            const namePart = user.email.split('@')[0];
            if (namePart.startsWith('+')) return 'Team Member';
            return namePart.charAt(0).toUpperCase() + namePart.slice(1);
        }
        if (appUser?.phone) return `User (${appUser.phone})`;
        return 'User';
    };

    const header = (
        <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-card px-4 md:px-6 print-hide">
            <Link href={appUser?.role === 'super-admin' ? '/settings' : '/'} className="flex items-center gap-3" aria-label="Back to homepage">
                <Logo />
            </Link>
            <div className='flex items-center gap-4 ml-auto'>
                {appUser?.role !== 'super-admin' && <DateFilters />}
                <LiveClock />
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                            <Avatar className="h-8 w-8">
                                <AvatarFallback>{getInitials(user, appUser)}</AvatarFallback>
                            </Avatar>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-56" align="end" forceMount>
                        <DropdownMenuLabel className="font-normal">
                            <div className="flex flex-col space-y-1">
                                <p className="text-sm font-medium leading-none">{getUserName(user, appUser)}</p>
                                <p className="text-xs leading-none text-muted-foreground">
                                    {user.email && !user.email.startsWith('+') ? user.email : (appUser?.phone || '')}
                                </p>
                            </div>
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem asChild>
                            <Link href="/settings">
                                Settings
                            </Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={handleSignOut}>
                            <LogOut className="mr-2 h-4 w-4" />
                            <span>Sign Out</span>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </header>
    );

    return (
        <div className="flex min-h-screen w-full flex-col">
            {header}
            <main className="flex flex-1 flex-col gap-4 p-4 md:p-6">{children}</main>
        </div>
    );
}
