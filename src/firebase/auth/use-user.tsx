
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
