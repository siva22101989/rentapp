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
import type { Customer, Expense, Payment, StorageRecord, Commodity, Outflow } from './definitions';
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
    await updateDoc(recordRef, cleanForFirestore(data));
};

export const deleteStorageRecord = async (db: Firestore, id: string): Promise<void> => {
    await deleteDoc(doc(db, 'storageRecords', id));
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

export const deleteLot = async (db: Firestore, id: string): Promise<void> => {
    await deleteDoc(doc(db, 'lots', id));
};

export const deleteOutflowEvent = async (db: Firestore, recordId: string, outflowIndex: number): Promise<void> => {
    const recordRef = doc(db, 'storageRecords', recordId);
    const recordSnap = await getDoc(recordRef);
    if (!recordSnap.exists()) {
        throw new Error("Storage record not found");
    }
    const record = recordSnap.data() as StorageRecord;
    const outflows = record.outflows || [];

    if (outflowIndex < 0 || outflowIndex >= outflows.length) {
        throw new Error("Outflow event not found at the specified index.");
    }
    const outflowToDelete = outflows[outflowIndex];

    // Remove the outflow from the array
    const newOutflows = outflows.filter((_, index) => index !== outflowIndex);

    // Recalculate parent record fields by reverting the changes
    const newBagsOut = (record.bagsOut || 0) - outflowToDelete.bagsWithdrawn;
    const newBagsStored = (record.bagsIn || 0) - newBagsOut; // Recalculate from bagsIn to be safe
    const newTotalRentBilled = (record.totalRentBilled || 0) - outflowToDelete.rentBilled;

    const updateData = {
        outflows: newOutflows,
        bagsOut: newBagsOut,
        bagsStored: newBagsStored,
        totalRentBilled: newTotalRentBilled,
        // If the record was completed, it's now active again
        storageEndDate: null,
        billingCycle: '6-Month Initial' as const, // Revert to a sensible active state
    };

    await updateDoc(recordRef, cleanForFirestore(updateData));
};

export const editOutflowEvent = async (db: Firestore, recordId: string, outflowIndex: number, newData: { date: Date, discount: number }): Promise<void> => {
    const recordRef = doc(db, 'storageRecords', recordId);
    const recordSnap = await getDoc(recordRef);
    if (!recordSnap.exists()) {
        throw new Error("Storage record not found");
    }
    const record = recordSnap.data() as StorageRecord;
    const outflows = [...(record.outflows || [])];

    if (outflowIndex < 0 || outflowIndex >= outflows.length) {
        throw new Error("Outflow event not found at the specified index.");
    }

    // Note: This simple edit does not recalculate rent if the date changes.
    // It only updates the date and discount on the specific outflow event.
    // For more complex edits (like changing bags), a full recalculation would be needed.
    const outflowToEdit = outflows[outflowIndex];
    outflowToEdit.date = newData.date;
    outflowToEdit.discount = newData.discount;

    await updateDoc(recordRef, {
        outflows: cleanForFirestore(outflows),
    });
};
