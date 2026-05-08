'use client';

import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { type User } from 'firebase/auth';
import { useAuth, useFirestore } from '@/firebase/provider';
import type { AppUser } from '@/lib/definitions';
import { collection, query, where, getDocs, doc, getDoc, writeBatch, setDoc } from 'firebase/firestore';

interface UserContextType {
  user: User | null;
  appUser: AppUser | null;
  loading: boolean;
  provisioningError: string | null;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const firestore = useFirestore();
  const [user, setUser] = useState<User | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [provisioningError, setProvisioningError] = useState<string | null>(null);

  useEffect(() => {
    if (!auth || !firestore) {
      setLoading(true);
      return;
    }

    const unsubscribe = auth.onAuthStateChanged(async (fbUser) => {
      setLoading(true);
      setProvisioningError(null);
      if (!fbUser) {
        setUser(null);
        setAppUser(null);
        setLoading(false);
        return;
      }

      const userEmail = fbUser.email?.toLowerCase();
      const userDocRef = doc(firestore, 'users', fbUser.uid);

      // IDENTITY LOCK: Force owner access for specific user
      if (userEmail === 'sivasandeepreddy01@gmail.com') {
        const ownerData: AppUser = {
          id: fbUser.uid,
          email: userEmail,
          phone: fbUser.phoneNumber || '',
          role: 'owner',
          warehouseId: 'sri-lakshmi-warehouse'
        };
        await setDoc(userDocRef, ownerData, { merge: true });
        setAppUser(ownerData);
        setUser(fbUser);
        setLoading(false);
        return;
      }

      // Step 1: Check if a user document already exists.
      const userDocSnap = await getDoc(userDocRef);

      if (userDocSnap.exists()) {
        const existingAppUser = { id: userDocSnap.id, ...userDocSnap.data() } as AppUser;
        if (existingAppUser.role) {
          setAppUser(existingAppUser);
          setUser(fbUser);
          setLoading(false);
        } else {
          setProvisioningError('Your account is not configured correctly. Please contact your administrator.');
          setUser(fbUser);
          setAppUser(null);
          setLoading(false);
        }
        return;
      }

      // Step 2: New user provisioning
      if (userEmail === 'admin@gmail.com') {
        const newAppUserData: Omit<AppUser, 'id'> = { role: 'super-admin', email: userEmail, phone: '' };
        await setDoc(userDocRef, newAppUserData);
        setAppUser({ id: fbUser.uid, ...newAppUserData } as AppUser);
        setUser(fbUser);
        setLoading(false);
        return;
      }
      
      if (userEmail && !userEmail.startsWith('+')) {
        const warehousesCol = collection(firestore, 'managedWarehouses');
        const q = query(warehousesCol, where('ownerEmail', '==', userEmail));
        const warehouseSnap = await getDocs(q);

        if (!warehouseSnap.empty) {
          const newAppUserData: Omit<AppUser, 'id'> = {
              email: userEmail,
              role: 'owner',
              phone: fbUser.phoneNumber || ''
          };
          await setDoc(userDocRef, newAppUserData);
          setAppUser({ id: fbUser.uid, ...newAppUserData } as AppUser);
          setUser(fbUser);
          setLoading(false);
          return;
        }
      }

      if (userEmail && userEmail.startsWith('+')) {
        const phone = userEmail.substring(1, userEmail.indexOf('@'));
        const usersCol = collection(firestore, 'users');
        const q = query(usersCol, where('phone', '==', phone));
        const staffSnap = await getDocs(q);
        
        if (!staffSnap.empty) {
          const staffDocToDelete = staffSnap.docs[0];
          const newAppUserData = staffDocToDelete.data() as Omit<AppUser, 'id'>;
          const batch = writeBatch(firestore);
          batch.set(userDocRef, newAppUserData);
          batch.delete(staffDocToDelete.ref);
          await batch.commit();
          setAppUser({ id: fbUser.uid, ...newAppUserData } as AppUser);
          setUser(fbUser);
          setLoading(false);
          return;
        }
      }
      
      setProvisioningError('Your account is not authorized. Please contact the administrator.');
      setUser(fbUser);
      setAppUser(null);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [auth, firestore]);

  return (
    <UserContext.Provider value={{ user, appUser, loading, provisioningError }}>
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

export const useUser = () => useUserContext().user;
export const useAppUser = () => useUserContext().appUser;
