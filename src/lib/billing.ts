import { differenceInMonths, startOfDay } from 'date-fns';
import type { StorageRecord } from '@/lib/definitions';
import { toDate } from './utils';

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


/**
 * Calculates the rent for a given number of bags for a storage record.
 * Handles both Monthly and Slab (stacked) billing types.
 */
export function calculateFinalRent(
    record: StorageRecord, 
    calculationDate: Date, 
    bagsToCalculate: number
): { 
    rent: number;
    monthsStored: number;
    rentPerBag: number;
} {
  const startDate = startOfDay(toDate(record.storageStartDate));
  const endDate = startOfDay(calculationDate);
  
  if (endDate < startDate) {
    return { rent: 0, monthsStored: 0, rentPerBag: 0 };
  }

  // Calculate billing months: partial months count as one full month.
  // Standard logic: (Total months passed) + 1 for the current month.
  const billingMonths = differenceInMonths(endDate, startDate) + 1;

  let rentPerBag = 0;

  // 1. Monthly Billing Logic
  if (record.billingType === 'monthly') {
    const monthlyRate = record.monthlyRate || 0;
    const minMonths = record.minBillingMonths || 0;
    const effectiveMonths = Math.max(billingMonths, minMonths);
    
    rentPerBag = effectiveMonths * monthlyRate;
    
    // Add annual insurance if applicable
    if (record.insuranceRate && record.insuranceRate > 0) {
        // Insurance is charged per year, rounding up
        const yearsStored = Math.ceil(billingMonths / 12);
        rentPerBag += (record.insuranceRate * yearsStored);
    }
  } 
  // 2. Slab (Stacked) Billing Logic
  else {
    const slab6Months = record.rate6Months ?? 0;
    const slab1Year = record.rate1Year ?? 0;
    
    if (billingMonths <= 0) {
        rentPerBag = 0;
    } else {
        const fullYears = Math.floor((billingMonths - 1) / 12);
        const remainingMonthsInCycle = billingMonths - (fullYears * 12);

        // Calculate base rent for full years
        rentPerBag = fullYears * slab1Year;
        
        // Add the current year's slab
        if (remainingMonthsInCycle > 0 && remainingMonthsInCycle <= 6) {
            rentPerBag += slab6Months;
        } else if (remainingMonthsInCycle > 6) {
            rentPerBag += slab1Year;
        }
    }
  }
  
  const totalRent = rentPerBag * bagsToCalculate;

  return { 
      rent: Math.max(0, totalRent),
      monthsStored: billingMonths,
      rentPerBag
  };
}
