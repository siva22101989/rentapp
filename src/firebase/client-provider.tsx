
'use client';
import { FirebaseProvider } from './provider';
import type { ReactNode } from 'react';

export function FirebaseClientProvider({
  children,
}: {
  children: ReactNode;
}) {
  return <FirebaseProvider>{children}</FirebaseProvider>;
}
