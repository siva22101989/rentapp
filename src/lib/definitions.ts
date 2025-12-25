
import type { Timestamp } from 'firebase/firestore';

export type Customer = {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  fatherName: string;
  village: string;
};

export type Commodity = {
  id: string;
  description: string;
};

export type Payment = {
  amount: number;
  date: Date | Timestamp;
  type?: 'rent' | 'hamali' | 'other';
};

export type StorageRecord = {
  id: string;
  customerId: string;
  commodityDescription: string;
  location: string;
  bagsIn: number;
  bagsOut: number;
  bagsStored: number;
  storageStartDate: Date | Timestamp;
  storageEndDate: Date | Timestamp | null;
  billingCycle: '6-Month Initial' | '1-Year Rollover' | '1-Year Renewal' | 'Completed';
  payments: Payment[];
  hamaliPayable: number;
  totalRentBilled: number;
  lorryTractorNo: string;
  weight: number;
  inflowType?: 'Direct' | 'Plot';
  dryingRecordId?: string;
  khataAmount?: number;
};

export const expenseCategories = ["Worker Salary", "Petrol", "Maintenance", "Utilities", "Hamali", "Other"] as const;

export type ExpenseCategory = typeof expenseCategories[number];

export type Expense = {
  id: string;
  description: string;
  amount: number;
  category: ExpenseCategory;
  date: Date | Timestamp;
};

export const unloadingStatus = ["Unloading", "Drying", "Packing", "Billed"] as const;
export type UnloadingStatus = typeof unloadingStatus[number];

export type UnloadingRecord = {
  id: string;
  customerId: string;
  commodityDescription: string;
  lorryTractorNo?: string;
  unloadingDate: Date | Timestamp;
  bagsUnloaded: number;
  status: UnloadingStatus;
  hamaliPerBag: number;
  totalHamali: number;
  billNo?: string;
};

export const dryingStatus = ["Drying", "Packing", "Billed"] as const;
export type DryingStatus = typeof dryingStatus[number];

export type DryingRecord = {
    id: string;
    unloadingRecordId: string;
    customerId: string;
    commodityDescription: string;
    bagsForDrying: number;
    bagsPacked?: number;
    status: DryingStatus;
    dryingStartDate: Date | Timestamp;
    packingDate: Date | Timestamp | null;
    billingDate: Date | Timestamp | null;
    hamaliPerBag: number;
    totalDryingHamali: number;
};
