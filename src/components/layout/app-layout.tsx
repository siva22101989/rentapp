
'use client';

import * as React from 'react';
import Link from 'next/link';
<<<<<<< HEAD
import { useRouter, usePathname } from 'next/navigation';
import { Logo } from './logo';
import { Button } from '@/components/ui/button';
import { ArrowLeft, LogOut, Calendar as CalendarIcon, X } from 'lucide-react';
import { useUserContext } from '@/firebase/auth/use-user';
import { useAuth, useDateFilter } from '@/firebase/provider';
import { Loader2 } from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
  } from "@/components/ui/dropdown-menu";
import {
    Avatar,
    AvatarFallback,
} from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import type { User } from 'firebase/auth';


function LiveClock() {
  const [currentTime, setCurrentTime] = React.useState<Date | null>(null);

  React.useEffect(() => {
    // Set initial time on client-side to avoid hydration mismatch
    setCurrentTime(new Date());

    const timerId = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    // Cleanup interval on component unmount
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
=======
import { usePathname, useRouter } from 'next/navigation';
import { Logo } from './logo';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ArrowLeft, LogOut } from 'lucide-react';
import { useUser } from '@/firebase/auth/use-user';
import { getAuth, signOut } from 'firebase/auth';
>>>>>>> 493f64cf071699c798704dd512006dc35618f02c

export function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useUserContext();
  const auth = useAuth();
  
  const isDashboard = pathname === '/';
  const { user, loading } = useUser();
  const auth = getAuth();
  const router = useRouter();

<<<<<<< HEAD
  React.useEffect(() => {
    if (!loading && !user && pathname !== '/login') {
      router.push('/login');
    }
  }, [user, loading, router, pathname]);

  const handleSignOut = async () => {
    if (auth) {
        await auth.signOut();
        router.push('/login');
    }
  }

  if (loading || !user) {
     // Don't render the loader on the login page itself
    if (pathname === '/login') {
      return <>{children}</>;
    }
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  // If user is logged in but on login page, redirect to dashboard
  if (user && pathname === '/login') {
    router.push('/');
    return (
       <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const getInitials = (email: string | null | undefined) => {
    if (!email) return '?';
    return email.charAt(0).toUpperCase();
  };

  const getUserName = (user: User | null) => {
    if (!user) return 'User';
    if (user.displayName) return user.displayName;
    if (user.email) {
      const namePart = user.email.split('@')[0];
      return namePart.charAt(0).toUpperCase() + namePart.slice(1);
    }
    return 'User';
  };

=======
  const handleSignOut = async () => {
    await signOut(auth);
    router.push('/login');
  };

  if (loading) {
    return (
        <div className="flex min-h-screen w-full items-center justify-center">
            <div>Loading...</div>
        </div>
    )
  }

  // If not loading and no user, redirect to login
  if (!user) {
    // router.push('/login') will cause an infinite loop
    // because the layout is re-rendering. We need to do this
    // in a useEffect in the useUser hook.
    return null;
  }
  
>>>>>>> 493f64cf071699c798704dd512006dc35618f02c
  return (
    <div className="flex min-h-screen w-full flex-col">
       <header className="sticky top-0 flex h-16 items-center gap-4 border-b bg-card px-4 md:px-6 print-hide">
            <div className="flex items-center gap-4">
              {!isDashboard && (
                  <Button variant="outline" size="icon" className="h-8 w-8" asChild>
                    <Link href="/">
                      <ArrowLeft className="h-4 w-4" />
                      <span className="sr-only">Back to Dashboard</span>
                    </Link>
                  </Button>
              )}
              <Logo />
              <DateFilters />
            </div>
            <div className='flex items-center gap-4 ml-auto'>
                <LiveClock />
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                            <Avatar className="h-8 w-8">
                                <AvatarFallback>{getInitials(user?.email)}</AvatarFallback>
                            </Avatar>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-56" align="end" forceMount>
                        <DropdownMenuLabel className="font-normal">
                            <div className="flex flex-col space-y-1">
                                <p className="text-sm font-medium leading-none">{getUserName(user)}</p>
                                <p className="text-xs leading-none text-muted-foreground">
                                    {user.email}
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
<<<<<<< HEAD
=======
            <div className="flex items-center gap-4">
                <Avatar className="h-8 w-8">
                    <AvatarFallback>{user.displayName?.[0] || user.email?.[0] || 'U'}</AvatarFallback>
                </Avatar>
                <Button variant="ghost" size="icon" onClick={handleSignOut} aria-label="Sign out">
                    <LogOut className="h-4 w-4" />
                </Button>
            </div>
>>>>>>> 493f64cf071699c798704dd512006dc35618f02c
        </header>
        <main className="flex flex-1 flex-col gap-4 p-4 md:p-6">{children}</main>
    </div>
  );
}
