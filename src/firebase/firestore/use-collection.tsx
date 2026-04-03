
'use client';
import { useState, useEffect } from 'react';
import { onSnapshot, type Query, type DocumentData } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { toDate } from '@/lib/utils';
import { useAuth } from '../provider';

interface UseCollectionReturn<T> {
  data: T[] | null;
  loading: boolean;
  error: Error | null;
}

export function useCollection<T extends DocumentData>(
  q: Query | null
): UseCollectionReturn<T> {
  const [data, setData] = useState<T[] | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const auth = useAuth();

  useEffect(() => {
    if (!q) {
      setData([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = onSnapshot(
      q,
      (querySnapshot) => {
        const documents = querySnapshot.docs.map((doc) => {
            const docData = doc.data();
            // Convert Timestamps to Dates
            Object.keys(docData).forEach(key => {
                if (docData[key] && typeof docData[key].toDate === 'function') {
                    docData[key] = toDate(docData[key]);
                }
            });
            // Ensure nested payment dates are converted
             if (Array.isArray(docData.payments)) {
                docData.payments = docData.payments.map((p: any) => ({...p, date: toDate(p.date)}));
            }
            if (Array.isArray(docData.outflows)) {
                docData.outflows = docData.outflows.map((o: any) => ({...o, date: toDate(o.date)}));
            }
            return {
                id: doc.id,
                ...docData,
            } as T;
        });
        setData(documents);
        setLoading(false);
        setError(null);
      },
      (err) => {
        const permissionError = new FirestorePermissionError({
          path: q.path,
          operation: 'list',
        });
        errorEmitter.emit('permission-error', permissionError, auth?.currentUser || null);
        setError(permissionError);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  // Using path as a dependency string to avoid re-running on object reference change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q?.path]);

  return { data, loading, error };
}
