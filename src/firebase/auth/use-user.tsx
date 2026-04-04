'use client';

import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { type User } from 'firebase/auth';
import { useAuth, useFirestore } from '@/firebase/provider';
import type { AppUser } from '@/lib/definitions';
import { collection, query, where, getDocs, doc, getDoc, writeBatch, or, setDoc } from 'firebase/firestore';
import { firebaseConfig } from '../config';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

interface UserContextType {
  user: User | null;
  appUser: AppUser | null;
  loading: boolean;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const firestore = useFirestore();
  const [user, setUser] = useState<User | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth || !firestore) {
      setLoading(true);
      return;
    }

    const handlePermissionError = (operation: 'get' | 'list' | 'create' | 'update' | 'delete' | 'write', path: string, resource?: any) => {
      const permissionError = new FirestorePermissionError({
        path,
        operation,
        ...(resource && { requestResourceData: resource }),
      });
      errorEmitter.emit('permission-error', permissionError, auth.currentUser);
    };

    const unsubscribe = auth.onAuthStateChanged(async (fbUser) => {
      setLoading(true);
      if (fbUser) {
        try {
          const userDocRef = doc(firestore, 'users', fbUser.uid);
          const userDocSnap = await getDoc(userDocRef);

          if (userDocSnap.exists()) {
            setAppUser({ id: userDocSnap.id, ...userDocSnap.data() } as AppUser);
            setUser(fbUser);
          } else {
            // Document with UID doesn't exist, try to migrate from an auto-ID document
            const usersCol = collection(firestore, 'users');
            const conditions = [];
            const userEmail = fbUser.email?.toLowerCase();
            if (userEmail && !userEmail.startsWith('+')) {
                conditions.push(where('email', '==', userEmail));
            }
            if (fbUser.phoneNumber) {
                 conditions.push(where('phone', '==', fbUser.phoneNumber));
            }
            // Handle shadow email for phone auth
            if (userEmail && userEmail.startsWith('+') && userEmail.endsWith(`@${firebaseConfig.authDomain}`)) {
                const phone = userEmail.substring(1, userEmail.indexOf('@'));
                conditions.push(where('phone', '==', phone));
            }

            let migrated = false;
            if (conditions.length > 0) {
              const q = query(usersCol, or(...conditions));
              const querySnapshot = await getDocs(q);
              if (!querySnapshot.empty) {
                const oldUserDoc = querySnapshot.docs[0];
                const appUserData = oldUserDoc.data() as Omit<AppUser, 'id'>;
                
                const batch = writeBatch(firestore);
                batch.set(userDocRef, appUserData);
                batch.delete(oldUserDoc.ref);
                await batch.commit();

                setAppUser({ id: userDocRef.id, ...appUserData } as AppUser);
                setUser(fbUser);
                migrated = true;
              }
            }

            if (!migrated) {
              // Not found via query, check if this is the very first user (super-admin)
              const allUsersSnapshot = await getDocs(usersCol);
              if (allUsersSnapshot.empty && fbUser.providerData.some(p => p.providerId === 'google.com')) {
                const superAdminData: Omit<AppUser, 'id'> = { role: 'super-admin', email: userEmail, phone: fbUser.phoneNumber || '' };
                await setDoc(userDocRef, superAdminData);
                setAppUser({ id: userDocRef.id, ...superAdminData } as AppUser);
                setUser(fbUser);
              } else {
                // Not found and not super-admin, deny access
                await auth.signOut();
                setUser(null);
                setAppUser(null);
              }
            }
          }
        } catch (e: any) {
          console.error("Error during user setup:", e);
          handlePermissionError('list', 'users'); // Emit generic error
          await auth.signOut();
          setUser(null);
          setAppUser(null);
        }
      } else {
        setUser(null);
        setAppUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [auth, firestore]);

  return (
    <UserContext.Provider value={{ user, appUser, loading }}>
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
