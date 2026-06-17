'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { useAuth, useUserContext } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, AlertCircle } from 'lucide-react';
import { Logo } from '@/components/layout/logo';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function SuperAdminLoginPage() {
  const auth = useAuth();
  const router = useRouter();
  const { user, appUser, loading } = useUserContext();
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const superAdminEmail = 'admin@gmail.com';

  // Automatic redirect
  useEffect(() => {
    if (!loading && user && appUser) {
        router.push(appUser.role === 'super-admin' ? '/settings' : '/');
    }
  }, [user, appUser, loading, router]);

  const handlePasswordSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) {
      setError('Auth service not ready.');
      return;
    }
    setIsLoading(true);
    setError(null);

    try {
        await signInWithEmailAndPassword(auth, superAdminEmail, password);
    } catch (signInError: any) {
        const isNotFound = signInError.code === 'auth/invalid-credential' || signInError.code === 'auth/user-not-found';
        
        if (isNotFound) {
          try {
            await createUserWithEmailAndPassword(auth, superAdminEmail, password);
          } catch (createError: any) {
            setError('Unexpected setup error.');
            setIsLoading(false);
          }
        } else {
          setError('Invalid credentials.');
          setIsLoading(false);
        }
    }
  };

  if (loading) {
    return (
        <div className="flex min-h-screen items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm shadow-2xl border-orange-500/20">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4">
            <Logo />
          </div>
          <CardTitle className="text-xl font-bold">System Administration</CardTitle>
          <CardDescription>Global maintenance access restricted.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <form onSubmit={handlePasswordSignIn} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-xs font-bold uppercase text-muted-foreground">Admin ID</Label>
              <Input
                id="email"
                type="email"
                value={superAdminEmail}
                className="bg-muted font-bold"
                disabled
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" title="Enter master password" className="text-xs font-bold uppercase text-muted-foreground">Master Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" disabled={isLoading} variant="destructive" className="w-full h-11 font-bold">
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Enter System'}
            </Button>
          </form>

          {error && (
            <Alert variant="destructive" className="bg-destructive/5 border-destructive/20">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle className="text-xs font-bold uppercase">Auth Error</AlertTitle>
              <AlertDescription className="text-xs">{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
        <CardFooter className="flex-col gap-2 pt-0">
          <Button variant="link" size="sm" asChild className="w-full text-xs font-bold uppercase tracking-widest text-muted-foreground">
            <Link href="/owner/login">Warehouse Owner Access</Link>
          </Button>
          <Button variant="link" size="sm" asChild className="w-full text-xs font-bold uppercase tracking-widest text-muted-foreground">
            <Link href="/login">Staff Access</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
