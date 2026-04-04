'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { useAuth, useFirestore } from '@/firebase/provider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, AlertCircle } from 'lucide-react';
import { Logo } from '@/components/layout/logo';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { firebaseConfig } from '@/firebase/config';

export default function LoginPage() {
  const auth = useAuth();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [identifier, setIdentifier] = useState(''); // Can be email or phone
  const [password, setPassword] = useState('');

  const handlePasswordSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth || !firestore) {
      setError('Firebase not available.');
      return;
    }
    setIsLoading(true);
    setError(null);

    const shadowEmail = `+${identifier}@${firebaseConfig.authDomain}`;

    signInWithEmailAndPassword(auth, shadowEmail, password)
        .then(() => {
            router.push('/');
        })
        .catch((signInError: any) => {
            // This error code can mean "user-not-found" or "wrong-password".
            // So, we'll try to create an account. If that fails because the
            // user already exists, then we know it was a wrong password.
            if (signInError.code === 'auth/invalid-credential') {
                createUserWithEmailAndPassword(auth, shadowEmail, password)
                    .then(() => {
                        // The useUser hook will now verify if this new user is authorized.
                        // If not, it will sign them out automatically.
                        router.push('/');
                    })
                    .catch(createError => {
                        if (createError.code === 'auth/email-already-in-use') {
                            // User exists, so the password was wrong.
                            setError('Incorrect password. Please try again or use "Forgot Password".');
                        } else if (createError.code === 'auth/weak-password') {
                            setError('Password is too weak. It must be at least 6 characters long.');
                        } else {
                            setError('This phone number is already associated with an account, but sign-in failed.');
                            console.error("Create error:", createError);
                        }
                        setIsLoading(false);
                    });
            } else {
                setError('An unknown sign-in error occurred. Please try again.');
                console.error("Sign in error:", signInError);
                setIsLoading(false);
            }
        });
  };

  const handleForgotPassword = async () => {
    if (!auth) {
        toast({ title: 'Error', description: 'Firebase not available.', variant: 'destructive'});
        return;
    }
    if (!identifier) {
        toast({ title: 'Phone Number Required', description: 'Please enter your phone number to reset your password.', variant: 'destructive'});
        return;
    }

    const userEmail = `+${identifier}@${firebaseConfig.authDomain}`;

    try {
        await sendPasswordResetEmail(auth, userEmail);
        toast({ title: 'Password Reset Email Sent', description: `If an account exists for this phone number, check the spam folder for an email sent to ${userEmail} with a password reset link.`});
    } catch (error: any) {
        console.error(error);
        if (error.code === 'auth/user-not-found') {
             toast({ title: 'User Not Found', description: 'This phone number is not registered. Please contact the warehouse owner.', variant: 'destructive'});
        } else {
            toast({ title: 'Error', description: 'Failed to send password reset email.', variant: 'destructive'});
        }
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
            <div className="mx-auto mb-4">
              <Logo />
            </div>
          <CardTitle>Warehouse Staff Sign In</CardTitle>
          <CardDescription>to access your warehouse dashboard</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
            <form onSubmit={handlePasswordSignIn} className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="identifier">Phone Number</Label>
                    <Input
                        id="identifier"
                        type="text"
                        placeholder="e.g., 9652369143"
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
        <CardFooter className="flex-col gap-4">
            <Button variant="link" size="sm" className="w-full" onClick={handleForgotPassword}>
                Forgot Password?
            </Button>
             <Button variant="link" size="sm" asChild className="w-full">
                <Link href="/super-admin/login">Super Admin Login</Link>
            </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
