'use client';

import { useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import { errorEmitter } from '@/firebase/error-emitter';
import { type FirestorePermissionError } from '@/firebase/errors';

// This component listens for Firestore permission errors and displays a detailed
// overlay for developers, specific to Next.js's dev environment.
export function FirebaseErrorListener() {
  const [errorInfo, setErrorInfo] = useState<{ error: FirestorePermissionError, user: User | null } | null>(null);

  useEffect(() => {
    const handleError = (error: FirestorePermissionError, user: User | null) => {
      console.error("Caught Firestore Permission Error:", {
        context: error.context,
        user: user ? { uid: user.uid, email: user.email } : null,
      });
      setErrorInfo({ error, user });
    };

    errorEmitter.on('permission-error', handleError);

    return () => {
      errorEmitter.off('permission-error', handleError);
    };
  }, []);

  if (!errorInfo || process.env.NODE_ENV !== 'development') {
    return null;
  }

  // This is a trick to throw an error that the Next.js dev overlay will catch and display.
  // The error message is a formatted JSON object providing rich context for debugging.
  const FormattedError = () => {
    const { error, user } = errorInfo;
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

    const errorMessage = `FirestoreError: Missing or insufficient permissions: The following request was denied by Firestore Security Rules:\n${JSON.stringify(request, null, 2)}`;
    
    // We throw this in a separate component to ensure it's caught by React's error boundary.
    throw new Error(errorMessage);
  };

  return <FormattedError />;
}
