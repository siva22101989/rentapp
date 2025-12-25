
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

export const updateStorageRecord = async (db: Firestore, id: string, data: Partial<StorageRecord>): Promise<void> => {
    const recordRef = doc(db, 'storageRecords', id);
    const updateData: { [key: string]: any } = { ...data };
    
    // Convert Date objects to Timestamps for Firestore
    if (data.storageStartDate instanceof Date) {
        updateData.storageStartDate = Timestamp.fromDate(data.storageStartDate);
    }
    
    await updateDoc(recordRef, updateData);
};
