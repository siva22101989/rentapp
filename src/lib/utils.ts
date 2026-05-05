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

export function toDate(date: any): Date {
    if (!date) return new Date();
    
    // Firestore Timestamp
    if (date instanceof Timestamp) return date.toDate();
    if (typeof date.toDate === 'function') return date.toDate();
    
    // JS Date
    if (date instanceof Date) return date;
    
    // String
    if (typeof date === 'string') {
        const parsed = new Date(date);
        return isNaN(parsed.getTime()) ? new Date() : parsed;
    }

    // Object with seconds/nanoseconds (raw Firestore format often seen in JSON)
    if (typeof date === 'object' && 'seconds' in date) {
        return new Date(date.seconds * 1000 + (date.nanoseconds || 0) / 1000000);
    }
    
    return new Date();
}

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

  if (data instanceof Timestamp || (data.toDate && typeof data.toDate === 'function')) {
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