
'use client';
<<<<<<< HEAD
import { useState, useEffect } from 'react';
import { onSnapshot, collection, query, where, type Query } from 'firebase/firestore';
import type { DocumentData } from 'firebase/firestore';

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
=======

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
>>>>>>> 493f64cf071699c798704dd512006dc35618f02c
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!q) {
<<<<<<< HEAD
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
                if (docData[key] && docData[key].toDate) {
                    docData[key] = docData[key].toDate();
                }
            });
            return {
                id: doc.id,
                ...docData,
            } as T;
        });
        setData(documents);
        setLoading(false);
      },
      (err) => {
        console.error("Error fetching collection: ", err);
        setError(err);
=======
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
        const permissionError = new FirestorePermissionError({
          path: q.path,
          operation: 'list',
        });
        errorEmitter.emit('permission-error', permissionError);
        setError(permissionError);
>>>>>>> 493f64cf071699c798704dd512006dc35618f02c
        setLoading(false);
      }
    );

    return () => unsubscribe();
<<<<<<< HEAD
  }, [q]);

  return { data, loading, error };
}
=======
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(q)]);

  return { data, loading, error };
};
>>>>>>> 493f64cf071699c798704dd512006dc35618f02c
