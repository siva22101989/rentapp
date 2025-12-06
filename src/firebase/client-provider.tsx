
'use client';
import { initializeFirebase } from '@/firebase';
import { FirebaseProvider } from '@/firebase/provider';

// This provider is used to initialize Firebase on the client side.
// It should be used in a client component that is a child of the root layout.
export const FirebaseClientProvider = ({ children }: { children: React.ReactNode }) => {
  const firebaseApp = initializeFirebase();
  return <FirebaseProvider {...firebaseApp}>{children}</FirebaseProvider>;
};
