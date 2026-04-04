
'use client';

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
  query,
  where,
} from 'firebase/firestore';
import type { Customer, Expense, Payment, StorageRecord, Commodity, Outflow, UnloadingRecord, Borrowing, Lending, AppUser, ManagedWarehouse } from './definitions';
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

    const newOutflows = outflows.filter((_, index) => index !== outflowIndex);

    const newBagsOut = (record.bagsOut || 0) - outflowToDelete.bagsWithdrawn;
    const newBagsStored = (record.bagsIn || 0) - newBagsOut;
    const newTotalRentBilled = (record.totalRentBilled || 0) - outflowToDelete.rentBilled;

    const updateData = {
        outflows: newOutflows,
        bagsOut: newBagsOut,
        bagsStored: newBagsStored,
        totalRentBilled: newTotalRentBilled,
        storageEndDate: null,
        billingCycle: '6-Month Initial' as const,
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

    const outflowToEdit = outflows[outflowIndex];
    outflowToEdit.date = newData.date;
    outflowToEdit.discount = newData.discount;

    await updateDoc(recordRef, {
        outflows: cleanForFirestore(outflows),
    });
};

export const updateUnloadingRecord = async (db: Firestore, id: string, data: Partial<UnloadingRecord>): Promise<void> => {
    const recordRef = doc(db, 'unloadingRecords', id);
    await updateDoc(recordRef, cleanForFirestore(data));
};

export const deleteUnloadingRecord = async (db: Firestore, id: string): Promise<void> => {
    const recordRef = doc(db, 'unloadingRecords', id);
    const recordSnap = await getDoc(recordRef);
    if (!recordSnap.exists()) {
        throw new Error("Record not found.");
    }
    const record = recordSnap.data() as UnloadingRecord;
    if (record.bagsSentToDrying && record.bagsSentToDrying > 0) {
        throw new Error("Cannot delete unloading record. It is already linked to a drying or storage process.");
    }
    await deleteDoc(recordRef);
};

export const updateBorrowing = async (db: Firestore, id: string, data: Partial<Borrowing>): Promise<void> => {
    const borrowingRef = doc(db, 'borrowings', id);
    await updateDoc(borrowingRef, cleanForFirestore(data));
};

export const deleteBorrowing = async (db: Firestore, id: string): Promise<void> => {
    await deleteDoc(doc(db, 'borrowings', id));
};

export const updateLending = async (db: Firestore, id: string, data: Partial<Lending>): Promise<void> => {
    const lendingRef = doc(db, 'lendings', id);
    await updateDoc(lendingRef, cleanForFirestore(data));
};

export const deleteLending = async (db: Firestore, id: string): Promise<void> => {
    await deleteDoc(doc(db, 'lendings', id));
};

export const updateUser = async (db: Firestore, id: string, data: Partial<AppUser>): Promise<void> => {
    const userRef = doc(db, 'users', id);
    await updateDoc(userRef, cleanForFirestore(data));
};

export const updateManagedWarehouse = async (db: Firestore, id: string, data: Partial<ManagedWarehouse>): Promise<void> => {
    const warehouseRef = doc(db, 'managedWarehouses', id);
    await updateDoc(warehouseRef, cleanForFirestore(data));
};

export const deleteManagedWarehouse = async (db: Firestore, warehouseId: string): Promise<void> => {
    const batch = writeBatch(db);

    const warehouseRef = doc(db, 'managedWarehouses', warehouseId);
    batch.delete(warehouseRef);
    
    const usersCollection = collection(db, 'users');
    const q = query(usersCollection, where('warehouseId', '==', warehouseId));
    
    const querySnapshot = await getDocs(q);
    querySnapshot.forEach((doc) => {
        batch.delete(doc.ref);
    });

    await batch.commit();
};
