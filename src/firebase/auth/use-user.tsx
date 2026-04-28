
'use client';

import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { type User } from 'firebase/auth';
import { useAuth, useFirestore } from '@/firebase/provider';
import type { AppUser, ManagedWarehouse } from '@/lib/definitions';
import { collection, query, where, getDocs, doc, getDoc, writeBatch, setDoc, addDoc } from 'firebase/firestore';
import { cleanForFirestore } from '@/lib/utils';

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
      try {
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

        // Special handling for the main user to ensure they are an owner
        if (userEmail === 'sivasandeepreddy01@gmail.com') {
            const warehouseId = 'sri-lakshmi-warehouse';
            const warehouseName = 'Sri Lakshmi Warehouse';
            const ownerName = 'Siva Sandeep Reddy';

            let appUserToSet: AppUser;
            const userDocSnap = await getDoc(userDocRef);

            if (userDocSnap.exists() && userDocSnap.data().role === 'owner' && userDocSnap.data().warehouseId === warehouseId) {
                appUserToSet = { id: userDocSnap.id, ...userDocSnap.data() } as AppUser;
            } else {
                console.log(`Provisioning/Fixing owner: ${userEmail}`);
                const batch = writeBatch(firestore);
                const newAppUserData: Omit<AppUser, 'id'> = {
                    email: userEmail,
                    role: 'owner',
                    phone: fbUser.phoneNumber || '',
                    warehouseId: warehouseId,
                };
                batch.set(userDocRef, newAppUserData);
                appUserToSet = { id: fbUser.uid, ...newAppUserData } as AppUser;

                const managedWarehouseRef = doc(firestore, 'managedWarehouses', warehouseId);
                const newManagedWarehouseData = {
                    name: warehouseName,
                    ownerName: ownerName,
                    ownerEmail: userEmail,
                    yearlyAmount: 0,
                    subscriptionStatus: 'active' as const,
                    createdAt: new Date(),
                };
                batch.set(managedWarehouseRef, cleanForFirestore(newManagedWarehouseData), { merge: true });

                const warehouseSettingsRef = doc(firestore, 'warehouses', warehouseId);
                batch.set(warehouseSettingsRef, { name: warehouseName, ownerName: ownerName }, { merge: true });

                await batch.commit();
                console.log(`Provisioning for ${userEmail} complete.`);
            }

            setAppUser(appUserToSet);
            setUser(fbUser);
            setLoading(false);
            return;
        }


        // Step 1: Check if a user document already exists for other users.
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
          const existingAppUser = { id: userDocSnap.id, ...userDocSnap.data() } as AppUser;
          setAppUser(existingAppUser);
          setUser(fbUser);
          setLoading(false);
          return;
        }

        // Step 2: Provision new user if doc doesn't exist
        
        // Super-Admin
        if (userEmail === 'admin@gmail.com') {
          const newAppUserData: Omit<AppUser, 'id'> = { role: 'super-admin', email: userEmail, phone: '' };
          await setDoc(userDocRef, newAppUserData);
          setAppUser({ id: fbUser.uid, ...newAppUserData } as AppUser);
          setUser(fbUser);
          setLoading(false);
          return;
        }
        
        // Warehouse Owner
        if (userEmail && !userEmail.startsWith('+')) {
          const warehousesCol = collection(firestore, 'managedWarehouses');
          const q = query(warehousesCol, where('ownerEmail', '==', userEmail), where('subscriptionStatus', 'in', ['active', 'trial']));
          const warehouseSnap = await getDocs(q);

          if (!warehouseSnap.empty) {
            const warehouseDoc = warehouseSnap.docs[0];
            const newAppUserData: Omit<AppUser, 'id'> = {
                email: userEmail,
                role: 'owner',
                phone: fbUser.phoneNumber || '',
                warehouseId: warehouseDoc.id,
            };
            await setDoc(userDocRef, newAppUserData);
            setAppUser({ id: fbUser.uid, ...newAppUserData } as AppUser);
            setUser(fbUser);
            setLoading(false);
            return;
          }
        }

        // Staff (phone-based)
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
        
        // Step 3: Unauthorized
        console.error(`Unauthorized user login attempt: No provisioning rule matched for UID ${fbUser.uid} / email ${fbUser.email}.`);
        setProvisioningError('Your account is not authorized to access this application. Please contact your administrator.');
        setUser(fbUser);
        setAppUser(null);
        setLoading(false);

      } catch (err) {
        console.error("Unhandled error in onAuthStateChanged:", err);
        setProvisioningError("An unexpected error occurred during login. Please try again.");
        if (auth.currentUser) {
            setUser(auth.currentUser);
        }
        setAppUser(null);
        setLoading(false);
      }
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
