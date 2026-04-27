
'use client';

import { useEffect } from 'react';
import type { User } from 'firebase/auth';
import { errorEmitter } from '@/firebase/error-emitter';
import { type FirestorePermissionError } from '@/firebase/errors';
import { useToast } from '@/hooks/use-toast';

export function FirebaseErrorListener() {
  const { toast } = useToast();

  useEffect(() => {
    const handleError = (error: FirestorePermissionError, user: User | null) => {
      console.error("Caught Firestore Permission Error:", {
        context: error.context,
        user: user ? { uid: user.uid, email: user.email } : null,
      });

      const request = {
        auth: user ? {
          uid: user.uid,
          token: {
            name: user.displayName,
            picture: user.photoURL,
            email: user.email,
            email_verified: user.emailVerified,
            phone_number: user.phoneNumber,
            firebase: {
              identities: user.providerData.reduce((acc, p) => ({ ...acc, [p.providerId]: [p.uid] }), {}),
              sign_in_provider: user.providerData[0]?.providerId || 'custom'
            }
          }
        } : null,
        method: error.context.operation,
        path: `/databases/(default)/documents${error.context.path.startsWith('/') ? '' : '/'}${error.context.path}`,
        ...(error.context.requestResourceData && { resource: { data: error.context.requestResourceData } }),
      };
      
      const errorMessage = `The following request was denied by Firestore Security Rules:\n${JSON.stringify(request, null, 2)}`;

      toast({
        variant: "destructive",
        title: "Firestore: Missing or insufficient permissions.",
        description: (
          <pre className="mt-2 w-full rounded-md bg-slate-950 p-4">
            <code className="text-white">{errorMessage}</code>
          </pre>
        ),
        duration: 20000, 
      });
    };

    errorEmitter.on('permission-error', handleError);

    return () => {
      errorEmitter.off('permission-error', handleError);
    };
  }, [toast]);

  return null;
}
