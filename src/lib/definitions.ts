
import type { Timestamp } from 'firebase/firestore';

export type Customer = {
  id: string;
  name: string;
  email?: string;
  phone: string;
  address?: string;
  fatherName?: string;
  village?: string;
};

export type Commodity = {
  id: string;
  name: string;
  rate6Months: number;
  rate1Year: number;
};

export type Lot = {
  id: string;
  name: string;
  capacity?: number;
};

export type Payment = {
  amount: number;
  date: Date | Timestamp;
  type?: 'rent' | 'hamali' | 'other' | 'unloading';
};

export type Outflow = {
  date: Date | Timestamp;
  bagsWithdrawn: number;
  rentBilled: number;
  discount?: number;
};

export type HamaliChargeItem = {
  description: string;
  bags: number;
  rate: number;
  amount: number;
};

export type StorageRecord = {
  id: string;
  customerId: string;
  commodityDescription: string;
  location?: string;
  bagsIn: number;
  bagsOut: number;
  bagsStored: number;
  bagsForDrying?: number;
  storageStartDate: Date | Timestamp;
  storageEndDate: Date | Timestamp | null;
  billingCycle: '6-Month Initial' | '1-Year Rollover' | '1-Year Renewal' | 'Completed';
  payments: Payment[];
  hamaliPayable: number;
  workerHamaliPayable?: number;
  totalRentBilled: number;
  lorryTractorNo?: string;
  weight: number;
  inflowType?: 'Direct' | 'Plot';
  khataAmount?: number;
  outflows?: Outflow[];
  dryingRecordId?: string;
  dryingStartDate?: Date | Timestamp | null;
  dryingEndDate?: Date | Timestamp | null;
  hamaliDetails?: HamaliChargeItem[];
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

export type UnloadingRecord = {
  id: string;
  customerId: string;
  commodityDescription: string;
  lorryTractorNo?: string;
  unloadingDate: Date | Timestamp;
  bagsUnloaded: number;
  bagsSentToDrying: number;
  hamaliPerBag: number;
  totalHamali: number;
  workerHamaliPayable?: number;
  billNo?: string;
  payments?: Payment[];
};
