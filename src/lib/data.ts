
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
  arrayUnion,
} from 'firebase/firestore';
import type { Customer, Expense, Payment, StorageRecord } from './definitions';

// These functions are intended for client-side use.

export const saveCustomer = async (db: Firestore, customer: Omit<Customer, 'id'>): Promise<string> => {
  const docRef = await addDoc(collection(db, 'customers'), customer);
  return docRef.id;
};

export const updateCustomer = async (db: Firestore, id: string, data: Partial<Customer>): Promise<void> => {
    const customerRef = doc(db, 'customers', id);
    await updateDoc(customerRef, data);
};

export const deleteCustomer = async (db: Firestore, id: string): Promise<void> => {
    await deleteDoc(doc(db, 'customers', id));
};


// These functions are intended for server-side use only (e.g., in server actions or API routes)
// and should be imported from 'lib/data.server' to avoid including server code in client bundles.
// The functions themselves are defined in a separate file that can be marked with 'use server'.

// This function is safe for client use as it's read-only
export const getCustomer = async (id: string): Promise<Customer | null> => {
  // This needs to use the server-side admin SDK to fetch initial data for server components
  const { getCustomer: getCustomerServer } = await import('@/lib/data.server');
  return getCustomerServer(id);
};

// This function is safe for client use as it's read-only
export const getStorageRecords = async (): Promise<StorageRecord[]> => {
  const { getStorageRecords: getStorageRecordsServer } = await import('@/lib/data.server');
  return getStorageRecordsServer();
}

// This function is safe for client use as it's read-only
export const getStorageRecord = async (id: string): Promise<StorageRecord | null> => {
  const { getStorageRecord: getStorageRecordServer } = await import('@/lib/data.server');
  return getStorageRecordServer(id);
};
