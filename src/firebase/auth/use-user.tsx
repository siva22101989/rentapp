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
          const userEmail = fbUser.email?.toLowerCase();

          // Special handling for the super-admin account.
          if (userEmail === 'admin@gmail.com') {
            const superAdminData = { role: 'super-admin', email: userEmail, phone: '' };
            await setDoc(userDocRef, superAdminData, { merge: true });
            setAppUser({ id: fbUser.uid, ...superAdminData } as AppUser);
            setUser(fbUser);
            setLoading(false);
            return; // Super-admin flow ends here.
          }
          
          let foundAppUser: AppUser | null = null;
          const userDocSnap = await getDoc(userDocRef);

          if (userDocSnap.exists()) {
            foundAppUser = { id: userDocSnap.id, ...userDocSnap.data() } as AppUser;
          } else {
            // Document with UID doesn't exist, try to find an existing user record to migrate
            const usersCol = collection(firestore, 'users');
            let querySnapshot;

            // Check if it's a staff member logging in with a phone-based shadow account
            if (userEmail && userEmail.startsWith('+') && userEmail.endsWith(`@${firebaseConfig.authDomain}`)) {
                const phone = userEmail.substring(1, userEmail.indexOf('@'));
                const q = query(usersCol, where('phone', '==', phone));
                querySnapshot = await getDocs(q);
            } 
            // Check if it's an owner logging in with a real email
            else if (userEmail) {
                const q = query(usersCol, where('email', '==', userEmail));
                querySnapshot = await getDocs(q);
            }
            
            if (querySnapshot && !querySnapshot.empty) {
                const oldUserDoc = querySnapshot.docs[0];
                const appUserData = oldUserDoc.data() as Omit<AppUser, 'id'>;
                
                // This is a critical step: migrate the user data to a new document with the correct UID
                if (oldUserDoc.id !== fbUser.uid) {
                    const batch = writeBatch(firestore);
                    batch.set(userDocRef, appUserData); // Create new doc with UID
                    batch.delete(oldUserDoc.ref);       // Delete old doc
                    await batch.commit();
                }
                foundAppUser = { id: fbUser.uid, ...appUserData };
            }
          }
          
          // Final check: ensure the user has a valid role and warehouse assignment
          if (foundAppUser && (foundAppUser.role === 'super-admin' || foundAppUser.warehouseId)) {
             setAppUser(foundAppUser);
             setUser(fbUser);
          } else {
              if (foundAppUser) {
                  console.error(`Access denied for user ${foundAppUser.id} (${foundAppUser.role}): missing warehouseId.`);
              } else {
                  console.error(`Access denied for user ${fbUser.uid}: No matching user document found in Firestore.`);
              }
              await auth.signOut();
              setUser(null);
              setAppUser(null);
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
