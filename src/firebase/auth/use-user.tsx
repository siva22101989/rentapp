
'use client';

import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { type User } from 'firebase/auth';
import { useAuth, useFirestore } from '@/firebase/provider';
import type { AppUser } from '@/lib/definitions';
import { collection, query, where, getDocs } from 'firebase/firestore';

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
    if (auth && firestore) {
      const unsubscribe = auth.onAuthStateChanged(async (fbUser) => {
        if (fbUser && fbUser.email) {
          // User is logged in, now get their role from Firestore.
          const usersRef = collection(firestore, 'users');
          const q = query(usersRef, where('email', '==', fbUser.email.toLowerCase()));
          const querySnapshot = await getDocs(q);
          if (!querySnapshot.empty) {
            const userDoc = querySnapshot.docs[0];
            setAppUser({ id: userDoc.id, ...userDoc.data() } as AppUser);
          } else {
            // This case should be handled by login page, but as a fallback:
            setAppUser(null);
            // Optional: sign out user if they have no role?
            // await auth.signOut();
          }
           setUser(fbUser);
        } else {
          setAppUser(null);
          setUser(null);
        }
        setLoading(false);
      });
      return () => unsubscribe();
    } else {
      setLoading(true);
    }
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
