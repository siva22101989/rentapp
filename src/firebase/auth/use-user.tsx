
'use client';

import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import type { User } from 'firebase/auth';
import { useAuth, useFirestore } from '@/firebase';
import type { AppUser, ManagedWarehouse } from '@/lib/definitions';
import { doc, getDoc, setDoc, query, collection, where, getDocs, updateDoc } from 'firebase/firestore';

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
          // This block is for auto-provisioning new users or linking existing ones.
          const userEmail = fbUser.email?.toLowerCase();
          
          // Special case for the main owner of this specific app.
          if (userEmail === 'sivasandeepreddy01@gmail.com') {
            const warehouseId = 'sri-lakshmi-warehouse';
            const newAppUserData: Omit<AppUser, 'id'> = {
              email: userEmail,
              role: 'owner',
              phone: fbUser.phoneNumber || '',
              warehouseId: warehouseId,
            };
            
            await setDoc(userDocRef, newAppUserData);

            // Also ensure the warehouse info doc exists.
            const warehouseSettingsRef = doc(firestore, 'warehouses', warehouseId);
            await setDoc(warehouseSettingsRef, { name: 'Sri Lakshmi Warehouse' }, { merge: true });

            setAppUser({ id: fbUser.uid, ...newAppUserData } as AppUser);
          } 
          // Case for staff members who sign in with phone + password
          else if (fbUser.email?.startsWith('+')) {
            const phone = fbUser.email?.split('@')[0].replace('+', '');
            const q = query(collection(firestore, 'users'), where('phone', '==', phone));
            const phoneUserSnapshot = await getDocs(q);

            if (!phoneUserSnapshot.empty) {
                 const phoneUserDoc = phoneUserSnapshot.docs[0];
                 // Found the user doc by phone number. Now we need to create a user doc with the *new auth UID*
                 // but containing the role and warehouseId from the doc we found.
                 const newStaffUserData: Omit<AppUser, 'id'> = {
                     email: userEmail,
                     phone: phoneUserDoc.data().phone,
                     role: phoneUserDoc.data().role,
                     warehouseId: phoneUserDoc.data().warehouseId,
                 };
                 await setDoc(userDocRef, newStaffUserData);
                 setAppUser({ id: fbUser.uid, ...newStaffUserData } as AppUser);
            } else {
                 setProvisioningError('Your phone number is not registered. Please contact your administrator.');
                 setAppUser(null);
                 await auth.signOut();
            }
          }
          // Case for super-admin or other warehouse owners (more generic)
          else {
              let newAppUser: Omit<AppUser, 'id'> | null = null;
              if (userEmail === 'admin@gmail.com') {
                  newAppUser = { email: userEmail, role: 'super-admin', phone: '' };
              } else {
                  const q = query(collection(firestore, 'managedWarehouses'), where('ownerEmail', '==', userEmail));
                  const querySnapshot = await getDocs(q);

                  if (!querySnapshot.empty) {
                      const warehouseDoc = querySnapshot.docs[0];
                      newAppUser = {
                          email: userEmail,
                          role: 'owner',
                          phone: fbUser.phoneNumber || '',
                          warehouseId: warehouseDoc.id,
                      };
                  }
              }

              if (newAppUser) {
                await setDoc(userDocRef, newAppUser);
                setAppUser({ id: fbUser.uid, ...newAppUser } as AppUser);
              } else {
                setProvisioningError('Your account is not authorized. Please contact the administrator.');
                setAppUser(null);
                await auth.signOut();
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
