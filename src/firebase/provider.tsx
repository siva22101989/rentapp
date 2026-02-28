
'use client';
import {
  createContext,
  useContext,
  type ReactNode,
  useState,
  useEffect,
} from 'react';

import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth }from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { firebaseConfig } from './config';

// This context provides the Firebase app, Auth, and Firestore instances.
// It ensures that Firebase is initialized only once.

export type FirebaseContextValue = {
  auth: Auth;
  firestore: Firestore;
  firebaseApp: FirebaseApp;
};

const FirebaseContext = createContext<FirebaseContextValue | null>(null);

export function FirebaseProvider({ children }: { children: ReactNode }) {
    const [value, setValue] = useState<FirebaseContextValue | null>(null);

    useEffect(() => {
        const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
        const auth = getAuth(app);
        const firestore = getFirestore(app);

        setValue({
            firebaseApp: app,
            auth,
            firestore,
        });
    }, []);

    if (!value) {
        // You can return a loader here if you want
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
