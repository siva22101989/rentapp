
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
import type { Customer, Expense, Payment, StorageRecord, Commodity, Outflow, UnloadingRecord, Borrowing, Lending, ManagedWarehouse, AppUser } from './definitions';
import { cleanForFirestore } from './utils';

// These functions are intended for client-side use and now require a warehouseId.

export const saveCustomer = async (db: Firestore, warehouseId: string, customer: Omit<Customer, 'id'>): Promise<string> => {
  const docRef = await addDoc(collection(db, 'managedWarehouses', warehouseId, 'customers'), cleanForFirestore(customer));
  return docRef.id;
};

export const updateCustomer = async (db: Firestore, warehouseId: string, id: string, data: Partial<Customer>): Promise<void> => {
    const customerRef = doc(db, 'managedWarehouses', warehouseId, 'customers', id);
    await updateDoc(customerRef, cleanForFirestore(data));
};

export const deleteCustomer = async (db: Firestore, warehouseId: string, id: string): Promise<void> => {
    await deleteDoc(doc(db, 'managedWarehouses', warehouseId, 'customers', id));
};

export const updateStorageRecord = async (db: Firestore, warehouseId: string, id: string, data: Partial<StorageRecord>): Promise<void> => {
    const recordRef = doc(db, 'managedWarehouses', warehouseId, 'storageRecords', id);
    await updateDoc(recordRef, cleanForFirestore(data));
};

export const deleteStorageRecord = async (db: Firestore, warehouseId: string, id: string): Promise<void> => {
    await deleteDoc(doc(db, 'managedWarehouses', warehouseId, 'storageRecords', id));
};

export const saveCommodity = async (db: Firestore, warehouseId: string, commodity: Omit<Commodity, 'id'>): Promise<string> => {
  const docRef = await addDoc(collection(db, 'managedWarehouses', warehouseId, 'commodities'), cleanForFirestore(commodity));
  return docRef.id;
};

export const updateCommodity = async (db: Firestore, warehouseId: string, id: string, data: Partial<Commodity>): Promise<void> => {
    const commodityRef = doc(db, 'managedWarehouses', warehouseId, 'commodities', id);
    await updateDoc(commodityRef, cleanForFirestore(data));
};

export const deleteCommodity = async (db: Firestore, warehouseId: string, id: string): Promise<void> => {
    await deleteDoc(doc(db, 'managedWarehouses', warehouseId, 'commodities', id));
};

export const deleteLot = async (db: Firestore, warehouseId: string, id: string): Promise<void> => {
    await deleteDoc(doc(db, 'managedWarehouses', warehouseId, 'lots', id));
};

export const deleteOutflowEvent = async (db: Firestore, warehouseId: string, recordId: string, outflowIndex: number): Promise<void> => {
    const recordRef = doc(db, 'managedWarehouses', warehouseId, 'storageRecords', recordId);
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

export const editOutflowEvent = async (db: Firestore, warehouseId: string, recordId: string, outflowIndex: number, newData: { date: Date, discount: number }): Promise<void> => {
    const recordRef = doc(db, 'managedWarehouses', warehouseId, 'storageRecords', recordId);
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

export const updateUnloadingRecord = async (db: Firestore, warehouseId: string, id: string, data: Partial<UnloadingRecord>): Promise<void> => {
    const recordRef = doc(db, 'managedWarehouses', warehouseId, 'unloadingRecords', id);
    await updateDoc(recordRef, cleanForFirestore(data));
};

export const deleteUnloadingRecord = async (db: Firestore, warehouseId: string, id: string): Promise<void> => {
    const recordRef = doc(db, 'managedWarehouses', warehouseId, 'unloadingRecords', id);
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

export const updateBorrowing = async (db: Firestore, warehouseId: string, id: string, data: Partial<Borrowing>): Promise<void> => {
    const borrowingRef = doc(db, 'managedWarehouses', warehouseId, 'borrowings', id);
    await updateDoc(borrowingRef, cleanForFirestore(data));
};

export const deleteBorrowing = async (db: Firestore, warehouseId: string, id: string): Promise<void> => {
    await deleteDoc(doc(db, 'managedWarehouses', warehouseId, 'borrowings', id));
};

export const updateLending = async (db: Firestore, warehouseId: string, id: string, data: Partial<Lending>): Promise<void> => {
    const lendingRef = doc(db, 'managedWarehouses', warehouseId, 'lendings', id);
    await updateDoc(lendingRef, cleanForFirestore(data));
};

export const deleteLending = async (db: Firestore, warehouseId: string, id: string): Promise<void> => {
    await deleteDoc(doc(db, 'managedWarehouses', warehouseId, 'lendings', id));
};

export const updateUser = async (db: Firestore, id: string, data: Partial<AppUser>): Promise<void> => {
    const userRef = doc(db, 'users', id);
    await updateDoc(userRef, cleanForFirestore(data));
};

// Super-admin functions (no warehouseId needed)
export const updateManagedWarehouse = async (db: Firestore, id: string, data: Partial<ManagedWarehouse>): Promise<void> => {
    const warehouseRef = doc(db, 'managedWarehouses', id);
    await updateDoc(warehouseRef, cleanForFirestore(data));
};

export const deleteManagedWarehouse = async (db: Firestore, warehouseId: string): Promise<void> => {
    const warehouseRef = doc(db, 'managedWarehouses', warehouseId);
    const warehouseSnap = await getDoc(warehouseRef);
    if (!warehouseSnap.exists()) {
        throw new Error("Warehouse not found.");
    }
    const warehouseData = warehouseSnap.data() as ManagedWarehouse;
    const ownerEmail = warehouseData.ownerEmail.toLowerCase();

    const batch = writeBatch(db);

    // Delete the warehouse document
    batch.delete(warehouseRef);

    // Find and delete the corresponding user
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('email', '==', ownerEmail), where('warehouseId', '==', warehouseId));
    const userQuerySnap = await getDocs(q);
    
    if (!userQuerySnap.empty) {
        userQuerySnap.forEach(userDoc => {
            batch.delete(userDoc.ref);
        });
    }
    
    // Note: This does not delete sub-collection data within the warehouse.
    // That would require a more complex, likely server-side, operation.

    await batch.commit();
};
