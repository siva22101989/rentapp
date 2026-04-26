
'use client';

import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { type User } from 'firebase/auth';
import { useAuth, useFirestore } from '@/firebase/provider';
import type { AppUser, ManagedWarehouse } from '@/lib/definitions';
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
        const existingAppUser = { id: userDocSnap.id, ...userDocSnap.data() } as AppUser;
        
        // Defensive check for existing users
        if (existingAppUser.role && existingAppUser.role !== 'super-admin' && !existingAppUser.warehouseId) {
          // Attempt to self-heal the user document
          const userEmail = existingAppUser.email || fbUser.email?.toLowerCase();
          if (userEmail) {
            const warehousesCol = collection(firestore, 'managedWarehouses');
            const q = query(warehousesCol, 
                where('ownerEmail', '==', userEmail),
                where('subscriptionStatus', 'in', ['active', 'trial'])
            );
            const warehouseSnap = await getDocs(q);

            if (warehouseSnap.size > 1) {
                console.error(`Self-heal failed: Multiple active warehouses found for owner email ${userEmail}.`);
                setProvisioningError('Your account is linked to multiple warehouses. Please contact support. (Code: WID_HEAL_MULTI)');
                setUser(fbUser);
                setAppUser(null);
                setLoading(false);
                return;
            }

            if (!warehouseSnap.empty) {
              const warehouseId = warehouseSnap.docs[0].id;
              console.log(`Attempting to repair user ${fbUser.uid} with warehouseId ${warehouseId}`);
              
              const updatedAppUser = { ...existingAppUser, warehouseId };
              await setDoc(userDocRef, updatedAppUser, { merge: true });

              // Successfully repaired, now proceed with the corrected user data.
              setAppUser(updatedAppUser);
              setUser(fbUser);
              setLoading(false);
              return; // End of flow for repaired user
            }
          }
          
          // If self-healing fails, show the error.
          console.error(`FATAL: User ${fbUser.uid} has role '${existingAppUser.role}' but no warehouseId. Self-healing failed.`);
          setProvisioningError('Your user account is misconfigured. Please contact support. (Code: WID_MISSING_EXISTING)');
          setUser(fbUser);
          setAppUser(null);
          setLoading(false);
          return;
        }

        if (existingAppUser.role) {
          // User document is valid.
          setAppUser(existingAppUser);
          setUser(fbUser);
          setLoading(false);
        } else {
          // User document is incomplete or invalid.
          console.error(`Invalid user document for UID: ${fbUser.uid}. Missing role.`);
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
      if (userEmail === 'admin@gmail.com' || userEmail === 'sivasandeepreddy01@gmail.com') {
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
        const q = query(
          warehousesCol, 
          where('ownerEmail', '==', userEmail), 
          where('subscriptionStatus', 'in', ['active', 'trial'])
        );
        const warehouseSnap = await getDocs(q);

        if (warehouseSnap.size > 1) {
            console.error(`FATAL: Multiple active warehouses found for owner email ${userEmail}. Cannot determine which warehouse to assign.`);
            setProvisioningError('Your account is linked to multiple active warehouses. Please contact support to resolve this ambiguity.');
            setUser(fbUser);
            setAppUser(null);
            setLoading(false);
            return;
        }

        if (!warehouseSnap.empty) {
          const warehouseDoc = warehouseSnap.docs[0];
          const warehouseId = warehouseDoc.id;

          if (!warehouseId) {
            console.error("FATAL: managedWarehouse document has no ID. This should be impossible.", warehouseDoc.data());
            setProvisioningError("Critical account setup failed (Code: WID_NULL). Contact support.");
            setAppUser(null);
            setUser(fbUser);
            setLoading(false);
            return;
          }

          const newAppUserData: Omit<AppUser, 'id'> = {
              email: userEmail,
              role: 'owner',
              phone: fbUser.phoneNumber || '',
              warehouseId: warehouseId,
          };
          await setDoc(userDocRef, newAppUserData);
          
          // Create the separate settings document for this warehouse
          const warehouseSettingsRef = doc(firestore, 'warehouses', warehouseDoc.id);
          const managedWarehouseData = warehouseDoc.data() as ManagedWarehouse;
          await setDoc(warehouseSettingsRef, {
              name: managedWarehouseData.name,
              ownerName: managedWarehouseData.ownerName,
          }, { merge: true });

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

          if (newAppUserData.role !== 'super-admin' && !newAppUserData.warehouseId) {
             console.error(`FATAL: Staff user ${phone} is being provisioned without a warehouseId.`);
             setProvisioningError('Your staff account is misconfigured. Please contact your manager. (Code: WID_MISSING_STAFF)');
             setUser(fbUser);
             setAppUser(null);
             setLoading(false);
             return;
          }
          
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
