
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
import type { Customer, Expense, Payment, StorageRecord, Commodity } from './definitions';
import { cleanForFirestore } from './utils';

// These functions are intended for client-side use.

export const saveCustomer = async (db: Firestore, customer: Omit<Customer, 'id'>): Promise<string> => {
  const docRef = await addDoc(collection(db, 'customers'), cleanForFirestore(customer));
  return docRef.id;
};

export const updateCustomer = async (db: Firestore, id: string, data: Partial<Customer>): Promise<void> => {
    const customerRef = doc(db, 'customers', id);
    await updateDoc(customerRef, cleanForFirestore(data));
};

export const deleteCustomer = async (db: Firestore, id: string): Promise<void> => {
    await deleteDoc(doc(db, 'customers', id));
};

export const updateStorageRecord = async (db: Firestore, id: string, data: Partial<StorageRecord>): Promise<void> => {
    const recordRef = doc(db, 'storageRecords', id);
    const updateData: { [key: string]: any } = cleanForFirestore(data);
    
    // Convert Date objects to Timestamps for Firestore
    if (data.storageStartDate instanceof Date) {
        updateData.storageStartDate = Timestamp.fromDate(data.storageStartDate);
    }
    
    await updateDoc(recordRef, updateData);
};

export const saveCommodity = async (db: Firestore, commodity: Omit<Commodity, 'id'>): Promise<string> => {
  const docRef = await addDoc(collection(db, 'commodities'), cleanForFirestore(commodity));
  return docRef.id;
};

export const updateCommodity = async (db: Firestore, id: string, data: Partial<Commodity>): Promise<void> => {
    const commodityRef = doc(db, 'commodities', id);
    await updateDoc(commodityRef, cleanForFirestore(data));
};

export const deleteCommodity = async (db: Firestore, id: string): Promise<void> => {
    await deleteDoc(doc(db, 'commodities', id));
};
