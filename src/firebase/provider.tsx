
'use client';
import {
  createContext,
  useContext,
  type ReactNode,
  useState,
  useEffect,
  useMemo,
} from 'react';
import type { DateRange } from 'react-day-picker';

import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
// Import a common function like `collection` to hint the bundler against tree-shaking.
import { getFirestore, collection, type Firestore } from 'firebase/firestore';
import { firebaseConfig } from './config';

export type FirebaseContextValue = {
  auth: Auth;
  firestore: Firestore;
  firebaseApp: FirebaseApp;
};

const FirebaseContext = createContext<FirebaseContextValue | null>(null);

export function FirebaseProvider({ children }: { children: ReactNode }) {
  const [value, setValue] = useState<FirebaseContextValue | null>(null);

  useEffect(() => {
    const app =
      getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const firestore = getFirestore(app);

    setValue({ firebaseApp: app, auth, firestore });
  }, []); // Empty dependency array ensures this runs only once on the client.

  if (!value) {
    // Return null or a loading component while Firebase is initializing.
    return null;
  }

  return (
    <FirebaseContext.Provider value={value}>
      {children}
    </FirebaseContext.Provider>
  );
}

export function useFirebase() {
  const context = useContext(FirebaseContext);
  if (!context) {
    throw new Error('useFirebase must be used within a FirebaseProvider');
  }
  return context;
}

export function useAuth() {
  return useFirebase().auth;
}

export function useFirestore() {
  return useFirebase().firestore;
}

export function useFirebaseApp() {
  return useFirebase().firebaseApp;
}


// --- START OF DATE FILTER CONTEXT ---

interface DateFilterContextType {
  dateRange: DateRange | undefined;
  setDateRange: (dateRange: DateRange | undefined) => void;
  financialYear: string;
  setFinancialYear: (fy: string) => void;
  handleFinancialYearChange: (fy: string) => void;
  financialYears: string[];
  resetFilters: () => void;
}

const DateFilterContext = createContext<DateFilterContextType | undefined>(undefined);

export function DateFilterProvider({ children }: { children: ReactNode }) {
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [financialYear, setFinancialYear] = useState<string>('');

  const financialYears = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth(); // 0-indexed: Jan is 0, Nov is 10
    const startYear = currentMonth >= 10 ? currentYear : currentYear - 1; // Nov-Oct cycle
    const years = [];
    for (let i = 0; i < 10; i++) {
      const year = startYear - i;
      years.push(`${year}-${(year + 1).toString().slice(2)}`);
    }
    return years;
  }, []);

  const handleFinancialYearChange = (fy: string) => {
    setFinancialYear(fy);
    if (fy === 'all-time') {
      setDateRange(undefined);
      return;
    }
    const startYear = parseInt(fy.substring(0, 4), 10);
    const fromDate = new Date(startYear, 10, 1); // November 1st
    const toDate = new Date(startYear + 1, 9, 31); // October 31st
    setDateRange({ from: fromDate, to: toDate });
  };
  
  const resetFilters = () => {
    setDateRange(undefined);
    setFinancialYear('');
  };

  const onSetDateRange = (newRange: DateRange | undefined) => {
    setDateRange(newRange);
    if (newRange) {
        setFinancialYear(''); // Clear FY if custom range is set
    }
  };

  const value = {
    dateRange,
    setDateRange: onSetDateRange,
    financialYear,
    setFinancialYear,
    handleFinancialYearChange,
    financialYears,
    resetFilters
  };

  return (
    <DateFilterContext.Provider value={value}>
      {children}
    </DateFilterContext.Provider>
  );
}

export function useDateFilter() {
  const context = useContext(DateFilterContext);
  if (context === undefined) {
    throw new Error('useDateFilter must be used within a DateFilterProvider');
  }
  return context;
}
