'use client';
import {
  createContext,
  useContext,
  type ReactNode,
} from 'react';

import { type FirebaseApp } from 'firebase/app';
import { type Auth }from 'firebase/auth';
import { type Firestore } from 'firebase/firestore';
import { auth, firestore, firebaseApp } from '.';

export type FirebaseContextValue = {
  auth: Auth;
  firestore: Firestore;
  firebaseApp: FirebaseApp;
};

const FirebaseContext = createContext<FirebaseContextValue>({
    auth,
    firestore,
    firebaseApp,
});

export function FirebaseProvider({ children }: { children: ReactNode }) {
  return (
    <FirebaseContext.Provider value={{ auth, firestore, firebaseApp }}>
      {children}
    </FirebaseContext.Provider>
  );
}

export function useFirebase() {
  return useContext(FirebaseContext);
}

export function useAuth() {
  const context = useFirebase();
  return context.auth;
}

export function useFirestore() {
  const context = useFirebase();
  return context.firestore;
}

export function useFirebaseApp() {
  const context = useFirebase();
  return context.firebaseApp;
}
