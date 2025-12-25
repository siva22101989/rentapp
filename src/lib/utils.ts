
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { Timestamp } from "firebase/firestore";

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
