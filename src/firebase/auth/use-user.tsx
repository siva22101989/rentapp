'use client';

import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { type User } from 'firebase/auth';
import { useAuth, useFirestore } from '@/firebase/provider';
import type { AppUser } from '@/lib/definitions';
import { collection, query, where, getDocs, doc, getDoc, setDoc, writeBatch } from 'firebase/firestore';
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
        const warehouseId = 'sri-lakshmi-warehouse';

        // --- SPECIAL OWNER PROVISIONING ---
        // Ensure this specific user is ALWAYS treated as the owner of the main warehouse.
        if (userEmail === 'sivasandeepreddy01@gmail.com') {
            // 1. Immediately set identity to allow data to flow
            const ownerIdentity: AppUser = {
                id: fbUser.uid,
                email: userEmail,
                role: 'owner',
                phone: fbUser.phoneNumber || '',
                warehouseId: warehouseId,
            };
            setAppUser(ownerIdentity);
            setUser(fbUser);
            setLoading(false);

            // 2. Perform background synchronization (non-blocking)
            getDoc(userDocRef).then(async (snap) => {
                if (!snap.exists() || snap.data().warehouseId !== warehouseId) {
                    console.log("Synchronizing owner profile...");
                    await setDoc(userDocRef, {
                        email: userEmail,
                        role: 'owner',
                        phone: fbUser.phoneNumber || '',
                        warehouseId: warehouseId,
                    }, { merge: true });
                }
            }).catch(e => console.warn("Owner sync deferred:", e));

            return;
        }

        // --- STANDARD USER HANDLING ---
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
          setAppUser({ id: userDocSnap.id, ...userDocSnap.data() } as AppUser);
          setUser(fbUser);
          setLoading(false);
          return;
        }

        // --- NEW USER PROVISIONING ---
        if (userEmail === 'admin@gmail.com') {
          const data = { role: 'super-admin', email: userEmail, phone: '' };
          await setDoc(userDocRef, data);
          setAppUser({ id: fbUser.uid, ...data } as AppUser);
        } else if (userEmail && !userEmail.startsWith('+')) {
          // Check managed warehouses
          const q = query(collection(firestore, 'managedWarehouses'), where('ownerEmail', '==', userEmail));
          const snap = await getDocs(q);
          if (!snap.empty) {
            const data = { email: userEmail, role: 'owner', phone: fbUser.phoneNumber || '', warehouseId: snap.docs[0].id };
            await setDoc(userDocRef, data);
            setAppUser({ id: fbUser.uid, ...data } as AppUser);
          } else {
             setProvisioningError('Unauthorized account.');
          }
        } else if (userEmail?.startsWith('+')) {
          // Phone staff
          const phone = userEmail.substring(1, userEmail.indexOf('@'));
          const q = query(collection(firestore, 'users'), where('phone', '==', phone));
          const snap = await getDocs(q);
          if (!snap.empty) {
             const staffData = snap.docs[0].data() as any;
             await setDoc(userDocRef, staffData);
             setAppUser({ id: fbUser.uid, ...staffData } as AppUser);
          } else {
             setProvisioningError('Unauthorized phone access.');
          }
        } else {
          setProvisioningError('Could not authorize account.');
        }

        setUser(fbUser);
        setLoading(false);

      } catch (err) {
        console.error("Auth state change error:", err);
        setProvisioningError("Login error. Please reload.");
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
