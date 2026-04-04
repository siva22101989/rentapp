'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { useAuth } from '@/firebase/provider';
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
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const superAdminEmail = 'admin@gmail.com';

  const handlePasswordSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) {
      setError('Firebase not available.');
      return;
    }
    setIsLoading(true);
    setError(null);

    signInWithEmailAndPassword(auth, superAdminEmail, password)
      .then(() => {
        router.push('/');
      })
      .catch((signInError: any) => {
        // If sign-in fails, try to create the account. This allows for first-time setup.
        if (signInError.code === 'auth/invalid-credential' || signInError.code === 'auth/user-not-found') {
          createUserWithEmailAndPassword(auth, superAdminEmail, password)
            .then(() => {
              // The useUser hook will now verify and set the super-admin role.
              router.push('/');
            })
            .catch(createError => {
              if (createError.code === 'auth/email-already-in-use') {
                // This means the user exists, so the password was simply wrong.
                setError('Incorrect password. Please try again.');
              } else if (createError.code === 'auth/weak-password') {
                setError('Password is too weak. It must be at least 6 characters long.');
              } else {
                setError('An unexpected error occurred during setup.');
                console.error("Super admin create error:", createError);
              }
              setIsLoading(false);
            });
        } else {
          setError('An unknown sign-in error occurred.');
          console.error("Super admin sign in error:", signInError);
          setIsLoading(false);
        }
      });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4">
            <Logo />
          </div>
          <CardTitle>Super Admin Sign In</CardTitle>
          <CardDescription>Enter the password for the super-admin account.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <form onSubmit={handlePasswordSignIn} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Super Admin Email</Label>
              <Input
                id="email"
                type="email"
                value={superAdminEmail}
                disabled
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" disabled={isLoading} className="w-full">
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Sign In'}
            </Button>
          </form>

          {error && (
            <Alert variant="destructive" className="text-center">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Sign-In Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
        <CardFooter className="flex-col gap-2">
          <Button variant="link" size="sm" asChild className="w-full">
            <Link href="/owner/login">Warehouse Owner Login</Link>
          </Button>
          <Button variant="link" size="sm" asChild className="w-full">
            <Link href="/login">Warehouse Staff Login</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
