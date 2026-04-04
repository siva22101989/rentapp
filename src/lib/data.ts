
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

function getCollectionRef(db: Firestore, warehouseId: string, collectionName: string) {
    return collection(db, 'managedWarehouses', warehouseId, collectionName);
}

function getDocRef(db: Firestore, warehouseId: string, collectionName: string, docId: string) {
    return doc(db, 'managedWarehouses', warehouseId, collectionName, docId);
}

export const saveCustomer = async (db: Firestore, warehouseId: string, customer: Omit<Customer, 'id'>): Promise<string> => {
  const docRef = await addDoc(getCollectionRef(db, warehouseId, 'customers'), cleanForFirestore(customer));
  return docRef.id;
};

export const updateCustomer = async (db: Firestore, warehouseId: string, id: string, data: Partial<Customer>): Promise<void> => {
    const customerRef = getDocRef(db, warehouseId, 'customers', id);
    await updateDoc(customerRef, cleanForFirestore(data));
};

export const deleteCustomer = async (db: Firestore, warehouseId: string, id: string): Promise<void> => {
    await deleteDoc(getDocRef(db, warehouseId, 'customers', id));
};

export const updateStorageRecord = async (db: Firestore, warehouseId: string, id: string, data: Partial<StorageRecord>): Promise<void> => {
    const recordRef = getDocRef(db, warehouseId, 'storageRecords', id);
    await updateDoc(recordRef, cleanForFirestore(data));
};

export const deleteStorageRecord = async (db: Firestore, warehouseId: string, id: string): Promise<void> => {
    await deleteDoc(getDocRef(db, warehouseId, 'storageRecords', id));
};

export const saveCommodity = async (db: Firestore, warehouseId: string, commodity: Omit<Commodity, 'id'>): Promise<string> => {
  const docRef = await addDoc(getCollectionRef(db, warehouseId, 'commodities'), cleanForFirestore(commodity));
  return docRef.id;
};

export const updateCommodity = async (db: Firestore, warehouseId: string, id: string, data: Partial<Commodity>): Promise<void> => {
    const commodityRef = getDocRef(db, warehouseId, 'commodities', id);
    await updateDoc(commodityRef, cleanForFirestore(data));
};

export const deleteCommodity = async (db: Firestore, warehouseId: string, id: string): Promise<void> => {
    await deleteDoc(getDocRef(db, warehouseId, 'commodities', id));
};

export const deleteLot = async (db: Firestore, warehouseId: string, id: string): Promise<void> => {
    await deleteDoc(getDocRef(db, warehouseId, 'lots', id));
};

export const deleteOutflowEvent = async (db: Firestore, warehouseId: string, recordId: string, outflowIndex: number): Promise<void> => {
    const recordRef = getDocRef(db, warehouseId, 'storageRecords', recordId);
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

export const editOutflowEvent = async (db: Firestore, warehouseId: string, recordId: string, outflowIndex: number, newData: { date: Date, discount: number }): Promise<void> => {
    const recordRef = getDocRef(db, warehouseId, 'storageRecords', recordId);
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
    const recordRef = getDocRef(db, warehouseId, 'unloadingRecords', id);
    await updateDoc(recordRef, cleanForFirestore(data));
};

export const deleteUnloadingRecord = async (db: Firestore, warehouseId: string, id: string): Promise<void> => {
    const recordRef = getDocRef(db, warehouseId, 'unloadingRecords', id);
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
    const borrowingRef = getDocRef(db, warehouseId, 'borrowings', id);
    await updateDoc(borrowingRef, cleanForFirestore(data));
};

export const deleteBorrowing = async (db: Firestore, warehouseId: string, id: string): Promise<void> => {
    await deleteDoc(getDocRef(db, warehouseId, 'borrowings', id));
};

export const updateLending = async (db: Firestore, warehouseId: string, id: string, data: Partial<Lending>): Promise<void> => {
    const lendingRef = getDocRef(db, warehouseId, 'lendings', id);
    await updateDoc(lendingRef, cleanForFirestore(data));
};

export const deleteLending = async (db: Firestore, warehouseId: string, id: string): Promise<void> => {
    await deleteDoc(getDocRef(db, warehouseId, 'lendings', id));
};

export const updateUser = async (db: Firestore, id: string, data: Partial<AppUser>): Promise<void> => {
    const userRef = doc(db, 'users', id);
    await updateDoc(userRef, cleanForFirestore(data));
};

export const deleteManagedWarehouse = async (db: Firestore, warehouseId: string): Promise<void> => {
    const batch = writeBatch(db);

    const warehouseRef = doc(db, 'managedWarehouses', warehouseId);
    batch.delete(warehouseRef);
    
    const usersQuery = query(collection(db, 'users'), where('warehouseId', '==', warehouseId));
    const usersSnapshot = await getDocs(usersQuery);
    usersSnapshot.forEach(userDoc => {
        batch.delete(userDoc.ref);
    });

    await batch.commit();
}

export const updateManagedWarehouse = async (db: Firestore, warehouseId: string, data: Partial<ManagedWarehouse>): Promise<void> => {
    const warehouseRef = doc(db, 'managedWarehouses', warehouseId);
    await updateDoc(warehouseRef, cleanForFirestore(data));
}
