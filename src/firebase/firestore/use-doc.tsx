
'use client';
import { useState, useEffect } from 'react';
import { onSnapshot, type DocumentReference, type DocumentData } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { toDate } from '@/lib/utils';
import { useAuth } from '../provider';

interface UseDocReturn<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
}

export function useDoc<T extends DocumentData>(
  ref: DocumentReference | null
): UseDocReturn<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const auth = useAuth();

  useEffect(() => {
    if (!ref) {
        setData(null);
        setLoading(false);
        return;
    }
    
    setLoading(true);

    const unsubscribe = onSnapshot(
      ref,
      (doc) => {
        if (doc.exists()) {
          const docData = doc.data();
           // Convert any Timestamps to Dates
           for (const key in docData) {
            if (docData[key]?.toDate) {
              docData[key] = toDate(docData[key]);
            }
          }
           // Ensure nested payment dates are converted
          if (Array.isArray(docData.payments)) {
            docData.payments = docData.payments.map((p: any) => ({...p, date: toDate(p.date)}));
          }
           if (Array.isArray(docData.outflows)) {
            docData.outflows = docData.outflows.map((o: any) => ({...o, date: toDate(o.date)}));
          }
          setData({ id: doc.id, ...docData } as T);
        } else {
          setData(null);
        }
        setLoading(false);
        setError(null);
      },
      (err) => {
        const permissionError = new FirestorePermissionError({
          path: ref.path,
          operation: 'get',
        });
        errorEmitter.emit('permission-error', permissionError, auth?.currentUser || null);
        setError(permissionError);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref?.path]);

  return { data, loading, error };
};
