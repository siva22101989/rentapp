
'use client';
<<<<<<< HEAD
import { useState, useEffect } from 'react';
import { onSnapshot, type DocumentReference } from 'firebase/firestore';
import type { DocumentData } from 'firebase/firestore';

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
=======

import { useState, useEffect } from 'react';
import { onSnapshot, type DocumentReference } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { toDate } from '@/lib/utils';

export const useDoc = <T extends { id: string }>(ref: DocumentReference | null) => {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
>>>>>>> 493f64cf071699c798704dd512006dc35618f02c
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!ref) {
<<<<<<< HEAD
      setData(null);
      setLoading(false);
      return;
    }
=======
        setData(null);
        setLoading(false);
        return;
    }
    
>>>>>>> 493f64cf071699c798704dd512006dc35618f02c
    setLoading(true);

    const unsubscribe = onSnapshot(
      ref,
      (doc) => {
        if (doc.exists()) {
<<<<<<< HEAD
            const docData = doc.data();
            // Convert Timestamps to Dates
            Object.keys(docData).forEach(key => {
                if (docData[key] && docData[key].toDate) {
                    docData[key] = docData[key].toDate();
                }
            });
            setData({ id: doc.id, ...docData } as T);
        } else {
            setData(null);
        }
        setLoading(false);
      },
      (err) => {
        console.error("Error fetching document: ", err);
        setError(err);
=======
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
        const permissionError = new FirestorePermissionError({
          path: ref.path,
          operation: 'get',
        });
        errorEmitter.emit('permission-error', permissionError);
        setError(permissionError);
>>>>>>> 493f64cf071699c798704dd512006dc35618f02c
        setLoading(false);
      }
    );

    return () => unsubscribe();
<<<<<<< HEAD
  }, [ref]);

  return { data, loading, error };
}
=======
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(ref?.path)]);

  return { data, loading, error };
};
>>>>>>> 493f64cf071699c798704dd512006dc35618f02c
