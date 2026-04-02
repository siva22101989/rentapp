
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
  billingType: 'monthly' | 'slab';
  monthlyRate?: number;
  rate6Months?: number;
  rate1Year?: number;
};

export type Lot = {
  id: string;
  name: string;
  capacity?: number;
};

export type Payment = {
  amount: number;
  date: Date | Timestamp;
  type?: 'rent' | 'hamali' | 'other' | 'unloading' | 'discount' | 'repayment' | 'interest' | 'principal';
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
  billingType?: 'monthly' | 'slab';
  monthlyRate?: number;
  rate6Months?: number;
  rate1Year?: number;
};

export const expenseCategories = ["Worker Salary", "Petrol", "Maintenance", "Utilities", "Current Bill", "Hamali", "EMI for Godown", "Loan Repayment", "Other"] as const;

export type ExpenseCategory = typeof expenseCategories[number];

export type Expense = {
  id: string;
  description: string;
  amount: number;
  category: ExpenseCategory;
  date: Date | Timestamp;
};

export type Borrowing = {
  id: string;
  lenderName: string;
  principal: number;
  interestRate: number;
  dateTaken: Date | Timestamp;
  payments?: Payment[];
  status?: 'Active' | 'Paid Off';
};

export type Lending = {
  id: string;
  borrowerName: string;
  principal: number;
  interestRate: number;
  dateGiven: Date | Timestamp;
  payments?: Payment[];
  status?: 'Active' | 'Paid Off';
};

export const incomeCategories = ["Loan Payment Received", "Other"] as const;
export type IncomeCategory = typeof incomeCategories[number];

export type OtherIncome = {
    id: string;
    description: string;
    amount: number;
    category: IncomeCategory;
    date: Date | Timestamp;
}

export type WarehouseInfo = {
  id: string;
  name: string;
  ownerName?: string;
  phone?: string;
  email?: string;
  addressLine1?: string;
  addressLine2?: string;
  bankDetails?: string;
  capitalInvestment?: number;
  annualInterestRate?: number;
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
  bagsSentToDrying: number;
  hamaliPerBag: number;
  totalHamali: number;
  workerHamaliPayable?: number;
  billNo?: string;
  payments?: Payment[];
};

export const dryingStatus = ["Drying", "Packing", "Billed"] as const;
export type DryingStatus = typeof dryingStatus[number];

export type HamaliCharge = {
  description: string;
  amount: number;
  date: Date | Timestamp;
};

export type DryingRecord = {
  id: string;
  unloadingRecordId: string;
  customerId: string;
  commodityDescription: string;
  bagsForDrying: number;
  bagsPacked?: number;
  status: DryingStatus;
  dryingStartDate: Date | Timestamp;
  packingDate?: Date | Timestamp | null;
  billingDate?: Date | Timestamp | null;
  hamaliPerBag: number;
  totalDryingHamali: number;
  hamaliCharges?: HamaliCharge[];
  totalDryingWorkerHamali?: number;
};

export type SmsInfo = {
  id: string;
  twilioAccountSid: string;
  twilioAuthToken: string;
  twilioPhoneNumber: string;
};

export const userRoles = ["owner", "supervisor", "biller"] as const;
export type UserRole = (typeof userRoles)[number];

export type AppUser = {
  id: string;
  email: string;
  role: UserRole;
};
