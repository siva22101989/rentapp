
'use client';

import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { type User } from 'firebase/auth';
import { useAuth, useFirestore } from '@/firebase/provider';
import type { AppUser } from '@/lib/definitions';
import { collection, query, where, getDocs, doc, getDoc, writeBatch, setDoc, deleteDoc } from 'firebase/firestore';

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

      // Step 1: Check if a user document already exists.
      const userDocRef = doc(firestore, 'users', fbUser.uid);
      const userDocSnap = await getDoc(userDocRef);

      if (userDocSnap.exists()) {
        // User document exists, this is a returning user.
        const existingAppUser = { id: userDocSnap.id, ...userDocSnap.data() } as AppUser;
        if (existingAppUser.role && (existingAppUser.role === 'super-admin' || existingAppUser.warehouseId)) {
          // User document is valid.
          setAppUser(existingAppUser);
          setUser(fbUser);
          setLoading(false);
        } else {
          // User document is incomplete or invalid.
          console.error(`Invalid user document for UID: ${fbUser.uid}. Missing role or warehouseId.`);
          setProvisioningError('Your account is not configured correctly. Please contact your administrator.');
          setUser(fbUser);
          setAppUser(null);
          setLoading(false);
        }
        return; // End of flow for existing user
      }

      // Step 2: User document does not exist. This is a first-time sign-in, so try to provision a new user.
      const userEmail = fbUser.email?.toLowerCase();

      // Attempt to provision as Super-Admin
      if (userEmail === 'admin@gmail.com') {
        const newAppUserData: Omit<AppUser, 'id'> = { role: 'super-admin', email: userEmail, phone: '' };
        await setDoc(userDocRef, newAppUserData);
        setAppUser({ id: fbUser.uid, ...newAppUserData } as AppUser);
        setUser(fbUser);
        setLoading(false);
        return;
      }
      
      // Attempt to provision as Warehouse Owner
      if (userEmail && !userEmail.startsWith('+')) {
        const warehousesCol = collection(firestore, 'managedWarehouses');
        const q = query(warehousesCol, where('ownerEmail', '==', userEmail));
        const warehouseSnap = await getDocs(q);

        if (!warehouseSnap.empty) {
          const warehouseDoc = warehouseSnap.docs[0];
          const newAppUserData: Omit<AppUser, 'id'> = {
              email: userEmail,
              role: 'owner',
              warehouseId: warehouseDoc.id,
              phone: fbUser.phoneNumber || ''
          };
          await setDoc(userDocRef, newAppUserData);
          setAppUser({ id: fbUser.uid, ...newAppUserData } as AppUser);
          setUser(fbUser);
          setLoading(false);
          return;
        }
      }

      // Attempt to provision as Staff (phone-based)
      if (userEmail && userEmail.startsWith('+')) {
        const phone = userEmail.substring(1, userEmail.indexOf('@'));
        const usersCol = collection(firestore, 'users');
        const q = query(usersCol, where('phone', '==', phone));
        const staffSnap = await getDocs(q);
        
        if (!staffSnap.empty) {
          const staffDocToDelete = staffSnap.docs[0];
          const newAppUserData = staffDocToDelete.data() as Omit<AppUser, 'id'>;
          
          const batch = writeBatch(firestore);
          // Create new user doc with UID
          batch.set(userDocRef, newAppUserData);
          // Delete old placeholder doc
          batch.delete(staffDocToDelete.ref);
          await batch.commit();

          setAppUser({ id: fbUser.uid, ...newAppUserData } as AppUser);
          setUser(fbUser);
          setLoading(false);
          return;
        }
      }
      
      // Step 3: If no provisioning rule matched, the user is not authorized.
      console.error(`Unauthorized user login attempt: No provisioning rule matched for UID ${fbUser.uid} / email ${fbUser.email}.`);
      setProvisioningError('Your account is not authorized to access this application. Please contact your administrator.');
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

export const useUser = () => {
    return useUserContext().user;
};

export const useAppUser = () => {
    return useUserContext().appUser;
};
