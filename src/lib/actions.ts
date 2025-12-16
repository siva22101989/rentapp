'use server';

import { z } from 'zod';
import { 
    getStorageRecord, 
    getStorageRecords,
    getCustomer,
} from '@/lib/data';
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

export async function getAnomalyDetection() {
  try {
    const records = await getStorageRecords();
    const result = await detectStorageAnomaliesFlow({ storageRecords: JSON.stringify(records) });
    return { success: true, anomalies: result.anomalies };
  } catch (error) {
    return { success: false, anomalies: 'An error occurred while analyzing records.' };
  }
}


const InflowSchema = z.object({
    customerId: z.string().min(1, 'Customer is required.'),
    commodityDescription: z.string().min(2, 'Commodity description is required.'),
    location: z.string(),
    storageStartDate: z.string().refine(val => !isNaN(Date.parse(val)), { message: "Invalid date format" }),
    bagsStored: z.coerce.number().int().nonnegative('Number of bags must be a non-negative number.').optional(),
    hamaliRate: z.coerce.number().nonnegative('Hamali rate must be a non-negative number.').optional(),
    hamaliPaid: z.coerce.number().nonnegative('Hamali paid must be a non-negative number.').optional(),
    lorryTractorNo: z.string().optional(),
    weight: z.coerce.number().nonnegative('Weight must be a non-negative number.').optional(),
    // For updating customer details from inflow form
    fatherName: z.string().optional(),
    village: z.string().optional(),
    inflowType: z.enum(['Direct', 'Plot']).optional(),
    plotBags: z.coerce.number().nonnegative('Plot bags must be a non-negative number.').optional(),
    loadBags: z.coerce.number().optional(),
    khataAmount: z.coerce.number().nonnegative('Khata amount must be a non-negative number.').optional(),
});

export type InflowFormState = {
    message: string;
    success: boolean;
};

// This action remains a server action as it performs multiple operations and redirects
export async function addInflow(prevState: InflowFormState, formData: FormData) {
    // Lazy load server-only data functions to avoid client-bundle issues
    const { updateCustomer, saveStorageRecord, getStorageRecords: serverGetStorageRecords } = await import('@/lib/data.server');

    const validatedFields = InflowSchema.safeParse({
        customerId: formData.get('customerId'),
        commodityDescription: formData.get('commodityDescription'),
        location: formData.get('location'),
        storageStartDate: formData.get('storageStartDate'),
        bagsStored: formData.get('bagsStored'),
        hamaliRate: formData.get('hamaliRate'),
        hamaliPaid: formData.get('hamaliPaid'),
        lorryTractorNo: formData.get('lorryTractorNo'),
        weight: formData.get('weight'),
        fatherName: formData.get('fatherName'),
        village: formData.get('village'),
        inflowType: formData.get('inflowType'),
        plotBags: formData.get('plotBags'),
        loadBags: formData.get('loadBags'),
        khataAmount: formData.get('khataAmount'),
    });

    if (!validatedFields.success) {
        const error = validatedFields.error.flatten().fieldErrors;
        const message = Object.values(error).flat().join(', ');
        return { message: `Invalid data: ${message}`, success: false };
    }

    let { bagsStored, hamaliRate, hamaliPaid, storageStartDate, fatherName, village, plotBags, loadBags, inflowType, ...rest } = validatedFields.data;

    if (fatherName || village) {
        const customer = await getCustomer(rest.customerId);
        if (customer) {
            const customerUpdate: Partial<typeof customer> = {};
            if (fatherName && customer.fatherName !== fatherName) customerUpdate.fatherName = fatherName;
            if (village && customer.village !== village) customerUpdate.village = village;
            if (Object.keys(customerUpdate).length > 0) {
                await updateCustomer(rest.customerId, customerUpdate);
            }
        }
    }

    let inflowBags = 0;
    if (inflowType === 'Plot') {
        if (!plotBags || plotBags <= 0) {
            return { message: "Plot Bags must be a positive number for 'Plot' inflow.", success: false };
        }
        inflowBags = plotBags;
    } else { // 'Direct'
        if (!bagsStored || bagsStored <= 0) {
            return { message: "Number of Bags must be a positive number for 'Direct' inflow.", success: false };
        }
        inflowBags = bagsStored;
    }

    const hamaliPayable = inflowBags * (hamaliRate || 0);
    const payments: Payment[] = [];
    if (hamaliPaid && hamaliPaid > 0) {
        payments.push({ amount: hamaliPaid, date: Timestamp.fromDate(new Date(storageStartDate)), type: 'hamali' });
    }
    
    const allRecords = await serverGetStorageRecords();
    const maxId = allRecords.reduce((max, record) => {
        const idNum = parseInt(record.id.replace('SLWH-', ''), 10);
        return isNaN(idNum) ? max : Math.max(max, idNum);
    }, 0);
    const newRecordId = `SLWH-${maxId + 1}`;


    const newRecord: Omit<StorageRecord, 'id'> = {
        ...rest,
        id: newRecordId,
        bagsIn: inflowBags,
        bagsOut: 0,
        bagsStored: inflowBags,
        storageStartDate: Timestamp.fromDate(new Date(storageStartDate)),
        storageEndDate: null,
        billingCycle: '6-Month Initial',
        payments: payments,
        hamaliPayable: hamaliPayable,
        totalRentBilled: 0,
        lorryTractorNo: rest.lorryTractorNo ?? '',
        weight: rest.weight ?? 0,
        inflowType: inflowType ?? 'Direct',
        plotBags: plotBags ?? undefined,
        loadBags: loadBags ?? undefined,
        location: rest.location ?? '',
        khataAmount: rest.khataAmount ?? 0,
    };
    
    const createdRecordId = await saveStorageRecord(newRecord);


    revalidatePath('/storage');
    redirect(`/inflow/receipt/${createdRecordId}`);
}

const OutflowSchema = z.object({
    recordId: z.string().min(1, 'A storage record must be selected.'),
    bagsToWithdraw: z.coerce.number().int().positive('Bags to withdraw must be a positive number.'),
    withdrawalDate: z.string().refine(val => !isNaN(Date.parse(val)), { message: "Invalid date format" }),
    finalRent: z.coerce.number().nonnegative('Final rent cannot be negative.'),
    amountPaidNow: z.coerce.number().nonnegative('Amount paid must be non-negative.').optional(),
});

export type OutflowFormState = {
    message: string;
    success: boolean;
};

export async function addOutflow(prevState: OutflowFormState, formData: FormData) {
    const { updateStorageRecord } = await import('@/lib/data.server');
    
    const validatedFields = OutflowSchema.safeParse({
        recordId: formData.get('recordId'),
        bagsToWithdraw: formData.get('bagsToWithdraw'),
        withdrawalDate: formData.get('withdrawalDate'),
        finalRent: formData.get('finalRent'),
        amountPaidNow: formData.get('amountPaidNow'),
    });

    if (!validatedFields.success) {
        const error = validatedFields.error.flatten().fieldErrors;
        const message = Object.values(error).flat().join(', ');
        return { message: `Invalid data: ${message}`, success: false };
    }
    
    const { recordId, bagsToWithdraw, withdrawalDate, finalRent, amountPaidNow } = validatedFields.data;
    
    const originalRecord = await getStorageRecord(recordId);

    if (!originalRecord) {
        return { message: 'Record not found.', success: false };
    }

    if (bagsToWithdraw > originalRecord.bagsStored) {
        return { message: 'Cannot withdraw more bags than are in storage.', success: false };
    }

    const isFullWithdrawal = bagsToWithdraw === originalRecord.bagsStored;
    const paymentMade = amountPaidNow || 0;
    
    const recordUpdate: Partial<StorageRecord> = {
        payments: originalRecord.payments || [],
        bagsStored: originalRecord.bagsStored - bagsToWithdraw,
        bagsOut: (originalRecord.bagsOut || 0) + bagsToWithdraw,
    };

    if (paymentMade > 0) {
        recordUpdate.payments!.push({ amount: paymentMade, date: Timestamp.fromDate(new Date(withdrawalDate)), type: 'rent' });
    }

    if (isFullWithdrawal) {
        recordUpdate.storageEndDate = Timestamp.fromDate(new Date(withdrawalDate));
        recordUpdate.billingCycle = 'Completed';
    }

    recordUpdate.totalRentBilled = (originalRecord.totalRentBilled || 0) + finalRent;
    
    await updateStorageRecord(recordId, recordUpdate);

    revalidatePath('/storage');
    revalidatePath('/reports');
    redirect(`/outflow/receipt/${recordId}?withdrawn=${bagsToWithdraw}&rent=${finalRent}&paidNow=${paymentMade}`);
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
    const { updateStorageRecord, addPaymentToRecord } = await import('@/lib/data.server');
    const validatedFields = PaymentSchema.safeParse({
        recordId: formData.get('recordId'),
        paymentAmount: formData.get('paymentAmount'),
        paymentDate: formData.get('paymentDate'),
        paymentType: formData.get('paymentType'),
    });

    if (!validatedFields.success) {
        const error = validatedFields.error.flatten().fieldErrors;
        const message = Object.values(error).flat().join(', ');
        return { message: `Invalid data: ${message}`, success: false };
    }
    
    const { recordId, paymentAmount, paymentDate, paymentType } = validatedFields.data;
    
    const record = await getStorageRecord(recordId);
    if (!record) {
        return { message: 'Record not found.', success: false };
    }

    if (paymentType === 'Hamali') {
        const updatedRecord = {
            ...record,
            hamaliPayable: (record.hamaliPayable || 0) + paymentAmount,
        };
        await updateStorageRecord(recordId, { hamaliPayable: updatedRecord.hamaliPayable });
    } else {
        const payment: Payment = {
            amount: paymentAmount,
            date: Timestamp.fromDate(new Date(paymentDate)),
            type: 'other'
        };
        await addPaymentToRecord(recordId, payment);
    }
    
    revalidatePath('/payments/pending');
    revalidatePath('/reports');
    return { message: 'Transaction recorded successfully.', success: true };
}


const ExpenseSchema = z.object({
  description: z.string().min(2, 'Description is required.'),
  amount: z.coerce.number().positive('Amount must be a positive number.'),
  date: z.string().refine(val => !isNaN(Date.parse(val)), { message: "Invalid date format" }),
  category: z.enum(expenseCategories, { required_error: 'Category is required.' }),
});

export async function addExpense(prevState: FormState, formData: FormData) {
    const { saveExpense } = await import('@/lib/data.server');
    const validatedFields = ExpenseSchema.safeParse({
        description: formData.get('description'),
        amount: formData.get('amount'),
        date: formData.get('date'),
        category: formData.get('category'),
    });

    if (!validatedFields.success) {
        const error = validatedFields.error.flatten().fieldErrors;
        const message = Object.values(error).flat().join(', ');
        return { message: `Invalid data: ${message}`, success: false };
    }

    const newExpense = {
        ...validatedFields.data,
        date: Timestamp.fromDate(new Date(validatedFields.data.date)),
    };

    await saveExpense(newExpense);

    revalidatePath('/expenses');
    return { message: 'Expense added successfully.', success: true };
}

export async function seedDatabase() {
    const { seedCustomers, seedStorageRecords } = await import('@/lib/data.server');
    try {
        const customersCount = await seedCustomers();
        const recordsCount = await seedStorageRecords();
        revalidatePath('/'); // Revalidate all paths
        return {
            message: `Successfully seeded database.\n- Customers: ${customersCount}\n- Storage Records: ${recordsCount}`,
            success: true,
        };
    } catch (error: any) {
        console.error('Seeding failed:', error);
        return {
            message: `Failed to seed database: ${error.message}`,
            success: false,
        };
    }
}
