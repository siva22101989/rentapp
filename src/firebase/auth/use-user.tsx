
'use client';

import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { type User } from 'firebase/auth';
import { useAuth, useFirestore } from '@/firebase/provider';
import type { AppUser } from '@/lib/definitions';
import { collection, query, where, getDocs, doc, getDoc, writeBatch, or, setDoc, deleteDoc } from 'firebase/firestore';
import { firebaseConfig } from '../config';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

interface UserContextType {
  user: User | null;
  appUser: AppUser | null;
  loading: boolean;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const firestore = useFirestore();
  const [user, setUser] = useState<User | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth || !firestore) {
      setLoading(true);
      return;
    }

    const unsubscribe = auth.onAuthStateChanged(async (fbUser) => {
      if (!fbUser) {
        setUser(null);
        setAppUser(null);
        setLoading(false);
        return;
      }
      
      setLoading(true);

      try {
        const userDocRef = doc(firestore, 'users', fbUser.uid);
        const userDocSnap = await getDoc(userDocRef);

        if (userDocSnap.exists()) {
            // Scenario 1: Returning user with an existing user document.
            const existingAppUser = { id: userDocSnap.id, ...userDocSnap.data() } as AppUser;
            if (existingAppUser.role === 'super-admin' || existingAppUser.warehouseId) {
                setAppUser(existingAppUser);
                setUser(fbUser);
            } else {
                throw new Error(`User document ${fbUser.uid} is missing role or warehouseId.`);
            }
        } else {
            // Scenario 2: First-time login. We need to provision a user document.
            const userEmail = fbUser.email?.toLowerCase();
            let newAppUserData: Omit<AppUser, 'id'> | null = null;
            let isNewUser = false;

            if (userEmail === 'admin@gmail.com') {
                // Provision super-admin
                newAppUserData = { role: 'super-admin', email: userEmail, phone: '' };
                isNewUser = true;
            } else if (userEmail && !userEmail.startsWith('+')) {
                // Provision a potential new owner (who signs in with a regular email)
                const warehousesCol = collection(firestore, 'managedWarehouses');
                const q = query(warehousesCol, where('ownerEmail', '==', userEmail));
                const warehouseSnap = await getDocs(q);

                if (!warehouseSnap.empty) {
                    const warehouseDoc = warehouseSnap.docs[0];
                    newAppUserData = {
                        email: userEmail,
                        role: 'owner',
                        warehouseId: warehouseDoc.id,
                        phone: fbUser.phoneNumber || ''
                    };
                    isNewUser = true;
                }
            } else if (userEmail && userEmail.startsWith('+')) {
                // Provision a potential new staff member (who signs in with a phone-based shadow account)
                const phone = userEmail.substring(1, userEmail.indexOf('@'));
                const usersCol = collection(firestore, 'users');
                const q = query(usersCol, where('phone', '==', phone));
                const staffSnap = await getDocs(q);

                if (!staffSnap.empty) {
                    const staffDocToDelete = staffSnap.docs[0];
                    newAppUserData = staffDocToDelete.data() as Omit<AppUser, 'id'>;
                    // The old doc was created with an auto-ID. Delete it now that we have a UID.
                    await deleteDoc(staffDocToDelete.ref);
                    isNewUser = true;
                }
            }

            if (newAppUserData) {
                // Create the new user document with the Firebase Auth UID as the key.
                await setDoc(userDocRef, newAppUserData);
                setAppUser({ id: fbUser.uid, ...newAppUserData } as AppUser);
                setUser(fbUser);
            } else {
                // If no provisioning rule matched, this user is not authorized.
                throw new Error(`Unauthorized user: No provisioning rule matched for UID ${fbUser.uid}.`);
            }
        }
      } catch (e: any) {
          console.error("Auth state change error:", e);
          await auth.signOut();
          setUser(null);
          setAppUser(null);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [auth, firestore]);

  return (
    <UserContext.Provider value={{ user, appUser, loading }}>
      {children}
    </UserContext.Provider>
  );
}

export const useUserContext = () => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUserContext must be used within a UserProvider');
  }
  return context;
};

export const useUser = () => {
    return useUserContext().user;
};

export const useAppUser = () => {
    return useUserContext().appUser;
};
