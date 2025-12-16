
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
} from 'firebase/firestore';
import { initializeFirebase } from '@/firebase';
import type { Customer, Expense, Payment, StorageRecord } from './definitions';
import { revalidatePath } from 'next/cache';

// This function is a placeholder for getting the Firestore instance.
// In a real app, you would get this from your Firebase initialization.
function getDb(): Firestore {
  const { firestore } = initializeFirebase();
  if (!firestore) {
    throw new Error('Firestore is not initialized');
  }
  return firestore;
}

// Customer Functions
export async function getCustomers(): Promise<Customer[]> {
  const db = getDb();
  const customersCol = collection(db, 'customers');
  const customerSnapshot = await getDocs(customersCol);
  const customerList = customerSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer));
  return customerList;
}

export const getCustomer = async (id: string): Promise<Customer | null> => {
  const db = getDb();
  const customerDoc = await getDoc(doc(db, 'customers', id));
  if (customerDoc.exists()) {
    return { id: customerDoc.id, ...customerDoc.data() } as Customer;
  }
  return null;
};

export const saveCustomer = async (customer: Omit<Customer, 'id'>): Promise<string> => {
  const db = getDb();
  const docRef = await addDoc(collection(db, 'customers'), customer);
  return docRef.id;
};

export const updateCustomer = async (id: string, data: Partial<Customer>): Promise<void> => {
    const db = getDb();
    const customerRef = doc(db, 'customers', id);
    await updateDoc(customerRef, data);
};

export const deleteCustomer = async (id: string): Promise<void> => {
    const db = getDb();
    await deleteDoc(doc(db, 'customers', id));
};


// Storage Record Functions
export async function getStorageRecords(): Promise<StorageRecord[]> {
  const db = getDb();
  const recordsCol = collection(db, 'storageRecords');
  const recordSnapshot = await getDocs(recordsCol);
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
  const db = getDb();
  const recordDoc = await getDoc(doc(db, 'storageRecords', id));
  if (recordDoc.exists()) {
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

export const saveStorageRecord = async (record: Omit<StorageRecord, 'id'>): Promise<string> => {
  const db = getDb();
  // Using setDoc with a specific ID.
  const docRef = doc(db, 'storageRecords', record.id);
  await setDoc(docRef, record);
  return record.id;
};

export const updateStorageRecord = async (id: string, data: Partial<StorageRecord>): Promise<void> => {
    const db = getDb();
    const recordRef = doc(db, 'storageRecords', id);
    await updateDoc(recordRef, data);
}

export const deleteStorageRecord = async (id: string): Promise<void> => {
    const db = getDb();
    await deleteDoc(doc(db, 'storageRecords', id));
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
  const db = getDb();
  const expensesCol = collection(db, 'expenses');
  const expenseSnapshot = await getDocs(expensesCol);
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
  const db = getDb();
  const docRef = await addDoc(collection(db, 'expenses'), expense);
  return docRef.id;
}

export const updateExpense = async (id: string, data: Partial<Expense>): Promise<void> => {
    const db = getDb();
    await updateDoc(doc(db, 'expenses', id), data);
};

export const deleteExpense = async (id: string): Promise<void> => {
    const db = getDb();
    await deleteDoc(doc(db, 'expenses', id));
};
