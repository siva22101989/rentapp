
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { useAuth, useFirestore } from '@/firebase/provider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, AlertCircle } from 'lucide-react';
import { Logo } from '@/components/layout/logo';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { firebaseConfig } from '@/firebase/config';
import type { AppUser } from '@/lib/definitions';

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
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unauthorizedDomain, setUnauthorizedDomain] = useState<string | null>(null);

  const [identifier, setIdentifier] = useState(''); // Can be email or phone
  const [password, setPassword] = useState('');

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setError(null);
    setUnauthorizedDomain(null);
    if (auth) {
      const provider = new GoogleAuthProvider();
      try {
        await signInWithPopup(auth, provider);
        router.push('/');
      } catch (error: any) {
        if (error.code === 'auth/unauthorized-domain') {
            setUnauthorizedDomain(window.location.hostname);
        } else if (error.code === 'auth/popup-blocked') {
            setError('Sign-in pop-up blocked by browser. Please allow pop-ups for this site.');
        } else if (error.code === 'auth/cancelled-popup-request') {
            // User closed the popup, this is not an error.
        } else {
            setError('An unknown error occurred during Google sign-in.');
            console.error(error);
        }
        setIsLoading(false);
      }
    }
  };

  const handlePasswordSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth || !firestore) {
      setError('Firebase not available.');
      return;
    }
    setIsLoading(true);
    setError(null);

    const shadowEmail = `${identifier}@${firebaseConfig.authDomain}`;

    try {
        // First, try to sign in. This will work for existing users.
        await signInWithEmailAndPassword(auth, shadowEmail, password);
        router.push('/');
    } catch (signInError: any) {
        if (signInError.code === 'auth/user-not-found' || signInError.code === 'auth/invalid-credential') {
            // This is the special case: the user might be a new team member.
            // We can't query the `users` collection for security reasons before auth.
            // So, we'll try to create the user. If they aren't in the `users` collection,
            // the `UserProvider` will sign them out immediately after login.
            try {
                // Check if the user is in Firestore first to prevent random signups
                const usersRef = collection(firestore, 'users');
                const q = query(usersRef, where('phone', '==', identifier));
                const userQuerySnapshot = await getDocs(q);

                if (userQuerySnapshot.empty) {
                    // This is the error you were seeing. The user is not in the database.
                    setError('User not found. Please contact the warehouse owner to get access.');
                    setIsLoading(false);
                    return;
                }
                
                // If the user is in the DB but doesn't have an auth account, create it.
                await createUserWithEmailAndPassword(auth, shadowEmail, password);
                router.push('/');

            } catch (createError: any) {
                // This catch block handles Firestore query errors AND createUser errors
                 if(createError.code?.includes('permission-denied')) {
                    setError('Could not verify user. Please try again.');
                } else if (createError.code === 'auth/weak-password') {
                    setError('Password is too weak. It must be at least 6 characters.');
                } else {
                    setError('An unknown error occurred during account creation.');
                }
                console.error("Creation/Verification error:", createError);
            }
        } else if (signInError.code === 'auth/wrong-password') {
            setError('Incorrect password. Please try again.');
        } else {
            setError('An unknown sign-in error occurred.');
            console.error(signInError);
        }
    } finally {
        setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!auth) {
        toast({ title: 'Error', description: 'Firebase not available.', variant: 'destructive'});
        return;
    }
    if (!identifier) {
        toast({ title: 'Phone Number or Email Required', description: 'Please enter your identifier to reset your password.', variant: 'destructive'});
        return;
    }

    let userEmail: string | undefined = undefined;

    if (identifier.includes('@')) {
        userEmail = identifier;
    } else {
        // Assume it's a phone number, construct shadow email
        userEmail = `${identifier}@${firebaseConfig.authDomain}`;
    }

    try {
        await sendPasswordResetEmail(auth, userEmail);
        toast({ title: 'Password Reset Email Sent', description: 'Check your inbox for a link to reset your password.'});
    } catch (error: any) {
        console.error(error);
        toast({ title: 'Error', description: 'Failed to send password reset email. Ensure the phone or email is registered.', variant: 'destructive'});
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
            <div className="mx-auto mb-4">
              <Logo />
            </div>
          <CardTitle>Sign In</CardTitle>
          <CardDescription>to access your warehouse dashboard</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
            {unauthorizedDomain && (
                 <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Domain Not Authorized</AlertTitle>
                    <AlertDescription>
                        <p className="mb-2">To sign in, authorize this domain in Firebase:</p>
                        <pre className="mb-4 bg-muted p-2 rounded text-xs font-mono text-destructive-foreground break-all">{unauthorizedDomain}</pre>
                        <Button asChild size="sm">
                            <Link href="https://console.firebase.google.com/project/_/authentication/settings" target="_blank" rel="noopener noreferrer">
                                Open Firebase Auth Settings
                            </Link>
                        </Button>
                    </AlertDescription>
                </Alert>
            )}

            <div>
                <h3 className="text-sm font-semibold mb-2 text-center">Owner Sign-in</h3>
                <Button onClick={handleGoogleSignIn} disabled={isLoading} className="w-full">
                  {isLoading ? ( <Loader2 className="mr-2 h-4 w-4 animate-spin" /> ) : ( <GoogleIcon /> )}
                  Sign in with Google
                </Button>
            </div>

            <div className="relative">
                <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">Or</span>
                </div>
            </div>

            <form onSubmit={handlePasswordSignIn} className="space-y-4">
                <h3 className="text-sm font-semibold text-center">Team Member Sign-in</h3>
                <div className="space-y-2">
                    <Label htmlFor="identifier">Phone Number</Label>
                    <Input
                        id="identifier"
                        type="text"
                        placeholder="e.g., +91..."
                        value={identifier}
                        onChange={(e) => setIdentifier(e.target.value)}
                        required
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
        <CardFooter>
            <Button variant="link" size="sm" className="w-full" onClick={handleForgotPassword}>
                Forgot Password?
            </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
