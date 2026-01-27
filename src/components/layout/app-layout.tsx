'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Logo } from './logo';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useUser } from '@/firebase/auth/use-user';
import { useFirebase } from '@/firebase';
import { signOut } from 'firebase/auth';

export function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useUser();
  const { auth } = useFirebase();

  React.useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  const handleLogout = async () => {
    if (auth) {
      try {
        await signOut(auth);
        router.push('/login');
      } catch (error) {
        console.error("Error signing out: ", error);
      }
    }
  };

  if (loading || !user) {
    return (
      <div className="flex min-h-screen w-full flex-col items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="mt-4 text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const isDashboard = pathname === '/';

  return (
    <div className="flex min-h-screen w-full flex-col">
       <header className="sticky top-0 flex h-16 items-center justify-between gap-4 border-b bg-card px-4 md:px-6">
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
            </div>
            <Button variant="outline" onClick={handleLogout}>
              Logout
            </Button>
        </header>
        <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">{children}</main>
    </div>
  );
}
