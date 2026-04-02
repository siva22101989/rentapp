
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
  const monthsStored = differenceInMonths(endDate, startDate);

  if (monthsStored < 0) {
    rentPerBag = 0;
  } else if (record.billingType === 'monthly') {
    const monthlyRate = record.monthlyRate || 0;
    // Charge for at least one month, even if stored for a shorter period
    const effectiveMonths = Math.max(1, monthsStored + 1);
    rentPerBag = effectiveMonths * monthlyRate;
  } else {
    // Slab billing logic (default for old records)
    const slab6Months = record.rate6Months ?? RATE_6_MONTHS;
    const slab1Year = record.rate1Year ?? RATE_1_YEAR;

    if (monthsStored < 6) {
      rentPerBag = slab6Months;
    } else if (monthsStored < 12) {
      rentPerBag = slab1Year;
    } else {
      const yearsStored = Math.floor(monthsStored / 12);
      const remainingMonths = monthsStored % 12;
      
      rentPerBag = yearsStored * slab1Year;

      if (remainingMonths > 0) {
          if (remainingMonths <= 6) {
              rentPerBag += slab6Months;
          } else {
              rentPerBag += slab1Year;
          }
      }
    }
  }
  
  const finalRentForWithdrawnBags = rentPerBag * bagsToWithdraw;

  return { 
      rent: Math.max(0, finalRentForWithdrawnBags),
      monthsStored,
      rentPerBag,
      rentAlreadyPaidPerBag
  };
}
