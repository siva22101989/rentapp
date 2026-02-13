
'use server';

import { z } from 'zod';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { detectStorageAnomalies as detectStorageAnomaliesFlow } from '@/ai/flows/anomaly-detection';
import type { StorageRecord, Payment, Customer } from './definitions';
import { expenseCategories } from './definitions';
import { Timestamp } from 'firebase/firestore';

export type FormState = {
  message: string;
  success: boolean;
};

export type AnomalyState = {
  anomalies: string | null;
  success: boolean;
};

export async function getAnomalyDetection(records: StorageRecord[]): Promise<AnomalyState> {
  if (!records || records.length === 0) {
    return { success: true, anomalies: 'No storage records found to analyze.' };
  }
  try {
    const plainRecords = JSON.parse(JSON.stringify(records));
    const result = await detectStorageAnomaliesFlow({ storageRecords: JSON.stringify(plainRecords) });
    return { success: true, anomalies: result.anomalies };
  } catch (error: any) {
    console.error("Anomaly detection failed:", error);
    let errorMessage = 'An error occurred while analyzing records.';
    if (error.message) {
      if (error.message.includes('API key not valid')) {
        errorMessage = 'Analysis failed: The Gemini API key is missing or invalid. Please add it to your .env file.';
      } else {
        errorMessage = `Analysis failed: ${error.message}`;
      }
    }
    return { success: false, anomalies: errorMessage };
  }
}


const InflowSchema = z.object({
    customerId: z.string().min(1, 'Customer is required.'),
    commodityDescription: z.string().min(2, 'Commodity description is required.'),
    location: z.string().optional(),
    storageStartDate: z.string().refine(val => !isNaN(Date.parse(val)), { message: "Invalid date format" }),
    bagsStored: z.coerce.number().int().nonnegative('Number of bags must be a non-negative number.'),
    hamaliRate: z.coerce.number().nonnegative('Hamali rate must be a non-negative number.').optional(),
    hamaliPaid: z.coerce.number().nonnegative('Hamali paid must be a non-negative number.').optional(),
    lorryTractorNo: z.string().optional(),
    weight: z.coerce.number().optional(),
    inflowType: z.enum(['Direct', 'Plot']).optional(),
    dryingRecordId: z.string().optional(),
    khataAmount: z.coerce.number().nonnegative('Khata amount must be a non-negative number.').optional(),
}).superRefine((data, ctx) => {
    if (data.inflowType === 'Direct') {
        if (data.weight === undefined || data.weight === null) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Weight is required for Direct inflow.',
                path: ['weight'],
            });
        }
    }
});

export type InflowFormState = {
    message: string;
    success: boolean;
    recordId?: string;
};

export async function addInflow(prevState: InflowFormState, formData: FormData) {
    const validatedFields = InflowSchema.safeParse(Object.fromEntries(formData.entries()));

     if (!validatedFields.success) {
        return { message: 'Invalid form data. Please check all fields.', success: false };
     }

    revalidatePath('/storage');
    // The client side will handle the redirect to the receipt page with the correct ID.
    // This server action is now mostly a placeholder.
    // A successful response from here will trigger the client to navigate.
    return { 
        message: 'Record created successfully. Redirecting to receipt...', 
        success: true,
        recordId: formData.get('recordId') as string
    };
}

const PaymentSchema = z.object({
  recordId: z.string(),
  paymentAmount: z.coerce.number().positive('Payment amount must be a positive number.'),
  paymentDate: z.string().refine(val => !isNaN(Date.parse(val)), { message: "Invalid date format" }),
  paymentType: z.enum(['Rent/Other', 'Hamali']),
});

export type PaymentFormState = {
    message: string;
    success: boolean;
};

export async function addPayment(prevState: PaymentFormState, formData: FormData) {
    revalidatePath('/payments/pending');
    revalidatePath('/reports');
    return { message: 'Transaction will be recorded client-side.', success: true };
}


const ExpenseSchema = z.object({
  description: z.string().min(2, 'Description is required.'),
  amount: z.coerce.number().positive('Amount must be a positive number.'),
  date: z.string().refine(val => !isNaN(Date.parse(val)), { message: "Invalid date format" }),
  category: z.enum(expenseCategories, { required_error: 'Category is required.' }),
});

export async function addExpense(prevState: FormState, formData: FormData) {
    revalidatePath('/expenses');
    return { message: 'Expense will be added client-side.', success: true };
}

export async function deleteStorageRecordAction(recordId: string): Promise<FormState> {
  // This is now a placeholder. The client will handle the delete.
  revalidatePath('/storage');
  revalidatePath('/reports');
  return { message: 'Record will be deleted on the client.', success: true };
}
