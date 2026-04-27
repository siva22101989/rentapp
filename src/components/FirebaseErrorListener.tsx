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

      // Instead of showing a raw error, show a helpful diagnostic toast.
      // This problem is likely related to Firebase project configuration, not security rules,
      // especially if rules have been set to `allow read, write: if true;` and still fail.
      
      const diagnosticDescription = (
        <div className="text-sm">
          <p className="mb-2">We're unable to access Firestore data. This is often caused by Firebase project configuration issues.</p>
          <p className="font-semibold mb-1">Please check the following in your Firebase Console:</p>
          <ul className="list-disc pl-5 space-y-1 text-xs">
            <li>
              <strong>API Key & Services:</strong> In the Google Cloud Console, under "APIs & Services" &gt; "Credentials", ensure your API key has no restrictions or that it explicitly allows the <strong>Cloud Firestore API</strong>.
            </li>
            <li>
              <strong>Firestore Database:</strong> Ensure you have created a Firestore database in <strong>Native mode</strong> and that its location is correct.
            </li>
             <li>
              <strong>Authentication Domains:</strong> In Firebase Console &gt; Authentication &gt; Settings &gt; Authorized Domains, ensure your app's domain is listed.
            </li>
             <li>
              <strong>Project ID Match:</strong> Verify the `projectId` in your app's configuration (`vocal-byte-457809-n2`) matches your actual Firebase project.
            </li>
          </ul>
        </div>
      );

      toast({
        variant: "destructive",
        title: "Firestore: Missing or Insufficient Permissions",
        description: diagnosticDescription,
        duration: 30000, // Keep it on screen longer
      });
    };

    errorEmitter.on('permission-error', handleError);

    return () => {
      errorEmitter.off('permission-error', handleError);
    };
  }, [toast]);

  return null;
}
