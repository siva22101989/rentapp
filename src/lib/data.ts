
'use server';

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  query,
  where,
  type Firestore,
  addDoc,
} from 'firebase/firestore';
import { db } from '@/firebase/config';
import type {
  Customer,
  StorageRecord,
  Payment,
  Expense,
} from '@/lib/definitions';
import { toDate } from './utils';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

// Helper to convert Firestore doc to our types
function fromFirestore<T>(doc: any): T {
  const data = doc.data();
  const id = doc.id;
  // Convert Timestamps to Dates
  for (const key in data) {
    if (data[key] && typeof data[key].toDate === 'function') {
      data[key] = toDate(data[key]);
    }
  }
  return { ...data, id } as T;
}

// ============== CUSTOMER FUNCTIONS ==============
export async function getCustomers(): Promise<Customer[]> {
  const customersCollection = collection(db, 'customers');
  const snapshot = await getDocs(customersCollection).catch((serverError) => {
    const permissionError = new FirestorePermissionError({
      path: customersCollection.path,
      operation: 'list',
    });
    errorEmitter.emit('permission-error', permissionError);
    throw permissionError;
  });
  return snapshot.docs.map((doc) => fromFirestore<Customer>(doc));
}

export const getCustomer = async (id: string): Promise<Customer | null> => {
  if (!id) return null;
  const docRef = doc(db, 'customers', id);
  const docSnap = await getDoc(docRef).catch((serverError) => {
    const permissionError = new FirestorePermissionError({
      path: docRef.path,
      operation: 'get',
    });
    errorEmitter.emit('permission-error', permissionError);
    throw permissionError;
  });
  return docSnap.exists() ? fromFirestore<Customer>(docSnap) : null;
};

export const saveCustomer = async (
  customer: Omit<Customer, 'id'>
): Promise<string> => {
  const customersCollection = collection(db, 'customers');
  const newDocRef = doc(customersCollection); // Create a reference to get the ID
  
  setDoc(newDocRef, customer).catch(async (serverError) => {
      const permissionError = new FirestorePermissionError({
        path: newDocRef.path,
        operation: 'create',
        requestResourceData: customer,
      });
      errorEmitter.emit('permission-error', permissionError);
      // We don't re-throw here because the action will proceed,
      // but the listener will show the error toast.
    });

  return newDocRef.id;
};

// ============== STORAGE RECORD FUNCTIONS ==============
export async function getRecords(): Promise<StorageRecord[]> {
  const recordsCollection = collection(db, 'storageRecords');
  const snapshot = await getDocs(recordsCollection).catch((serverError) => {
    const permissionError = new FirestorePermissionError({
      path: recordsCollection.path,
      operation: 'list',
    });
    errorEmitter.emit('permission-error', permissionError);
    throw permissionError;
  });
  return snapshot.docs.map((doc) => {
    const record = fromFirestore<StorageRecord>(doc);
    return {
      ...record,
      payments: (record.payments || []).map((p) => ({
        ...p,
        date: toDate(p.date),
      })),
    };
  });
}

export const getStorageRecord = async (
  id: string
): Promise<StorageRecord | null> => {
  if (!id) return null;
  const docRef = doc(db, 'storageRecords', id);
  const docSnap = await getDoc(docRef).catch((serverError) => {
    const permissionError = new FirestorePermissionError({
      path: docRef.path,
      operation: 'get',
    });
    errorEmitter.emit('permission-error', permissionError);
    throw permissionError;
  });

  if (!docSnap.exists()) return null;

  const record = fromFirestore<StorageRecord>(docSnap);
  return {
    ...record,
    payments: (record.payments || []).map((p) => ({
      ...p,
      date: toDate(p.date),
    })),
  };
};

export const saveStorageRecord = async (
  record: Omit<StorageRecord, 'id'> & { id: string }
): Promise<string> => {
  const recordRef = doc(db, 'storageRecords', record.id);
  setDoc(recordRef, record).catch(async (serverError) => {
    const permissionError = new FirestorePermissionError({
      path: recordRef.path,
      operation: 'create',
      requestResourceData: record,
    });
    errorEmitter.emit('permission-error', permissionError);
  });
  return record.id;
};

export const updateStorageRecord = async (
  id: string,
  data: Partial<StorageRecord>
): Promise<void> => {
  if (!id) return;
  const docRef = doc(db, 'storageRecords', id);
  updateDoc(docRef, data).catch(async (serverError) => {
    const permissionError = new FirestorePermissionError({
      path: docRef.path,
      operation: 'update',
      requestResourceData: data,
    });
    errorEmitter.emit('permission-error', permissionError);
  });
};

export const deleteStorageRecord = async (id: string): Promise<void> => {
  if (!id) return;
  const docRef = doc(db, 'storageRecords', id);
  deleteDoc(docRef).catch(async (serverError) => {
    const permissionError = new FirestorePermissionError({
      path: docRef.path,
      operation: 'delete',
    });
    errorEmitter.emit('permission-error', permissionError);
  });
};

export const addPaymentToRecord = async (recordId: string, payment: Payment) => {
  const record = await getStorageRecord(recordId);
  if (!record) {
    throw new Error('Record not found');
  }
  const updatedPayments = record.payments
    ? [...record.payments, payment]
    : [payment];
  await updateStorageRecord(recordId, { payments: updatedPayments });
};

// ============== EXPENSE FUNCTIONS ==============
export async function getExpenses(): Promise<Expense[]> {
  const expensesCollection = collection(db, 'expenses');
  const snapshot = await getDocs(expensesCollection).catch((serverError) => {
    const permissionError = new FirestorePermissionError({
      path: expensesCollection.path,
      operation: 'list',
    });
    errorEmitter.emit('permission-error', permissionError);
    throw permissionError;
  });
  return snapshot.docs.map((doc) => fromFirestore<Expense>(doc));
}

export const saveExpense = async (
  expense: Omit<Expense, 'id'>
): Promise<string> => {
  const expensesCollection = collection(db, 'expenses');
  const newDocRef = doc(expensesCollection);

  setDoc(newDocRef, expense)
    .catch(async (serverError) => {
      const permissionError = new FirestorePermissionError({
        path: newDocRef.path,
        operation: 'create',
        requestResourceData: expense,
      });
      errorEmitter.emit('permission-error', permissionError);
    });
  return newDocRef.id;
};

export const updateExpense = async (
  id: string,
  data: Partial<Expense>
): Promise<void> => {
  if (!id) return;
  const docRef = doc(db, 'expenses', id);
  updateDoc(docRef, data).catch(async (serverError) => {
    const permissionError = new FirestorePermissionError({
      path: docRef.path,
      operation: 'update',
      requestResourceData: data,
    });
    errorEmitter.emit('permission-error', permissionError);
  });
};

export const deleteExpense = async (id: string): Promise<void> => {
  if (!id) return;
  const docRef = doc(db, 'expenses', id);
  deleteDoc(docRef).catch(async (serverError) => {
    const permissionError = new FirestorePermissionError({
      path: docRef.path,
      operation: 'delete',
    });
    errorEmitter.emit('permission-error', permissionError);
  });
};
