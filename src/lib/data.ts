
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

<<<<<<< HEAD
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
=======
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
  const newDocRef = await addDoc(customersCollection, customer).catch(async (serverError) => {
      const permissionError = new FirestorePermissionError({
        path: 'customers', // Use collection name for addDoc
        operation: 'create',
        requestResourceData: customer,
      });
      errorEmitter.emit('permission-error', permissionError);
      throw permissionError; // Re-throw to propagate the failure
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
  await setDoc(recordRef, record).catch(async (serverError) => {
    const permissionError = new FirestorePermissionError({
      path: recordRef.path,
      operation: 'create',
      requestResourceData: record,
    });
    errorEmitter.emit('permission-error', permissionError);
    throw permissionError;
  });
  return record.id;
};

export const updateStorageRecord = async (
  id: string,
  data: Partial<StorageRecord>
): Promise<void> => {
  if (!id) return;
  const docRef = doc(db, 'storageRecords', id);
  await updateDoc(docRef, data).catch(async (serverError) => {
    const permissionError = new FirestorePermissionError({
      path: docRef.path,
      operation: 'update',
      requestResourceData: data,
    });
    errorEmitter.emit('permission-error', permissionError);
    throw permissionError;
  });
};

export const deleteStorageRecord = async (id: string): Promise<void> => {
  if (!id) return;
  const docRef = doc(db, 'storageRecords', id);
  await deleteDoc(docRef).catch(async (serverError) => {
    const permissionError = new FirestorePermissionError({
      path: docRef.path,
      operation: 'delete',
    });
    errorEmitter.emit('permission-error', permissionError);
    throw permissionError;
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
  const newDocRef = await addDoc(expensesCollection, expense)
    .catch(async (serverError) => {
      const permissionError = new FirestorePermissionError({
        path: 'expenses',
        operation: 'create',
        requestResourceData: expense,
      });
      errorEmitter.emit('permission-error', permissionError);
      throw permissionError;
    });
  return newDocRef.id;
};

export const updateExpense = async (
  id: string,
  data: Partial<Expense>
): Promise<void> => {
  if (!id) return;
  const docRef = doc(db, 'expenses', id);
  await updateDoc(docRef, data).catch(async (serverError) => {
    const permissionError = new FirestorePermissionError({
      path: docRef.path,
      operation: 'update',
      requestResourceData: data,
    });
    errorEmitter.emit('permission-error', permissionError);
    throw permissionError;
  });
};

export const deleteExpense = async (id: string): Promise<void> => {
  if (!id) return;
  const docRef = doc(db, 'expenses', id);
  await deleteDoc(docRef).catch(async (serverError) => {
    const permissionError = new FirestorePermissionError({
      path: docRef.path,
      operation: 'delete',
    });
    errorEmitter.emit('permission-error', permissionError);
    throw permissionError;
  });
>>>>>>> 493f64cf071699c798704dd512006dc35618f02c
};
