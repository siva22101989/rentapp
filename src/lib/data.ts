
'use server';

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  addDoc,
  Timestamp,
  type Firestore,
  writeBatch,
} from 'firebase/firestore';
import { initializeFirebase } from '@/firebase';
import { getAdminApp, getAdminDb } from '@/firebase/admin';
import type { Customer, Expense, Payment, StorageRecord } from './definitions';
import { revalidatePath } from 'next/cache';

// Import dummy data
import customersData from './data/customers.json';
import storageRecordsData from './data/storageRecords.json';


function getDb(): Firestore {
  const { firestore } = initializeFirebase();
  if (!firestore) {
    throw new Error('Firestore is not initialized');
  }
  return firestore;
}

// Seeding Functions
export const seedCustomers = async (): Promise<number> => {
    const db = getAdminDb();
    const batch = db.batch();
    const customersCol = db.collection('customers');
    
    customersData.forEach((customer) => {
        const docRef = customersCol.doc(customer.id);
        batch.set(docRef, {
            name: customer.name,
            phone: customer.phone,
            address: customer.address,
            email: customer.email,
            fatherName: customer.fatherName,
            village: customer.village,
        });
    });

    await batch.commit();
    return customersData.length;
}

export const seedStorageRecords = async (): Promise<number> => {
    const db = getAdminDb();
    const batch = db.batch();
    const recordsCol = db.collection('storageRecords');

    storageRecordsData.forEach((record) => {
        const docRef = recordsCol.doc(record.id);
        
        // Convert date strings to Timestamps
        const startDate = record.storageStartDate ? Timestamp.fromDate(new Date(record.storageStartDate)) : Timestamp.now();
        const endDate = record.storageEndDate ? Timestamp.fromDate(new Date(record.storageEndDate)) : null;
        const payments = (record.payments || []).map(p => ({
            ...p,
            date: Timestamp.fromDate(new Date(p.date))
        }));

        batch.set(docRef, {
            ...record,
            storageStartDate: startDate,
            storageEndDate: endDate,
            payments: payments,
        });
    });

    await batch.commit();
    return storageRecordsData.length;
}


// Customer Functions
export async function getCustomers(): Promise<Customer[]> {
  const db = getAdminDb();
  const customersCol = db.collection('customers');
  const customerSnapshot = await customersCol.get();
  const customerList = customerSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer));
  return customerList;
}

export const getCustomer = async (id: string): Promise<Customer | null> => {
  const db = getAdminDb();
  const customerDoc = await db.collection('customers').doc(id).get();
  if (customerDoc.exists) {
    return { id: customerDoc.id, ...customerDoc.data() } as Customer;
  }
  return null;
};

export const saveCustomer = async (customer: Omit<Customer, 'id'>): Promise<string> => {
  const db = getAdminDb();
  const docRef = await db.collection('customers').add(customer);
  return docRef.id;
};

export const updateCustomer = async (id: string, data: Partial<Customer>): Promise<void> => {
    const db = getAdminDb();
    const customerRef = db.collection('customers').doc(id);
    await customerRef.update(data);
};

export const deleteCustomer = async (id: string): Promise<void> => {
    const db = getAdminDb();
    await db.collection('customers').doc(id).delete();
};


// Storage Record Functions
export async function getStorageRecords(): Promise<StorageRecord[]> {
  const db = getAdminDb();
  const recordsCol = db.collection('storageRecords');
  const recordSnapshot = await recordsCol.get();
  return recordSnapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      storageStartDate: (data.storageStartDate as Timestamp)?.toDate(),
      storageEndDate: (data.storageEndDate as Timestamp)?.toDate() || null,
      payments: (data.payments || []).map((p: any) => ({...p, date: (p.date as Timestamp)?.toDate()})),
    } as StorageRecord;
  });
}

export const getStorageRecord = async (id: string): Promise<StorageRecord | null> => {
  const db = getAdminDb();
  const recordDoc = await db.collection('storageRecords').doc(id).get();
  if (recordDoc.exists) {
    const data = recordDoc.data();
    return {
      id: recordDoc.id,
      ...data,
      storageStartDate: (data.storageStartDate as Timestamp)?.toDate(),
      storageEndDate: data.storageEndDate ? (data.storageEndDate as Timestamp)?.toDate() : null,
      payments: (data.payments || []).map((p: any) => ({...p, date: (p.date as Timestamp)?.toDate()})),
    } as StorageRecord;
  }
  return null;
};

export const saveStorageRecord = async (record: Omit<StorageRecord, 'id'> & {id: string}): Promise<string> => {
  const db = getAdminDb();
  const docRef = db.collection('storageRecords').doc(record.id);
  await docRef.set(record);
  return record.id;
};

export const updateStorageRecord = async (id: string, data: Partial<StorageRecord>): Promise<void> => {
    const db = getAdminDb();
    const recordRef = db.collection('storageRecords').doc(id);
    await recordRef.update(data);
}

export const deleteStorageRecord = async (id: string): Promise<void> => {
    const db = getAdminDb();
    await db.collection('storageRecords').doc(id).delete();
};

export const addPaymentToRecord = async (recordId: string, payment: Payment) => {
    const record = await getStorageRecord(recordId);
    if (!record) {
        throw new Error("Record not found");
    }
    const updatedPayments = record.payments ? [...record.payments, payment] : [payment];
    await updateStorageRecord(recordId, { payments: updatedPayments });
}


// Expense Functions
export async function getExpenses(): Promise<Expense[]> {
  const db = getAdminDb();
  const expensesCol = db.collection('expenses');
  const expenseSnapshot = await expensesCol.get();
  return expenseSnapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      date: (data.date as Timestamp)?.toDate(),
    } as Expense;
  });
}

export async function saveExpense(expense: Omit<Expense, 'id'>): Promise<string> {
  const db = getAdminDb();
  const docRef = await db.collection('expenses').add(expense);
  return docRef.id;
}

export const updateExpense = async (id: string, data: Partial<Expense>): Promise<void> => {
    const db = getAdminDb();
    await db.collection('expenses').doc(id).update(data);
};

export const deleteExpense = async (id: string): Promise<void> => {
    const db = getAdminDb();
    await db.collection('expenses').doc(id).delete();
};
