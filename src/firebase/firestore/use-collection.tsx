
'use client';
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
  const [error, setError] = useState<Error | null>(null);

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
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [q]);

  return { data, loading, error };
}
