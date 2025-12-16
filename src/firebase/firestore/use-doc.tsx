
'use client';
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
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [ref]);

  return { data, loading, error };
}
