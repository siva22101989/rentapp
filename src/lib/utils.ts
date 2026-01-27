
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { Timestamp } from "firebase/firestore";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
  }).format(amount);
}

export function toDate(date: Date | Timestamp | string | null | undefined): Date {
    if (!date) {
        return new Date();
    }
    if (date instanceof Date) {
        return date;
    }
    if (typeof date === 'string') {
        return new Date(date);
    }
    // Assumes it's a Firestore Timestamp
    if (typeof (date as Timestamp).toDate === 'function') {
      return (date as Timestamp).toDate();
    }
    return new Date();
}

/**
 * Recursively cleans an object to be Firestore-compatible.
 * - Removes properties with `undefined` values.
 * - Converts `Date` objects to Firestore `Timestamp` objects.
 * This function should be used on any data object before it's sent to Firestore.
 */
export function cleanForFirestore(data: any): any {
  if (data === null || data === undefined) {
    return null;
  }

  if (Array.isArray(data)) {
    return data.map(item => cleanForFirestore(item));
  }

  if (data instanceof Date) {
    return Timestamp.fromDate(data);
  }

  if (data.toDate && typeof data.toDate === 'function') {
    // It's already a Firestore Timestamp, return as is.
    return data;
  }

  if (typeof data === 'object') {
    const cleanedData: { [key: string]: any } = {};
    for (const key of Object.keys(data)) {
      const value = data[key];
      if (value !== undefined) {
        cleanedData[key] = cleanForFirestore(value);
      }
    }
    return cleanedData;
  }

  return data;
}
