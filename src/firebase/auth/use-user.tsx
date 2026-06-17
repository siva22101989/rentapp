'use client';

import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { type User } from 'firebase/auth';
import { useAuth, useFirestore } from '@/firebase/provider';
import type { AppUser } from '@/lib/definitions';
import { collection, query, where, getDocs, doc, getDoc, setDoc } from 'firebase/firestore';

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

        setUser(fbUser);
        const userEmail = fbUser.email?.toLowerCase();
        const userDocRef = doc(firestore, 'users', fbUser.uid);
        
        // --- IDENTITY LOCK & FULL ACCESS PROTECTION ---
        if (userEmail === 'sivasandeepreddy01@gmail.com') {
            const ownerIdentity: AppUser = {
                id: fbUser.uid,
                email: userEmail,
                role: 'owner',
                phone: fbUser.phoneNumber || '',
                warehouseId: 'sri-lakshmi-warehouse',
            };
            setAppUser(ownerIdentity);
            await setDoc(userDocRef, {
                email: userEmail,
                role: 'owner',
                phone: fbUser.phoneNumber || '',
                warehouseId: 'sri-lakshmi-warehouse',
            }, { merge: true });
            setLoading(false);
            return;
        }

        // --- EXISTING USER CHECK ---
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
          const data = userDocSnap.data();
          setAppUser({ id: userDocSnap.id, ...data } as AppUser);
          setLoading(false);
          return;
        }

        // --- NEW USER PROVISIONING ---
        if (userEmail === 'admin@gmail.com') {
          const data = { role: 'super-admin', email: userEmail, phone: '' };
          await setDoc(userDocRef, data);
          setAppUser({ id: fbUser.uid, ...data } as AppUser);
        } else if (userEmail && !userEmail.startsWith('+')) {
          // Google Auth Flow
          const q = query(collection(firestore, 'managedWarehouses'), where('ownerEmail', '==', userEmail));
          const snap = await getDocs(q);
          if (!snap.empty) {
            const data = { email: userEmail, role: 'owner', phone: fbUser.phoneNumber || '', warehouseId: snap.docs[0].id };
            await setDoc(userDocRef, data);
            setAppUser({ id: fbUser.uid, ...data } as AppUser);
          } else {
             setProvisioningError('Account not listed as a Warehouse Owner.');
          }
        } else if (userEmail?.startsWith('+')) {
          // Staff Phone Flow
          const phonePart = userEmail.substring(1, userEmail.indexOf('@'));
          const cleanPhone = phonePart.replace(/\D/g, '').slice(-10);
          
          const q = query(collection(firestore, 'users'), where('phone', '==', cleanPhone));
          const snap = await getDocs(q);
          
          if (!snap.empty) {
             const staffData = snap.docs[0].data() as any;
             await setDoc(userDocRef, { ...staffData, email: userEmail }, { merge: true });
             setAppUser({ id: fbUser.uid, ...staffData, email: userEmail } as AppUser);
          } else {
             setProvisioningError('Your phone number has not been added to any team yet.');
          }
        } else {
          setProvisioningError('Could not verify warehouse credentials.');
        }

        setLoading(false);
      } catch (err) {
        console.error("Auth state error:", err);
        setProvisioningError("Identity verification failed. Please reload.");
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
  if (context === undefined) throw new Error('useUserContext must be used within a UserProvider');
  return context;
};

export const useUser = () => useUserContext().user;
export const useAppUser = () => useUserContext().appUser;
