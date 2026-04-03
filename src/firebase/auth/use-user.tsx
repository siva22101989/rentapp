<<<<<<< HEAD
'use client';

import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { type User } from 'firebase/auth';
import { useAuth, useFirestore } from '@/firebase/provider';
import type { AppUser } from '@/lib/definitions';
import { collection, query, where, getDocs, addDoc, or } from 'firebase/firestore';
import { cleanForFirestore } from '@/lib/utils';
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

    const handlePermissionError = (operation: 'list' | 'create', path: string, resource?: any) => {
      const permissionError = new FirestorePermissionError({
        path,
        operation,
        ...(resource && { requestResourceData: resource }),
      });
      errorEmitter.emit('permission-error', permissionError, auth.currentUser);
    };

    const unsubscribe = auth.onAuthStateChanged((fbUser) => {
      setLoading(true);
      if (fbUser) {
        const usersRef = collection(firestore, 'users');

        getDocs(usersRef)
          .then((allUsersSnapshot) => {
            if (allUsersSnapshot.empty && fbUser.providerData.some(p => p.providerId === 'google.com')) {
              const userDocData: { email?: string; phone?: string; role: 'super-admin' } = { role: 'super-admin' };
              if (fbUser.email) userDocData.email = fbUser.email.toLowerCase();
              if (fbUser.phoneNumber) userDocData.phone = fbUser.phoneNumber;
              const cleanUserDocData = cleanForFirestore(userDocData);

              addDoc(usersRef, cleanUserDocData)
                .then(newUserDocRef => {
                  setAppUser({ id: newUserDocRef.id, ...userDocData } as AppUser);
                  setUser(fbUser);
                  setLoading(false);
                })
                .catch(e => {
                  handlePermissionError('create', 'users', cleanUserDocData);
                  console.error("Failed to create first user:", e);
                  auth.signOut();
                  setLoading(false);
                });
            } else {
              let userQuery;
              const userEmail = fbUser.email;
              const userPhone = fbUser.phoneNumber;

              if (userEmail && userEmail.startsWith('+') && userEmail.endsWith(`@${firebaseConfig.authDomain}`)) {
                const phone = userEmail.substring(1, userEmail.indexOf('@'));
                userQuery = query(usersRef, where('phone', '==', phone));
              } else {
                const conditions = [];
                if (userEmail) conditions.push(where('email', '==', userEmail.toLowerCase()));
                if (userPhone) conditions.push(where('phone', '==', userPhone));

                if (conditions.length > 0) {
                  userQuery = query(usersRef, or(...conditions));
                }
              }

              if (userQuery) {
                getDocs(userQuery)
                  .then(userQuerySnapshot => {
                    if (!userQuerySnapshot.empty) {
                      const userDoc = userQuerySnapshot.docs[0];
                      setAppUser({ id: userDoc.id, ...userDoc.data() } as AppUser);
                      setUser(fbUser);
                    } else {
                      auth.signOut();
                    }
                    setLoading(false);
                  })
                  .catch(e => {
                    handlePermissionError('list', 'users');
                    console.error("Failed to query user:", e);
                    auth.signOut();
                    setLoading(false);
                  });
              } else {
                auth.signOut();
                setLoading(false);
              }
            }
          })
          .catch(e => {
            handlePermissionError('list', 'users');
            console.error("Failed to list users:", e);
            auth.signOut();
            setLoading(false);
          });
      } else {
        setUser(null);
        setAppUser(null);
        setLoading(false);
      }
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
}

export const useAppUser = () => {
    return useUserContext().appUser;
}
=======

'use client';

import { useState, useEffect } from 'react';
import { onAuthStateChanged, type Auth } from 'firebase/auth';
import type { User } from '@/lib/definitions';
import { useAuth } from '@/firebase';
import { usePathname, useRouter } from 'next/navigation';

export const useUser = () => {
  const auth = useAuth();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      // If we are not on the login page and there is no auth, redirect.
      if (pathname !== '/login') {
          router.push('/login');
      }
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        // You can map the Firebase user to your custom User type
        const appUser: User = {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
          photoURL: firebaseUser.photoURL,
        };
        setUser(appUser);
      } else {
        setUser(null);
         if (pathname !== '/login') {
            router.push('/login');
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [auth, router, pathname]);

  return { user, loading };
};
>>>>>>> 493f64cf071699c798704dd512006dc35618f02c
