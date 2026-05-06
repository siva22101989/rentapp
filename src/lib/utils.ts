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

/**
 * Robustly converts any date-like input into a standard JS Date.
 * Handles Firestore Timestamps, strings, and raw objects with seconds/nanos.
 */
export function toDate(date: any): Date {
    if (!date) return new Date();
    
    // Handle Firestore Timestamp
    if (date instanceof Timestamp) return date.toDate();
    if (typeof date.toDate === 'function') return date.toDate();
    
    // Handle JS Date
    if (date instanceof Date) return date;
    
    // Handle String (ISO or standard)
    if (typeof date === 'string') {
        const parsed = new Date(date);
        return isNaN(parsed.getTime()) ? new Date() : parsed;
    }

    // Handle JSON object with seconds/nanoseconds (common in backups)
    if (typeof date === 'object' && 'seconds' in date) {
        return new Date(date.seconds * 1000 + (date.nanoseconds || 0) / 1000000);
    }
    
    return new Date();
}

/**
 * Recursively cleans objects for Firestore by converting Dates to Timestamps
 * and stripping undefined fields.
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

  if (data instanceof Timestamp) {
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
