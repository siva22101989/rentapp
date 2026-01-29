
'use client';
import { firebaseApp, auth, firestore } from '.';
import { FirebaseProvider } from './provider';

export function FirebaseClientProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return <FirebaseProvider value={{ firebaseApp, auth, firestore }}>{children}</FirebaseProvider>;
}
