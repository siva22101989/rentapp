
'use client';
import { useState, useEffect } from 'react';
import { onSnapshot, type Query, type DocumentData } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { toDate } from '@/lib/utils';
import { useAuth } from '@/firebase';

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
      (err: any) => {
        if (err.code === 'permission-denied') {
            const permissionError = new FirestorePermissionError({
              path: (q && 'path' in q) ? (q as any).path : '/unknown-query-path',
              operation: 'list',
            });
            errorEmitter.emit('permission-error', permissionError, auth?.currentUser || null);
            setError(permissionError);
        } else {
            console.error("useCollection error:", err);
            setError(err);
        }
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [q, auth]);

  return { data, loading, error };
}
