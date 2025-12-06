
'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  onSnapshot,
  collection,
  query,
  where,
  orderBy,
  limit,
  startAt,
  endAt,
  type Firestore,
  type CollectionReference,
  type Query,
} from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { toDate } from '@/lib/utils';

export interface UseCollectionOptions {
  where?: [string, '==', any];
  orderBy?: [string, 'asc' | 'desc'];
  limit?: number;
  startAt?: any[];
  endAt?: any[];
}

const useMemoFirebase = <T>(factory: () => T | null, deps: React.DependencyList): T | null => {
    return useMemo(factory, deps);
};

export const useCollection = <T>(
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
          Object.keys(docData).forEach(key => {
            if (docData[key]?.toDate) {
              docData[key] = toDate(docData[key]);
            }
          });
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
  }, [q]);

  return { data, loading, error };
};
