
'use client';

import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { type User } from 'firebase/auth';
import { useAuth, useFirestore } from '@/firebase/provider';
import type { AppUser } from '@/lib/definitions';
import { collection, query, where, getDocs, addDoc, or } from 'firebase/firestore';
import { cleanForFirestore } from '@/lib/utils';
import { firebaseConfig } from '../config';

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

    const unsubscribe = auth.onAuthStateChanged(async (fbUser) => {
      setLoading(true);
      if (fbUser) {
        const usersRef = collection(firestore, 'users');
        
        const allUsersSnapshot = await getDocs(usersRef);

        if (allUsersSnapshot.empty && fbUser.providerData.some(p => p.providerId === 'google.com')) {
          // This is the first user ever signing in with Google. Make them a super-admin.
          const userDocData: { email?: string; phone?: string; role: 'super-admin' } = { role: 'super-admin' };
          if (fbUser.email) userDocData.email = fbUser.email.toLowerCase();
          if (fbUser.phoneNumber) userDocData.phone = fbUser.phoneNumber;

          try {
            const newUserDocRef = await addDoc(usersRef, cleanForFirestore(userDocData));
            setAppUser({ id: newUserDocRef.id, ...userDocData });
            setUser(fbUser);
          } catch (e) {
            console.error("Failed to create first user:", e);
            await auth.signOut();
          }
        } else {
          // Users exist, or this is a team member login.
          let userQuery;
          const userEmail = fbUser.email;
          const userPhone = fbUser.phoneNumber;

          // Check if this is a team member using a "shadow email"
          if (userEmail && userEmail.startsWith('+') && userEmail.endsWith(`@${firebaseConfig.authDomain}`)) {
              const phone = userEmail.split('@')[0];
              userQuery = query(usersRef, where('phone', '==', phone));
          } else {
              // Standard google login or an old email/pass user
              const conditions = [];
              if (userEmail) conditions.push(where('email', '==', userEmail.toLowerCase()));
              if (userPhone) conditions.push(where('phone', '==', userPhone));

              if (conditions.length > 0) {
                  userQuery = query(usersRef, or(...conditions));
              }
          }
          
          if (userQuery) {
            const userQuerySnapshot = await getDocs(userQuery);
            if (!userQuerySnapshot.empty) {
              const userDoc = userQuerySnapshot.docs[0];
              setAppUser({ id: userDoc.id, ...userDoc.data() } as AppUser);
              setUser(fbUser);
            } else {
              // User is authenticated with Firebase but not in our app's user list.
              await auth.signOut();
            }
          } else {
             // User has no email or phone, and doesn't match shadow email format.
            await auth.signOut();
          }
        }
      } else {
        // User is not logged in.
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
}

export const useAppUser = () => {
    return useUserContext().appUser;
}
