'use client';
import {
  createContext,
  useContext,
  type ReactNode,
  useState,
  useEffect,
} from 'react';

import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
// Import a common function like `collection` to hint the bundler against tree-shaking.
import { getFirestore, collection, type Firestore } from 'firebase/firestore';
import { firebaseConfig } from './config';

export type FirebaseContextValue = {
  auth: Auth;
  firestore: Firestore;
  firebaseApp: FirebaseApp;
};

const FirebaseContext = createContext<FirebaseContextValue | null>(null);

export function FirebaseProvider({ children }: { children: ReactNode }) {
  const [value, setValue] = useState<FirebaseContextValue | null>(null);

  useEffect(() => {
    const app =
      getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const firestore = getFirestore(app);

    setValue({ firebaseApp: app, auth, firestore });
  }, []); // Empty dependency array ensures this runs only once on the client.

  if (!value) {
    // Return null or a loading component while Firebase is initializing.
    return null;
  }

  return (
    <FirebaseContext.Provider value={value}>
      {children}
    </FirebaseContext.Provider>
  );
}

export function useFirebase() {
  const context = useContext(FirebaseContext);
  if (!context) {
    throw new Error('useFirebase must be used within a FirebaseProvider');
  }
  return context;
}

export function useAuth() {
  return useFirebase().auth;
}

export function useFirestore() {
  return useFirebase().firestore;
}

export function useFirebaseApp() {
  return useFirebase().firebaseApp;
}
