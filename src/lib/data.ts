
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
  writeBatch,
  query,
  where,
  type Firestore,
} from 'firebase/firestore';
import { db } from '@/firebase/config'; // Assuming db is exported from your config
import type { Customer, StorageRecord, Payment, Expense } from '@/lib/definitions';
import { revalidatePath } from 'next/cache';
import { toDate } from './utils';

// Helper to convert Firestore doc to our types
function fromFirestore<T>(doc: any): T {
    const data = doc.data();
    const id = doc.id;
    // Convert Timestamps to Dates
    for (const key in data) {
        if (data[key] && typeof data[key].toDate === 'function') {
            data[key] = data[key].toDate();
        }
    }
    return { ...data, id } as T;
}

// Customer Functions
export async function customers(): Promise<Customer[]> {
  const customersCollection = collection(db, 'customers');
  const snapshot = await getDocs(customersCollection);
  return snapshot.docs.map(doc => fromFirestore<Customer>(doc));
}

export const getCustomer = async (id: string): Promise<Customer | null> => {
  if (!id) return null;
  const docRef = doc(db, 'customers', id);
  const docSnap = await getDoc(docRef);
  return docSnap.exists() ? fromFirestore<Customer>(docSnap) : null;
};

export const saveCustomer = async (customer: Omit<Customer, 'id'>): Promise<string> => {
  const customersCollection = collection(db, 'customers');
  const newDocRef = await addDoc(customersCollection, customer);
  revalidatePath('/customers');
  return newDocRef.id;
};

// Storage Record Functions
export async function storageRecords(): Promise<StorageRecord[]> {
  const recordsCollection = collection(db, 'storageRecords');
  const snapshot = await getDocs(recordsCollection);
  return snapshot.docs.map(doc => {
      const record = fromFirestore<StorageRecord>(doc);
      // Ensure nested arrays of objects are also converted
      return {
          ...record,
          payments: (record.payments || []).map(p => ({
              ...p,
              date: toDate(p.date)
          }))
      };
  });
}

export const getStorageRecord = async (id: string): Promise<StorageRecord | null> => {
  if (!id) return null;
  const docRef = doc(db, 'storageRecords', id);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) return null;
  
  const record = fromFirestore<StorageRecord>(docSnap);
  return {
    ...record,
    payments: (record.payments || []).map(p => ({
        ...p,
        date: toDate(p.date)
    }))
  };
};

export const saveStorageRecord = async (record: Omit<StorageRecord, 'id'>): Promise<string> => {
  const recordsCollection = collection(db, 'storageRecords');
  const docRef = await addDoc(recordsCollection, record);
  revalidatePath('/storage');
  revalidatePath('/reports');
  return docRef.id;
};

export const updateStorageRecord = async (id: string, data: Partial<StorageRecord>): Promise<void> => {
    if (!id) return;
    const docRef = doc(db, 'storageRecords', id);
    await updateDoc(docRef, data);
    revalidatePath('/storage');
    revalidatePath('/payments/pending');
    revalidatePath('/reports');
}

export const deleteStorageRecord = async (id: string): Promise<void> => {
    if (!id) return;
    const docRef = doc(db, 'storageRecords', id);
    await deleteDoc(docRef);
    revalidatePath('/storage');
    revalidatePath('/payments/pending');
    revalidatePath('/reports');
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
export async function expenses(): Promise<Expense[]> {
  const expensesCollection = collection(db, 'expenses');
  const snapshot = await getDocs(expensesCollection);
  return snapshot.docs.map(doc => fromFirestore<Expense>(doc));
}

export async function saveExpense(expense: Omit<Expense, 'id'>): Promise<string> {
  const expensesCollection = collection(db, 'expenses');
  const docRef = await addDoc(expensesCollection, expense);
  revalidatePath('/expenses');
  return docRef.id;
}

export const updateExpense = async (id: string, data: Partial<Expense>): Promise<void> => {
    if (!id) return;
    const docRef = doc(db, 'expenses', id);
    await updateDoc(docRef, data);
    revalidatePath('/expenses');
};

export const deleteExpense = async (id: string): Promise<void> => {
    if (!id) return;
    const docRef = doc(db, 'expenses', id);
    await deleteDoc(docRef);
    revalidatePath('/expenses');
};
