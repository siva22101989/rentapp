
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
  runTransaction,
  increment,
} from 'firebase/firestore';
import type { Customer, Expense, Payment, StorageRecord, Commodity, Outflow, UnloadingRecord, Borrowing, Lending, AppUser, ManagedWarehouse, DryingRecord } from './definitions';
import { cleanForFirestore } from './utils';

export const saveCustomer = async (db: Firestore, customer: Omit<Customer, 'id'>, warehouseId: string): Promise<string> => {
  const dataToSave = { ...customer, warehouseId };
  const docRef = await addDoc(collection(db, 'customers'), cleanForFirestore(dataToSave));
  return docRef.id;
};

export const updateCustomer = async (db: Firestore, id: string, data: Partial<Customer>): Promise<void> => {
    const customerRef = doc(db, 'customers', id);
    await updateDoc(customerRef, cleanForFirestore(data));
};

export const deleteCustomer = async (db: Firestore, id: string): Promise<void> => {
    await deleteDoc(doc(db, 'customers', id));
};

export const updateStorageRecord = async (db: Firestore, oldId: string, newId: string, data: Partial<StorageRecord>): Promise<void> => {
    const batch = writeBatch(db);
    if (oldId !== newId) {
        const oldRef = doc(db, 'storageRecords', oldId);
        const newRef = doc(db, 'storageRecords', newId);
        const existingSnap = await getDoc(newRef);
        if (existingSnap.exists()) {
            throw new Error(`Cannot change to Bill No #${newId} as it already exists.`);
        }
        const oldSnap = await getDoc(oldRef);
        if (oldSnap.exists()) {
            const currentData = oldSnap.data();
            batch.set(newRef, cleanForFirestore({ ...currentData, ...data }));
            batch.delete(oldRef);
        } else {
            throw new Error("Original record not found.");
        }
    } else {
        const recordRef = doc(db, 'storageRecords', oldId);
        batch.update(recordRef, cleanForFirestore(data));
    }
    await batch.commit();
};

export const deleteStorageRecord = async (db: Firestore, id: string): Promise<void> => {
    const recordRef = doc(db, 'storageRecords', id);
    await runTransaction(db, async (transaction) => {
        const recordSnap = await transaction.get(recordRef);
        if (!recordSnap.exists()) return;
        const recordData = recordSnap.data() as StorageRecord;
        if (recordData.inflowType === 'Plot' && recordData.dryingRecordId) {
            const unloadingRecordRef = doc(db, 'unloadingRecords', recordData.dryingRecordId);
            const bagsToReturn = recordData.bagsForDrying || 0;
            if (bagsToReturn > 0) {
                const unloadingSnap = await transaction.get(unloadingRecordRef);
                if (unloadingSnap.exists()) {
                    transaction.update(unloadingRecordRef, {
                        bagsSentToDrying: increment(-bagsToReturn)
                    });
                }
            }
        }
        transaction.delete(recordRef);
    });
};

export const deletePaymentFromRecord = async (db: Firestore, recordId: string, recordType: 'storage' | 'unloading', paymentIndex: number): Promise<void> => {
    const coll = recordType === 'storage' ? 'storageRecords' : 'unloadingRecords';
    const recordRef = doc(db, coll, recordId);
    await runTransaction(db, async (transaction) => {
        const snap = await transaction.get(recordRef);
        if (!snap.exists()) throw new Error("Record not found");
        const data = snap.data();
        const payments = [...(data.payments || [])];
        if (paymentIndex < 0 || paymentIndex >= payments.length) throw new Error("Payment not found at index");
        payments.splice(paymentIndex, 1);
        transaction.update(recordRef, { payments: cleanForFirestore(payments) });
    });
};

export const editPaymentInRecord = async (db: Firestore, recordId: string, recordType: 'storage' | 'unloading', paymentIndex: number, newData: Payment): Promise<void> => {
    const coll = recordType === 'storage' ? 'storageRecords' : 'unloadingRecords';
    const recordRef = doc(db, coll, recordId);
    await runTransaction(db, async (transaction) => {
        const snap = await transaction.get(recordRef);
        if (!snap.exists()) throw new Error("Record not found");
        const data = snap.data();
        const payments = [...(data.payments || [])];
        if (paymentIndex < 0 || paymentIndex >= payments.length) throw new Error("Payment not found at index");
        payments[paymentIndex] = newData;
        transaction.update(recordRef, { payments: cleanForFirestore(payments) });
    });
};

export const saveCommodity = async (db: Firestore, commodity: Omit<Commodity, 'id'>, warehouseId: string): Promise<string> => {
  const dataToSave = { ...commodity, warehouseId };
  const docRef = await addDoc(collection(db, 'commodities'), cleanForFirestore(dataToSave));
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
    await runTransaction(db, async (transaction) => {
        const recordSnap = await transaction.get(recordRef);
        if (!recordSnap.exists()) throw new Error("Storage record not found");
        const record = recordSnap.data() as StorageRecord;
        const outflows = record.outflows || [];
        if (outflowIndex < 0 || outflowIndex >= outflows.length) throw new Error("Outflow index error");
        const outflowToDelete = outflows[outflowIndex];
        const newOutflows = outflows.filter((_, index) => index !== outflowIndex);
        const newBagsOut = (record.bagsOut || 0) - outflowToDelete.bagsWithdrawn;
        const newBagsStored = (record.bagsIn || 0) - newBagsOut;
        const newTotalRentBilled = (record.totalRentBilled || 0) - outflowToDelete.rentBilled;
        transaction.update(recordRef, cleanForFirestore({
            outflows: newOutflows,
            bagsOut: newBagsOut,
            bagsStored: newBagsStored,
            totalRentBilled: newTotalRentBilled,
            storageEndDate: null,
            billingCycle: record.billingCycle || '6-Month Initial',
        }));
    });
};

export const editOutflowEvent = async (db: Firestore, recordId: string, outflowIndex: number, newData: any): Promise<void> => {
    const recordRef = doc(db, 'storageRecords', recordId);
    await runTransaction(db, async (transaction) => {
        const recordSnap = await transaction.get(recordRef);
        if (!recordSnap.exists()) throw new Error("Record not found");
        const record = recordSnap.data() as StorageRecord;
        const outflows = [...(record.outflows || [])];
        if (outflowIndex < 0 || outflowIndex >= outflows.length) throw new Error("Index error");
        const oldOutflow = outflows[outflowIndex];
        const bagDiff = newData.bagsWithdrawn - oldOutflow.bagsWithdrawn;
        const rentDiff = newData.rentBilled - oldOutflow.rentBilled;
        outflows[outflowIndex] = { ...oldOutflow, date: newData.date, bagsWithdrawn: newData.bagsWithdrawn, rentBilled: newData.rentBilled, discount: newData.discount };
        const newBagsOut = (record.bagsOut || 0) + bagDiff;
        const newBagsStored = (record.bagsIn || 0) - newBagsOut;
        if (newBagsStored < 0) throw new Error("Insufficient stock");
        const updateData: any = {
            outflows: cleanForFirestore(outflows),
            bagsOut: newBagsOut,
            bagsStored: newBagsStored,
            totalRentBilled: (record.totalRentBilled || 0) + rentDiff,
        };
        if (newData.khataAmount !== undefined) updateData.khataAmount = newData.khataAmount;
        if (newData.commodityDescription !== undefined) updateData.commodityDescription = newData.commodityDescription;
        if (newData.location !== undefined) updateData.location = newData.location;
        if (newBagsStored <= 0) {
            updateData.storageEndDate = Timestamp.fromDate(newData.date);
            updateData.billingCycle = 'Completed';
        } else {
            updateData.storageEndDate = null;
            updateData.billingCycle = record.billingCycle || '6-Month Initial';
        }
        transaction.update(recordRef, updateData);
    });
};

export const updateUnloadingRecord = async (db: Firestore, oldId: string, newId: string, data: Partial<UnloadingRecord>): Promise<void> => {
    const batch = writeBatch(db);
    if (oldId !== newId) {
        const oldRef = doc(db, 'unloadingRecords', oldId);
        const newRef = doc(db, 'unloadingRecords', newId);
        const existingSnap = await getDoc(newRef);
        if (existingSnap.exists()) throw new Error(`Bill #${newId} already exists.`);
        const oldSnap = await getDoc(oldRef);
        if (oldSnap.exists()) {
            batch.set(newRef, cleanForFirestore({ ...oldSnap.data(), ...data, billNo: newId }));
            batch.delete(oldRef);
        } else throw new Error("Original record missing.");
    } else {
        batch.update(doc(db, 'unloadingRecords', oldId), cleanForFirestore(data));
    }
    await batch.commit();
};

export const deleteUnloadingRecord = async (db: Firestore, id: string): Promise<void> => {
    await deleteDoc(doc(db, 'unloadingRecords', id));
};

export const deleteDryingRecord = async (db: Firestore, dryingRecordId: string): Promise<void> => {
  const dryingRecordRef = doc(db, 'dryingRecords', dryingRecordId);
  await runTransaction(db, async (transaction) => {
    const dryingRecordSnap = await transaction.get(dryingRecordRef);
    if (!dryingRecordSnap.exists()) return;
    const dryingRecordData = dryingRecordSnap.data() as DryingRecord;
    transaction.update(doc(db, 'unloadingRecords', dryingRecordData.unloadingRecordId), {
      bagsSentToDrying: increment(-(dryingRecordData.bagsForDrying || 0))
    });
    transaction.delete(dryingRecordRef);
  });
};

export const updateDryingRecord = async (db: Firestore, recordId: string, oldBagsForDrying: number, data: Partial<DryingRecord>): Promise<void> => {
    const dryingRecordRef = doc(db, 'dryingRecords', recordId);
    await runTransaction(db, async (transaction) => {
        const snap = await transaction.get(dryingRecordRef);
        if (!snap.exists()) throw new Error("Not found");
        const dryingRecordData = snap.data() as DryingRecord;
        transaction.update(dryingRecordRef, cleanForFirestore(data));
        const newBagsForDrying = data.bagsForDrying;
        if (newBagsForDrying !== undefined && newBagsForDrying !== oldBagsForDrying) {
            transaction.update(doc(db, 'unloadingRecords', dryingRecordData.unloadingRecordId), {
                bagsSentToDrying: increment(newBagsForDrying - oldBagsForDrying)
            });
        }
    });
};

export const updateBorrowing = async (db: Firestore, id: string, data: Partial<Borrowing>): Promise<void> => {
    await updateDoc(doc(db, 'borrowings', id), cleanForFirestore(data));
};

export const deleteBorrowing = async (db: Firestore, id: string): Promise<void> => {
    await deleteDoc(doc(db, 'borrowings', id));
};

export const updateLending = async (db: Firestore, id: string, data: Partial<Lending>): Promise<void> => {
    await updateDoc(doc(db, 'lendings', id), cleanForFirestore(data));
};

export const deleteLending = async (db: Firestore, id: string): Promise<void> => {
    await deleteDoc(doc(db, 'lendings', id));
};

export const updateUser = async (db: Firestore, id: string, data: Partial<AppUser>): Promise<void> => {
    await updateDoc(doc(db, 'users', id), cleanForFirestore(data));
};

export const updateManagedWarehouse = async (db: Firestore, id: string, data: Partial<ManagedWarehouse>): Promise<void> => {
    await updateDoc(doc(db, 'managedWarehouses', id), cleanForFirestore(data));
};

export const deleteManagedWarehouse = async (db: Firestore, warehouseId: string): Promise<void> => {
    const batch = writeBatch(db);
    batch.delete(doc(db, 'managedWarehouses', warehouseId));
    const snap = await getDocs(query(collection(db, 'users'), where('warehouseId', '==', warehouseId)));
    snap.forEach((d) => batch.delete(d.ref));
    await batch.commit();
};
