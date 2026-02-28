
'use client';
import {
  createContext,
  useContext,
  type ReactNode,
} from 'react';

import { type FirebaseApp } from 'firebase/app';
import { type Auth }from 'firebase/auth';
import { type Firestore } from 'firebase/firestore';
import { auth as authInstance, firestore as firestoreInstance, firebaseApp as firebaseAppInstance } from '.';

export type FirebaseContextValue = {
  auth: Auth | null;
  firestore: Firestore | null;
  firebaseApp: FirebaseApp | null;
};

const FirebaseContext = createContext<FirebaseContextValue>({
    auth: authInstance,
    firestore: firestoreInstance,
    firebaseApp: firebaseAppInstance,
});

type FirebaseProviderProps = {
  children: ReactNode;
  value: {
    firebaseApp: FirebaseApp;
    auth: Auth;
    firestore: Firestore;
  };
};

export function FirebaseProvider({ children }: { children: ReactNode }) {
  return (
    <FirebaseContext.Provider value={{ auth: authInstance, firestore: firestoreInstance, firebaseApp: firebaseAppInstance }}>
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
