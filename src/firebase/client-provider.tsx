
'use client';
import { FirebaseProvider, DateFilterProvider } from './provider';
import type { ReactNode } from 'react';

export function FirebaseClientProvider({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <FirebaseProvider>
      <DateFilterProvider>
        {children}
      </DateFilterProvider>
    </FirebaseProvider>
  );
}
