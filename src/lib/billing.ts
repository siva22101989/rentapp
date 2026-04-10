
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
    // Slab billing logic with stacking as per user's requirement
    const slab6Months = record.rate6Months ?? 0;
    const slab1Year = record.rate1Year ?? 0;
    
    if (billingMonths <= 0) {
        rentPerBag = 0;
    } else {
        const years = Math.floor((billingMonths - 1) / 12);
        const remainingMonths = billingMonths - (years * 12);

        rentPerBag = years * slab1Year;
        
        if (remainingMonths > 0 && remainingMonths <= 6) {
            rentPerBag += slab6Months;
        } else if (remainingMonths > 6) {
            rentPerBag += slab1Year;
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
