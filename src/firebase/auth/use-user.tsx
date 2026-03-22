
'use client';

import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { type User } from 'firebase/auth';
import { useAuth, useFirestore } from '@/firebase/provider';
import type { AppUser } from '@/lib/definitions';
import { collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import { cleanForFirestore } from '@/lib/utils';

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
      if (fbUser && fbUser.email) {
        // User is authenticated, check if they are authorized in our app.
        const usersRef = collection(firestore, 'users');
        
        // Check if there are any users in the collection at all.
        const allUsersSnapshot = await getDocs(usersRef);

        if (allUsersSnapshot.empty) {
          // This is the first user ever. Make them a super-admin.
          const userDocData = { email: fbUser.email.toLowerCase(), role: 'super-admin' as const };
          try {
            const newUserDocRef = await addDoc(usersRef, cleanForFirestore(userDocData));
            setAppUser({ id: newUserDocRef.id, ...userDocData });
            setUser(fbUser);
          } catch (e) {
            console.error("Failed to create first user:", e);
            await auth.signOut(); // Sign out on failure
          }
        } else {
          // Users exist. Check if the current user is one of them.
          const q = query(usersRef, where('email', '==', fbUser.email.toLowerCase()));
          const userQuerySnapshot = await getDocs(q);

          if (!userQuerySnapshot.empty) {
            // User is authorized.
            const userDoc = userQuerySnapshot.docs[0];
            setAppUser({ id: userDoc.id, ...userDoc.data() } as AppUser);
            setUser(fbUser);
          } else {
            // User is authenticated with Firebase but not in our app's user list.
            // This is an unauthorized user. Sign them out.
            await auth.signOut();
            // The next onAuthStateChanged event will clear the user/appUser state.
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
