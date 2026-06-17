'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { useAuth, useFirestore } from '@/firebase/provider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, AlertCircle } from 'lucide-react';
import { Logo } from '@/components/layout/logo';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { firebaseConfig } from '@/firebase/config';

export default function LoginPage() {
  const auth = useAuth();
  const firestore = useFirestore();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [identifier, setIdentifier] = useState(''); 
  const [password, setPassword] = useState('');

  const handlePasswordSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth || !firestore) {
      setError('Connection failed. Please reload.');
      return;
    }
    setIsLoading(true);
    setError(null);

    // Clean phone number: digits only, last 10
    const cleanPhone = identifier.replace(/\D/g, '').slice(-10);
    if (cleanPhone.length < 10) {
        setError('Please enter a valid 10-digit phone number.');
        setIsLoading(false);
        return;
    }

    const shadowEmail = `+${cleanPhone}@${firebaseConfig.authDomain}`;

    try {
        await signInWithEmailAndPassword(auth, shadowEmail, password);
        // use-user.tsx handles the redirect
    } catch (signInError: any) {
        // Modern Firebase uses 'invalid-credential' for both wrong user and wrong password
        const isNotFound = signInError.code === 'auth/invalid-credential' || signInError.code === 'auth/user-not-found';
        
        if (isNotFound) {
            try {
                // Try creating the account for first-time staff login
                await createUserWithEmailAndPassword(auth, shadowEmail, password);
            } catch (createError: any) {
                if (createError.code === 'auth/email-already-in-use') {
                    setError('Incorrect password. Please try again.');
                } else if (createError.code === 'auth/weak-password') {
                    setError('Password must be at least 6 characters.');
                } else {
                    setError('Authorization failed. Ask your manager to add your number.');
                    console.error("Create error:", createError);
                }
                setIsLoading(false);
            }
        } else if (signInError.code === 'auth/wrong-password') {
             setError('Incorrect password. Please try again.');
             setIsLoading(false);
        } else {
            setError('System error. Please try again later.');
            console.error("Sign in error:", signInError);
            setIsLoading(false);
        }
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm shadow-xl border-primary/10">
        <CardHeader className="text-center">
            <div className="mx-auto mb-4">
              <Logo />
            </div>
          <CardTitle className="text-xl font-bold">Staff Control Console</CardTitle>
          <CardDescription>Sign in with your registered phone number.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
            <form onSubmit={handlePasswordSignIn} className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="identifier" className="text-xs uppercase font-bold text-muted-foreground">Phone Number</Label>
                    <Input
                        id="identifier"
                        type="text"
                        placeholder="e.g. 9876543210"
                        value={identifier}
                        onChange={(e) => setIdentifier(e.target.value)}
                        className="h-11 font-bold"
                        required
                    />
                </div>
                 <div className="space-y-2">
                    <Label htmlFor="password" title="Enter your assigned password" className="text-xs uppercase font-bold text-muted-foreground">Password</Label>
                    <Input
                        id="password"
                        type="password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="h-11"
                        required
                    />
                </div>
                <Button type="submit" disabled={isLoading} className="w-full h-11 font-bold">
                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Secure Sign In'}
                </Button>
            </form>

            {error && (
                <Alert variant="destructive" className="bg-destructive/5 border-destructive/20">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle className="text-xs font-bold uppercase">Login Problem</AlertTitle>
                    <AlertDescription className="text-xs">{error}</AlertDescription>
                </Alert>
            )}
        </CardContent>
        <CardFooter className="flex-col gap-2 pt-0">
             <Button variant="link" size="sm" asChild className="w-full text-[11px] font-bold uppercase tracking-widest text-muted-foreground hover:text-primary">
                <Link href="/owner/login">Warehouse Owner Access</Link>
            </Button>
             <Button variant="link" size="sm" asChild className="w-full text-[11px] font-bold uppercase tracking-widest text-muted-foreground hover:text-primary">
                <Link href="/super-admin/login">Support (Super Admin)</Link>
            </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
