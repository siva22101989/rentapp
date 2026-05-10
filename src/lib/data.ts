
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

export const updateStorageRecord = async (db: Firestore, id: string, data: Partial<StorageRecord>): Promise<void> => {
    const recordRef = doc(db, 'storageRecords', id);
    await updateDoc(recordRef, cleanForFirestore(data));
};

export const deleteStorageRecord = async (db: Firestore, id: string): Promise<void> => {
    const recordRef = doc(db, 'storageRecords', id);

    await runTransaction(db, async (transaction) => {
        const recordSnap = await transaction.get(recordRef);
        if (!recordSnap.exists()) {
            return;
        }
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

        const updateData: any = {
            outflows: newOutflows,
            bagsOut: newBagsOut,
            bagsStored: newBagsStored,
            totalRentBilled: newTotalRentBilled,
            storageEndDate: null,
            billingCycle: record.billingCycle || '6-Month Initial',
        };

        transaction.update(recordRef, cleanForFirestore(updateData));
    });
};

export const editOutflowEvent = async (db: Firestore, recordId: string, outflowIndex: number, newData: { date: Date, bagsWithdrawn: number, rentBilled: number, discount: number, khataAmount?: number }): Promise<void> => {
    const recordRef = doc(db, 'storageRecords', recordId);
    
    await runTransaction(db, async (transaction) => {
        const recordSnap = await transaction.get(recordRef);
        if (!recordSnap.exists()) {
            throw new Error("Storage record not found");
        }
        const record = recordSnap.data() as StorageRecord;
        const outflows = [...(record.outflows || [])];

        if (outflowIndex < 0 || outflowIndex >= outflows.length) {
            throw new Error("Outflow event not found at the specified index.");
        }

        const oldOutflow = outflows[outflowIndex];
        
        // Calculate differences for stock and total rent
        const bagDiff = newData.bagsWithdrawn - oldOutflow.bagsWithdrawn;
        const rentDiff = newData.rentBilled - oldOutflow.rentBilled;
        
        // Update the outflow in the array
        outflows[outflowIndex] = {
            ...oldOutflow,
            date: newData.date,
            bagsWithdrawn: newData.bagsWithdrawn,
            rentBilled: newData.rentBilled,
            discount: newData.discount,
        };

        const newBagsOut = (record.bagsOut || 0) + bagDiff;
        const newBagsStored = (record.bagsIn || 0) - newBagsOut;
        const newTotalRentBilled = (record.totalRentBilled || 0) + rentDiff;

        if (newBagsStored < 0) {
            throw new Error(`Invalid quantity. Adjusting this withdrawal would exceed the total available bags (${record.bagsIn}) in Patti ${recordId}.`);
        }

        const updateData: any = {
            outflows: cleanForFirestore(outflows),
            bagsOut: newBagsOut,
            bagsStored: newBagsStored,
            totalRentBilled: newTotalRentBilled,
        };
        
        if (newData.khataAmount !== undefined) {
            updateData.khataAmount = newData.khataAmount;
        }

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

export const updateUnloadingRecord = async (db: Firestore, id: string, data: Partial<UnloadingRecord>): Promise<void> => {
    const recordRef = doc(db, 'unloadingRecords', id);
    await updateDoc(recordRef, cleanForFirestore(data));
};

export const deleteUnloadingRecord = async (db: Firestore, id: string): Promise<void> => {
    const recordRef = doc(db, 'unloadingRecords', id);
    await deleteDoc(recordRef);
};

export const deleteDryingRecord = async (db: Firestore, dryingRecordId: string): Promise<void> => {
  const dryingRecordRef = doc(db, 'dryingRecords', dryingRecordId);

  await runTransaction(db, async (transaction) => {
    const dryingRecordSnap = await transaction.get(dryingRecordRef);
    if (!dryingRecordSnap.exists()) {
      return;
    }

    const dryingRecordData = dryingRecordSnap.data() as DryingRecord;
    const unloadingRecordRef = doc(db, 'unloadingRecords', dryingRecordData.unloadingRecordId);
    
    transaction.update(unloadingRecordRef, {
      bagsSentToDrying: increment(-(dryingRecordData.bagsForDrying || 0))
    });

    transaction.delete(dryingRecordRef);
  });
};

export const updateDryingRecord = async (db: Firestore, recordId: string, oldBagsForDrying: number, data: Partial<DryingRecord>): Promise<void> => {
    const dryingRecordRef = doc(db, 'dryingRecords', recordId);
    
    await runTransaction(db, async (transaction) => {
        const dryingRecordSnap = await transaction.get(dryingRecordRef);
        if (!dryingRecordSnap.exists()) {
            throw new Error("Drying record not found.");
        }
        const dryingRecordData = dryingRecordSnap.data() as DryingRecord;

        transaction.update(dryingRecordRef, cleanForFirestore(data));

        const newBagsForDrying = data.bagsForDrying;
        if (newBagsForDrying !== undefined && newBagsForDrying !== oldBagsForDrying) {
            const unloadingRecordRef = doc(db, 'unloadingRecords', dryingRecordData.unloadingRecordId);
            const bagDifference = newBagsForDrying - oldBagsForDrying;
            
            const unloadingSnap = await transaction.get(unloadingRecordRef);
            if (unloadingSnap.exists()) {
                transaction.update(unloadingRecordRef, {
                    bagsSentToDrying: increment(bagDifference)
                });
            }
        }
    });
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
