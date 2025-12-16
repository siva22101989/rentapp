
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
    const db = getDb();
    const batch = writeBatch(db);
    const customersCol = collection(db, 'customers');
    
    customersData.forEach((customer) => {
        const docRef = doc(customersCol, customer.id);
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
    const db = getDb();
    const batch = writeBatch(db);
    const recordsCol = collection(db, 'storageRecords');

    storageRecordsData.forEach((record) => {
        const docRef = doc(recordsCol, record.id);
        
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

export const saveStorageRecord = async (record: Omit<StorageRecord, 'id'> & {id: string}): Promise<string> => {
  const db = getDb();
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
