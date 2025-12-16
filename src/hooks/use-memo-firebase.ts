
'use client';
import { useMemo } from 'react';

/**
 * Custom hook to memoize Firebase queries and references.
 * This prevents re-creating them on every render, which can cause
 * infinite loops in `useEffect` when used as a dependency.
 */
export const useMemoFirebase = <T>(
  factory: () => T,
  deps: React.DependencyList
) => {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(factory, deps);
};
