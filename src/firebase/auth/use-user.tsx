
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
        // We ensure this specific user is ALWAYS the owner of the main warehouse.
        if (userEmail === 'sivasandeepreddy01@gmail.com') {
            const userDocSnap = await getDoc(userDocRef);
            
            if (userDocSnap.exists() && userDocSnap.data().warehouseId === warehouseId) {
                // User is already correctly setup
                setAppUser({ id: userDocSnap.id, ...userDocSnap.data() } as AppUser);
            } else {
                console.log("Setting up owner identity for:", userEmail);
                // We set the user document first. This is critical for data visibility.
                const newAppUserData: Omit<AppUser, 'id'> = {
                    email: userEmail,
                    role: 'owner',
                    phone: fbUser.phoneNumber || '',
                    warehouseId: warehouseId,
                };
                await setDoc(userDocRef, newAppUserData);
                setAppUser({ id: fbUser.uid, ...newAppUserData } as AppUser);
                
                // Try to create the warehouse metadata in the background. 
                // This might fail due to rules if the user isn't fully propagated yet, 
                // but the identity above is what matters for seeing data.
                try {
                    const batch = writeBatch(firestore);
                    const managedWHRef = doc(firestore, 'managedWarehouses', warehouseId);
                    batch.set(managedWHRef, cleanForFirestore({
                        name: 'Sri Lakshmi Warehouse',
                        ownerName: 'Siva Sandeep Reddy',
                        ownerEmail: userEmail,
                        yearlyAmount: 0,
                        subscriptionStatus: 'active',
                        createdAt: new Date(),
                    }), { merge: true });

                    const whInfoRef = doc(firestore, 'warehouses', warehouseId);
                    batch.set(whInfoRef, { name: 'Sri Lakshmi Warehouse', ownerName: 'Siva Sandeep Reddy' }, { merge: true });
                    await batch.commit();
                } catch (e) {
                    console.warn("Background metadata setup deferred:", e);
                }
            }
            setUser(fbUser);
            setLoading(false);
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
