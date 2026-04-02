
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { GoogleAuthProvider, signInWithPopup, User, RecaptchaVerifier, signInWithPhoneNumber, type ConfirmationResult } from 'firebase/auth';
import { useAuth, useFirestore } from '@/firebase/provider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, AlertCircle } from 'lucide-react';
import { Logo } from '@/components/layout/logo';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

declare global {
  interface Window {
    recaptchaVerifier?: RecaptchaVerifier;
  }
}

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

export default function LoginPage() {
  const auth = useAuth();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unauthorizedDomain, setUnauthorizedDomain] = useState<string | null>(null);

  const [view, setView] = useState<'google' | 'phone'>('google');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setError(null);
    setUnauthorizedDomain(null);
    if (auth) {
      const provider = new GoogleAuthProvider();
      try {
        await signInWithPopup(auth, provider);
        // On successful sign-in, redirect to the dashboard.
        // The UserProvider will handle authorization checks.
        router.push('/');
      } catch (error: any) {
        if (error.code === 'auth/unauthorized-domain') {
            setUnauthorizedDomain(window.location.hostname);
        } else if (error.code === 'auth/popup-blocked') {
            setError('Sign-in pop-up blocked by browser. Please allow pop-ups for this site.');
        } else if (error.code === 'auth/cancelled-popup-request') {
            // User closed the popup, this is not an error.
        } else {
            setError('An unknown error occurred during sign-in.');
            console.error(error);
        }
        setIsLoading(false);
      }
    }
  };

  const handlePhoneSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    if (!auth) {
        setError('Firebase not configured.');
        setIsLoading(false);
        return;
    }
    try {
        window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
            'size': 'invisible',
            'callback': (response: any) => { /* reCAPTCHA solved */ }
        });
        const appVerifier = window.recaptchaVerifier;
        const result = await signInWithPhoneNumber(auth, phoneNumber, appVerifier);
        setConfirmationResult(result);
        setIsLoading(false);
    } catch (error: any) {
        console.error(error);
        if (error.code === 'auth/invalid-phone-number') {
            setError('Invalid phone number. Please include the country code (e.g., +91).');
        } else {
            setError('Failed to send verification code. Please try again.');
        }
        setIsLoading(false);
    }
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    if (!confirmationResult) {
        setError('Verification process not started.');
        setIsLoading(false);
        return;
    }
    try {
        await confirmationResult.confirm(otp);
        router.push('/');
    } catch (error: any) {
        console.error(error);
        setError('Invalid verification code. Please try again.');
        setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
            <div className="mx-auto mb-4">
              <Logo />
            </div>
          <CardTitle>Welcome</CardTitle>
          <CardDescription>Sign in to access your warehouse dashboard</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
            {unauthorizedDomain ? (
                <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Domain Not Authorized</AlertTitle>
                <AlertDescription>
                    <p className="mb-2">
                        To sign in, you must authorize this domain in your Firebase project settings:
                    </p>
                    <pre className="mb-4 bg-muted p-2 rounded text-xs font-mono text-destructive-foreground break-all">
                        {unauthorizedDomain}
                    </pre>
                    <Button asChild size="sm">
                        <Link href="https://console.firebase.google.com/project/_/authentication/settings" target="_blank" rel="noopener noreferrer">
                            Open Firebase Auth Settings
                        </Link>
                    </Button>
                </AlertDescription>
                </Alert>
            ) : view === 'google' && (
              <>
                <Button onClick={handleGoogleSignIn} disabled={isLoading} className="w-full">
                  {isLoading ? ( <Loader2 className="mr-2 h-4 w-4 animate-spin" /> ) : ( <GoogleIcon /> )}
                  Sign in with Google
                </Button>
                <Button variant="link" onClick={() => setView('phone')}>
                    Sign in with phone number instead
                </Button>
              </>
            )}

            {view === 'phone' && !confirmationResult && (
                <form onSubmit={handlePhoneSignIn} className="space-y-4">
                    <div>
                        <Label htmlFor="phone">Phone Number (with country code)</Label>
                        <Input
                            id="phone"
                            type="tel"
                            placeholder="+91 123 456 7890"
                            value={phoneNumber}
                            onChange={(e) => setPhoneNumber(e.target.value)}
                            required
                        />
                    </div>
                    <Button type="submit" disabled={isLoading} className="w-full">
                        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Send Verification Code'}
                    </Button>
                    <Button variant="link" onClick={() => setView('google')}>
                        Sign in with Google instead
                    </Button>
                </form>
            )}

            {view === 'phone' && confirmationResult && (
                <form onSubmit={handleOtpSubmit} className="space-y-4">
                    <div>
                        <Label htmlFor="otp">Verification Code</Label>
                        <Input
                            id="otp"
                            type="text"
                            placeholder="Enter 6-digit code"
                            value={otp}
                            onChange={(e) => setOtp(e.target.value)}
                            required
                        />
                    </div>
                    <Button type="submit" disabled={isLoading} className="w-full">
                        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Verify & Sign In'}
                    </Button>
                    <Button variant="link" onClick={() => setConfirmationResult(null)}>
                        Change phone number
                    </Button>
                </form>
            )}

            {error && (
                <Alert variant="destructive" className="text-center">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Sign-In Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}
             <div id="recaptcha-container"></div>
        </CardContent>
      </Card>
    </div>
  );
}

    