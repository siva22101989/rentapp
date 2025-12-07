
'use client';

import { useState, useEffect } from 'react';
import { onSnapshot, type DocumentReference } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { toDate } from '@/lib/utils';

export const useDoc = <T extends { id: string }>(ref: DocumentReference | null) => {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

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
          setData({ id: doc.id, ...docData } as T);
        } else {
          setData(null);
        }
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error("onSnapshot error:", err);
        const permissionError = new FirestorePermissionError({
          path: ref.path,
          operation: 'get',
        });
        errorEmitter.emit('permission-error', permissionError);
        setError(permissionError);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(ref?.path)]);

  return { data, loading, error };
};
