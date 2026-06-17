'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { useAuth, useUserContext } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, AlertCircle } from 'lucide-react';
import { Logo } from '@/components/layout/logo';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import Link from 'next/link';

function GoogleIcon() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="24px" height="24px">
            <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24s8.955,20,20,20s20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"/>
            <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"/>
            <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.222,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"/>
            <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571l6.19,5.238C42.022,35.222,44,30.038,44,24C44,22.659,43.862,21.35,43.611,20.083z"/>
        </svg>
    )
}

export default function WarehouseOwnerLoginPage() {
  const auth = useAuth();
  const router = useRouter();
  const { user, appUser, loading } = useUserContext();
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unauthorizedDomain, setUnauthorizedDomain] = useState<string | null>(null);

  // Automatic redirect logic
  useEffect(() => {
    if (!loading && user && appUser) {
        router.push(appUser.role === 'super-admin' ? '/settings' : '/');
    }
  }, [user, appUser, loading, router]);

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setError(null);
    setUnauthorizedDomain(null);
    
    if (!auth) {
        setError('Authentication service is not ready.');
        setIsLoading(false);
        return;
    }

    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      await signInWithPopup(auth, provider);
      // use-user.tsx handles provisioning, the useEffect above handles redirect
    } catch (err: any) {
      setIsLoading(false);
      console.error("Google Sign-In Error:", err);
      
      if (err.code === 'auth/unauthorized-domain') {
          setUnauthorizedDomain(window.location.hostname);
      } else if (err.code === 'auth/popup-blocked') {
          setError('Sign-in pop-up blocked by browser. Please allow pop-ups.');
      } else if (err.code === 'auth/cancelled-popup-request') {
          // No error needed
      } else if (err.code === 'auth/network-request-failed') {
          setError('Network error. Check your connection and try again.');
      } else {
          setError(`Sign-in failed: ${err.message || 'Unknown error'}`);
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
      <Card className="w-full max-w-sm shadow-xl border-primary/10">
        <CardHeader className="text-center">
            <div className="mx-auto mb-4">
              <Logo />
            </div>
          <CardTitle className="text-xl font-bold">Warehouse Owner Sign In</CardTitle>
          <CardDescription>Sign in with your assigned Google account.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
            {unauthorizedDomain && (
                 <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Domain Not Authorized</AlertTitle>
                    <AlertDescription>
                        <p className="mb-2">To sign in, authorize this domain in Firebase Console:</p>
                        <pre className="mb-4 bg-muted p-2 rounded text-xs font-mono break-all">{unauthorizedDomain}</pre>
                    </AlertDescription>
                </Alert>
            )}

            <Button onClick={handleGoogleSignIn} disabled={isLoading} variant="outline" className="w-full h-12 gap-3 border-2 font-bold">
              {isLoading ? ( <Loader2 className="h-5 w-5 animate-spin" /> ) : ( <GoogleIcon /> )}
              Sign in with Google
            </Button>

            {error && (
                <Alert variant="destructive" className="bg-destructive/5 border-destructive/20">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle className="text-xs font-bold uppercase">Auth Error</AlertTitle>
                    <AlertDescription className="text-xs">{error}</AlertDescription>
                </Alert>
            )}
        </CardContent>
         <CardFooter className="flex-col gap-2 pt-0">
            <Button variant="link" size="sm" asChild className="w-full text-xs font-bold text-muted-foreground hover:text-primary uppercase tracking-widest">
                <Link href="/login">Staff Access Portal</Link>
            </Button>
            <Button variant="link" size="sm" asChild className="w-full text-xs font-bold text-muted-foreground hover:text-primary uppercase tracking-widest">
                <Link href="/super-admin/login">System Maintenance</Link>
            </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
