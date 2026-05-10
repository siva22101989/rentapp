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
        // Try parsing manual format DD-MM-YYYY first
        const parsed = parseManualDate(date);
        if (parsed) return parsed;
        return new Date(date);
    }
    // Assumes it's a Firestore Timestamp
    if (typeof (date as Timestamp).toDate === 'function') {
      return (date as Timestamp).toDate();
    }
    return new Date();
}

/**
 * Formats a date specifically for manual text input display (DD-MM-YYYY)
 */
export function formatManualDate(date: Date | Timestamp | string | null | undefined): string {
    const d = toDate(date);
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
}

/**
 * Parses a manually entered string into a Date object.
 * Supports DD-MM-YYYY, DD/MM/YYYY, and DD.MM.YYYY
 */
export function parseManualDate(input: string): Date | null {
  if (!input) return null;
  
  const cleaned = input.trim().replace(/[\/\.]/g, '-');
  const parts = cleaned.split('-');
  
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // 0-indexed
    const yearPart = parseInt(parts[2], 10);
    const year = yearPart < 100 ? (yearPart < 50 ? 2000 + yearPart : 1900 + yearPart) : yearPart;
    
    const date = new Date(year, month, day);
    // Validate if it's a real date
    if (!isNaN(date.getTime()) && date.getDate() === day && date.getMonth() === month) {
      return date;
    }
  }
  
  const fallback = new Date(input);
  return isNaN(fallback.getTime()) ? null : fallback;
}

/**
 * Recursively cleans an object to be Firestore-compatible.
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
