
'use client';

import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { type User } from 'firebase/auth';
import { useAuth, useFirestore } from '@/firebase';
import type { AppUser } from '@/lib/definitions';
import { doc, getDoc, setDoc } from 'firebase/firestore';

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

      setUser(fbUser);

      try {
        const userDocRef = doc(firestore, 'users', fbUser.uid);
        const userDocSnap = await getDoc(userDocRef);

        if (userDocSnap.exists()) {
          setAppUser({ id: userDocSnap.id, ...userDocSnap.data() } as AppUser);
        } else {
          const userEmail = fbUser.email?.toLowerCase();
          
          if (userEmail === 'sivasandeepreddy01@gmail.com') {
            const warehouseId = 'sri-lakshmi-warehouse';
            const newAppUserData: Omit<AppUser, 'id'> = {
              email: userEmail,
              role: 'owner',
              phone: fbUser.phoneNumber || '',
              warehouseId: warehouseId,
            };
            
            await setDoc(userDocRef, newAppUserData);

            const warehouseSettingsRef = doc(firestore, 'warehouses', warehouseId);
            await setDoc(warehouseSettingsRef, { name: 'Sri Lakshmi Warehouse' }, { merge: true });

            setAppUser({ id: fbUser.uid, ...newAppUserData } as AppUser);
          } else {
            const phone = fbUser.email?.split('@')[0].replace('+', '');
            const q = query(collection(firestore, 'users'), where('phone', '==', phone));
            const querySnapshot = await getDocs(q);

            if (!querySnapshot.empty) {
                const existingUserDoc = querySnapshot.docs[0];
                await updateDoc(userDocRef, { ...existingUserDoc.data(), email: fbUser.email });
                setAppUser({ id: userDocRef.id, ...existingUserDoc.data(), email: fbUser.email } as AppUser);
            } else {
                setAppUser(null);
                setProvisioningError('Your account is not registered. Please contact your warehouse administrator.');
            }
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
