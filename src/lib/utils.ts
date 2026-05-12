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
 * Robust date converter that handles Dates, Timestamps, Strings, and Excel Serial Numbers.
 */
export function toDate(date: Date | Timestamp | string | number | null | undefined): Date {
    if (date === null || date === undefined) {
        return new Date();
    }
    
    // Handle Date object
    if (date instanceof Date) {
        return date;
    }
    
    // Handle Firestore Timestamp
    if (typeof (date as any).toDate === 'function') {
      return (date as Timestamp).toDate();
    }

    // Handle string (Manual format or ISO)
    if (typeof date === 'string') {
        const cleaned = date.trim();
        if (!cleaned) return new Date();
        const parsed = parseManualDate(cleaned);
        if (parsed) return parsed;
        const d = new Date(cleaned);
        return isNaN(d.getTime()) ? new Date() : d;
    }

    // Handle numeric (Excel serial date)
    if (typeof date === 'number') {
        // Excel base date is Dec 30, 1899 (for positive dates after 1900)
        // This is a simple conversion for standard godown dates
        const excelEpoch = new Date(1899, 11, 30);
        const d = new Date(excelEpoch.getTime() + date * 24 * 60 * 60 * 1000);
        return isNaN(d.getTime()) ? new Date() : d;
    }

    return new Date();
}

export function formatManualDate(date: Date | Timestamp | string | number | null | undefined): string {
    const d = toDate(date);
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
}

export function parseManualDate(input: string): Date | null {
  if (!input || typeof input !== 'string') return null;
  
  const cleaned = input.trim().replace(/[\/\.]/g, '-');
  const parts = cleaned.split('-');
  
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const yearPart = parseInt(parts[2], 10);
    const year = yearPart < 100 ? (yearPart < 50 ? 2000 + yearPart : 1900 + yearPart) : yearPart;
    
    const date = new Date(year, month, day);
    if (!isNaN(date.getTime()) && date.getDate() === day && date.getMonth() === month) {
      return date;
    }
  }
  
  const fallback = new Date(input);
  return isNaN(fallback.getTime()) ? null : fallback;
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
