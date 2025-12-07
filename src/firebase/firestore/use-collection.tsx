
'use client';

import { useState, useEffect } from 'react';
import {
  onSnapshot,
  type CollectionReference,
  type Query,
} from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { toDate } from '@/lib/utils';

export const useCollection = <T extends { id: string }>(
  q: Query | CollectionReference | null,
) => {
  const [data, setData] = useState<T[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!q) {
        setData([]);
        setLoading(false);
        return;
    };

    setLoading(true);

    const unsubscribe = onSnapshot(
      q,
      (querySnapshot) => {
        const docs: T[] = [];
        querySnapshot.forEach((doc) => {
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
          docs.push({ id: doc.id, ...docData } as T);
        });
        setData(docs);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error("onSnapshot error:", err);
        const permissionError = new FirestorePermissionError({
          path: q.path,
          operation: 'list',
        });
        errorEmitter.emit('permission-error', permissionError);
        setError(permissionError);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(q)]);

  return { data, loading, error };
};
