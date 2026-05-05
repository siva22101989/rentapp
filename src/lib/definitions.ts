
import type { Timestamp } from 'firebase/firestore';

export type Customer = {
  id: string;
  name: string;
  phone: string;
  address?: string;
  fatherName?: string;
  village?: string;
  warehouseId?: string;
};

export type Commodity = {
  id: string;
  name: string;
  billingType: 'monthly' | 'slab';
  monthlyRate?: number;
  minBillingMonths?: number;
  insuranceRate?: number;
  rate6Months?: number;
  rate1Year?: number;
  warehouseId?: string;
};

export type Lot = {
  id: string;
  name: string;
  capacity?: number;
  warehouseId?: string;
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
  warehouseId?: string;
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
  hamaliRate?: number;
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
  minBillingMonths?: number;
  insuranceRate?: number;
  rate6Months?: number;
  rate1Year?: number;
};

export const expenseCategories = ["Worker Salary", "Petrol", "Maintenance", "Utilities", "Current Bill", "Hamali Paid", "EMI for Godown", "Godown Expense", "Loan Repayment", "Home Expenses", "Other"] as const;

export type ExpenseCategory = typeof expenseCategories[number];

export type Expense = {
  id: string;
  warehouseId?: string;
  description: string;
  amount: number;
  category: ExpenseCategory;
  date: Date | Timestamp;
  customerId?: string;
};

export type Borrowing = {
  id: string;
  warehouseId?: string;
  lenderName: string;
  principal: number;
  interestRate: number;
  dateTaken: Date | Timestamp;
  payments?: Payment[];
  status?: 'Active' | 'Paid Off';
};

export type Lending = {
  id: string;
  warehouseId?: string;
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
    warehouseId?: string;
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
  textbeeApiKey?: string;
  textbeeDeviceId?: string;
  smsInflowTemplate?: string;
  smsOutflowTemplate?: string;
  smsUnloadingTemplate?: string;
  smsPaymentTemplate?: string;
  smsPendingDuesTemplate?: string;
};

export const unloadingStatus = ["Unloading", "Drying", "Packing", "Billed"] as const;
export type UnloadingStatus = typeof unloadingStatus[number];

export type UnloadingRecord = {
  id: string;
  warehouseId?: string;
  customerId: string;
  commodityDescription: string;
  lorryTractorNo?: string;
  location?: string;
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

export type DryingRecord = {
  id: string;
  warehouseId?: string;
  unloadingRecordId: string;
  customerId: string;
  commodityDescription: string;
  bagsForDrying: number;
  bagsPacked?: number;
  status: DryingStatus;
  dryingStartDate: Date | Timestamp;
  packingDate?: Date | Timestamp | null;
  billingDate?: Date | Timestamp | null;
  totalDryingHamali: number;
  hamaliDetails?: HamaliChargeItem[];
  workerHamaliPayable?: number;
};

export const userRoles = ["super-admin", "owner", "supervisor", "biller"] as const;
export type UserRole = (typeof userRoles)[number];

export type AppUser = {
  id: string;
  email?: string;
  phone: string;
  role: UserRole;
  warehouseId?: string;
};

export type ManagedWarehouse = {
  id: string;
  name: string;
  ownerName: string;
  ownerEmail: string;
  yearlyAmount: number;
  subscriptionStatus: 'active' | 'trial' | 'expired' | 'suspended';
  createdAt: Date | Timestamp;
  trialMonths?: number;
};
