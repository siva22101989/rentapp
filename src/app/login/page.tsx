'use client';

<<<<<<< HEAD
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
import { useToast } from '@/hooks/use-toast';
import { firebaseConfig } from '@/firebase/config';

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
=======
import { useState } from 'react';
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  updateProfile,
} from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useFirebaseApp } from '@/firebase';
import { Logo } from '@/components/layout/logo';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function LoginPage() {
  const firebaseApp = useFirebaseApp();
  const auth = firebaseApp ? getAuth(firebaseApp) : null;
  const router = useRouter();
  const { toast } = useToast();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) return;
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.push('/');
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Login Failed',
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) return;
    if (password !== confirmPassword) {
        toast({
            variant: 'destructive',
            title: 'Sign Up Failed',
            description: 'Passwords do not match.',
        });
        return;
    }
    setLoading(true);
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCredential.user, { displayName: name });
        toast({
            title: 'Sign Up Successful!',
            description: 'You are now logged in.',
        });
        router.push('/');
    } catch (error: any) {
        toast({
            variant: 'destructive',
            title: 'Sign Up Failed',
            description: error.message,
        });
    } finally {
        setLoading(false);
    }
  }

  const handleGoogleLogin = async () => {
    if (!auth) return;
    setLoading(true);
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      router.push('/');
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Google Sign-In Failed',
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 dark:bg-gray-900">
        <div className="w-full max-w-md p-6">
            <div className='flex justify-center mb-6'>
                <Logo />
            </div>
            <Tabs defaultValue="signin" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="signin">Sign In</TabsTrigger>
                    <TabsTrigger value="signup">Sign Up</TabsTrigger>
                </TabsList>
                <TabsContent value="signin">
                    <Card>
                        <CardHeader className="text-center">
                        <CardTitle className="text-2xl">Welcome Back</CardTitle>
                        <CardDescription>
                            Sign in to access your warehouse dashboard.
                        </CardDescription>
                        </CardHeader>
                        <form onSubmit={handleEmailLogin}>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                            <Label htmlFor="email-signin">Email</Label>
                            <Input
                                id="email-signin"
                                type="email"
                                placeholder="m@example.com"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                disabled={loading}
                            />
                            </div>
                            <div className="space-y-2">
                            <Label htmlFor="password-signin">Password</Label>
                            <Input
                                id="password-signin"
                                type="password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                disabled={loading}
                            />
                            </div>
                        </CardContent>
                        <CardFooter className="flex flex-col gap-4">
                            <Button type="submit" className="w-full" disabled={loading}>
                            {loading ? 'Signing In...' : 'Sign In'}
                            </Button>
                        </CardFooter>
                        </form>
                    </Card>
                </TabsContent>
                <TabsContent value="signup">
                    <Card>
                        <CardHeader className="text-center">
                            <CardTitle className="text-2xl">Create an Account</CardTitle>
                            <CardDescription>
                                Enter your details below to get started.
                            </CardDescription>
                        </CardHeader>
                        <form onSubmit={handleEmailSignUp}>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="name-signup">Name</Label>
                                    <Input
                                        id="name-signup"
                                        type="text"
                                        placeholder="John Doe"
                                        required
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        disabled={loading}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="email-signup">Email</Label>
                                    <Input
                                        id="email-signup"
                                        type="email"
                                        placeholder="m@example.com"
                                        required
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        disabled={loading}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="password-signup">Password</Label>
                                    <Input
                                        id="password-signup"
                                        type="password"
                                        required
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        disabled={loading}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="confirm-password-signup">Confirm Password</Label>
                                    <Input
                                        id="confirm-password-signup"
                                        type="password"
                                        required
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        disabled={loading}
                                    />
                                </div>
                            </CardContent>
                            <CardFooter className="flex flex-col gap-4">
                                <Button type="submit" className="w-full" disabled={loading}>
                                    {loading ? 'Creating Account...' : 'Sign Up'}
                                </Button>
                            </CardFooter>
                        </form>
                    </Card>
                </TabsContent>
            </Tabs>
            <div className="relative my-4">
>>>>>>> 493f64cf071699c798704dd512006dc35618f02c
                <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
<<<<<<< HEAD
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
        <CardFooter>
            <Button variant="link" size="sm" className="w-full" onClick={handleForgotPassword}>
                Forgot Password?
            </Button>
        </CardFooter>
      </Card>
=======
                    <span className="bg-gray-100 px-2 text-muted-foreground dark:bg-gray-900">
                    Or continue with
                    </span>
                </div>
            </div>
            <Button
            variant="outline"
            className="w-full"
            onClick={handleGoogleLogin}
            type="button"
            disabled={loading}
            >
            Sign in with Google
            </Button>
        </div>
>>>>>>> 493f64cf071699c798704dd512006dc35618f02c
    </div>
  );
}
