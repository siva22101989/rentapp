
'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { Logo } from './logo';
import { Button } from '@/components/ui/button';
import { ArrowLeft, LogOut, Calendar as CalendarIcon, X } from 'lucide-react';
import { useUser } from '@/firebase/auth/use-user';
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
                <SelectTrigger className="w-[150px] h-8 text-xs">
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
  const { user, loading } = useUser();
  const auth = useAuth();
  
  const isDashboard = pathname === '/';

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

  return (
    <div className="flex min-h-screen w-full flex-col">
       <header className="sticky top-0 flex h-16 items-center gap-4 border-b bg-card px-4 md:px-6">
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
                                <p className="text-sm font-medium leading-none">Signed in as</p>
                                <p className="text-xs leading-none text-muted-foreground">
                                    {user.email}
                                </p>
                            </div>
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={handleSignOut}>
                            <LogOut className="mr-2 h-4 w-4" />
                            <span>Sign Out</span>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </header>
        <main className="flex flex-1 flex-col gap-4 p-4 md:gap-4 md:p-4">{children}</main>
    </div>
  );
}
