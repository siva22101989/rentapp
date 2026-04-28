
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
      setLoading(true);
      setProvisioningError(null);
      
      if (!fbUser) {
        setUser(null);
        setAppUser(null);
        setLoading(false);
        return;
      }

      setUser(fbUser); // Set the Firebase user object immediately

      try {
        const userDocRef = doc(firestore, 'users', fbUser.uid);
        const userDocSnap = await getDoc(userDocRef);

        if (userDocSnap.exists()) {
          // User document already exists, we're good.
          setAppUser({ id: userDocSnap.id, ...userDocSnap.data() } as AppUser);
        } else {
          // User does not have a user document with their UID, so we need to provision one.
          const userEmail = fbUser.email?.toLowerCase();
          let provisionedAppUser: AppUser | null = null;
          
          // SCENARIO 1: Super-Admin ('admin@gmail.com')
          if (userEmail === 'admin@gmail.com') {
            const newAppUserData: Omit<AppUser, 'id'> = { role: 'super-admin', email: userEmail, phone: '' };
            await setDoc(userDocRef, newAppUserData);
            provisionedAppUser = { id: fbUser.uid, ...newAppUserData } as AppUser;
          }
          // SCENARIO 2: Special Main Owner ('sivasandeepreddy01@gmail.com')
          else if (userEmail === 'sivasandeepreddy01@gmail.com') {
              const warehouseId = 'sri-lakshmi-warehouse';
              const newAppUserData: Omit<AppUser, 'id'> = {
                  email: userEmail,
                  role: 'owner',
                  phone: fbUser.phoneNumber || '',
                  warehouseId: warehouseId,
              };
              
              const batch = writeBatch(firestore);
              batch.set(userDocRef, newAppUserData);

              const managedWarehouseRef = doc(firestore, 'managedWarehouses', warehouseId);
              batch.set(managedWarehouseRef, cleanForFirestore({
                  name: 'Sri Lakshmi Warehouse',
                  ownerName: 'Siva Sandeep Reddy',
                  ownerEmail: userEmail,
                  yearlyAmount: 0,
                  subscriptionStatus: 'active' as const,
                  createdAt: new Date(),
              }), { merge: true });

              const warehouseSettingsRef = doc(firestore, 'warehouses', warehouseId);
              batch.set(warehouseSettingsRef, { name: 'Sri Lakshmi Warehouse', ownerName: 'Siva Sandeep Reddy' }, { merge: true });

              await batch.commit();
              provisionedAppUser = { id: fbUser.uid, ...newAppUserData } as AppUser;
          }
          // SCENARIO 3: Other Warehouse Owners (Google Sign-In)
          else if (userEmail && !userEmail.startsWith('+')) {
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
              provisionedAppUser = { id: fbUser.uid, ...newAppUserData } as AppUser;
            }
          }
          // SCENARIO 4: Staff Member (Phone Auth)
          else if (userEmail && userEmail.startsWith('+')) {
            const phone = userEmail.substring(1, userEmail.indexOf('@'));
            const usersCol = collection(firestore, 'users');
            const q = query(usersCol, where('phone', '==', phone));
            const staffSnap = await getDocs(q);
            
            if (!staffSnap.empty) {
              const staffDocToDelete = staffSnap.docs[0];
              const newAppUserData = staffDocToDelete.data() as Omit<AppUser, 'id'>;
              
              const batch = writeBatch(firestore);
              batch.set(userDocRef, newAppUserData);
              batch.delete(staffDocToDelete.ref); // Migrate from old doc ID to UID
              await batch.commit();

              provisionedAppUser = { id: fbUser.uid, ...newAppUserData } as AppUser;
            }
          }

          // FINAL CHECK: If a user was provisioned, set them. Otherwise, they are unauthorized.
          if (provisionedAppUser) {
            setAppUser(provisionedAppUser);
          } else {
            setAppUser(null);
            setProvisioningError('Your account is not authorized to access this application. Please contact your administrator.');
          }
        }
      } catch (err) {
        console.error("Error during user provisioning:", err);
        setAppUser(null);
        setProvisioningError("An unexpected error occurred during login. Please try again.");
      } finally {
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
