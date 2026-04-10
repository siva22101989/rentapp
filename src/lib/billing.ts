
import { differenceInMonths, startOfDay } from 'date-fns';
import type { StorageRecord } from '@/lib/definitions';
import { toDate } from './utils';

// Default rates for backward compatibility
export const RATE_6_MONTHS = 36;
export const RATE_1_YEAR = 55;

export type RecordStatusInfo = {
  status: string;
  nextBillingDate: Date | null;
  currentRate: number;
  alert: string | null;
};

export function getRecordStatus(record: StorageRecord): RecordStatusInfo {
  const safeRecord = {
    ...record,
    storageStartDate: toDate(record.storageStartDate),
    storageEndDate: record.storageEndDate ? toDate(record.storageEndDate) : null
  };

  if (safeRecord.storageEndDate) {
    return {
      status: `Withdrawn`,
      nextBillingDate: null,
      currentRate: 0,
      alert: null,
    };
  }
  
  return {
    status: 'Active',
    nextBillingDate: null,
    currentRate: 0,
    alert: null,
  };
}


export function calculateFinalRent(
    record: StorageRecord, 
    withdrawalDate: Date, 
    bagsToWithdraw: number
): { 
    rent: number;
    monthsStored: number;
    rentPerBag: number;
    rentAlreadyPaidPerBag: number;
} {
  const startDate = startOfDay(toDate(record.storageStartDate));
  const endDate = startOfDay(withdrawalDate);
  
  const rentAlreadyPaidPerBag = 0; // Rent is never paid in advance.

  let rentPerBag = 0;
  
  if (endDate < startDate) {
    return { rent: 0, monthsStored: 0, rentPerBag: 0, rentAlreadyPaidPerBag: 0 };
  }

  // Calculate billing months, counting any partial month as one.
  const billingMonths = differenceInMonths(endDate, startDate) + 1;

  if (record.billingType === 'monthly') {
    const monthlyRate = record.monthlyRate || 0;
    rentPerBag = billingMonths * monthlyRate;
  } else {
    // Slab billing logic (default for old records)
    const slab6Months = record.rate6Months ?? RATE_6_MONTHS;
    const slab1Year = record.rate1Year ?? RATE_1_YEAR;

    if (billingMonths <= 6) {
      rentPerBag = slab6Months;
    } else if (billingMonths <= 12) {
      rentPerBag = slab1Year;
    } else {
      // More than 12 months
      const yearsStored = Math.floor(billingMonths / 12);
      const remainingMonths = billingMonths % 12;
      
      rentPerBag = yearsStored * slab1Year;

      if (remainingMonths > 0) {
          if (remainingMonths <= 6) {
              rentPerBag += slab6Months;
          } else { // 7 to 12 remaining months
              rentPerBag += slab1Year;
          }
      }
    }
  }
  
  const finalRentForWithdrawnBags = rentPerBag * bagsToWithdraw;

  return { 
      rent: Math.max(0, finalRentForWithdrawnBags),
      monthsStored: billingMonths, // Return the number of months used for billing
      rentPerBag,
      rentAlreadyPaidPerBag
  };
}
