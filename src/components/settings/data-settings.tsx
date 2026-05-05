'use client';

import { useTransition, useState, useRef } from 'react';
import { Loader2, Trash2, Download, Upload, FileText } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useFirestore, useAppUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { collection, writeBatch, getDocs, doc, query, where, getDoc, updateDoc } from 'firebase/firestore';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { cleanForFirestore } from '@/lib/utils';
import { Separator } from '../ui/separator';
import type { Customer } from '@/lib/definitions';

const TRANSACTIONAL_COLLECTIONS = ['customers', 'storageRecords', 'expenses', 'unloadingRecords', 'dryingRecords', 'borrowings', 'lendings', 'otherIncomes'];
const ALL_DATA_COLLECTIONS = [...TRANSACTIONAL_COLLECTIONS, 'commodities', 'lots', 'warehouses'];

export function DataSettings() {
  const [isClearingCache, startClearingCacheTransition] = useTransition();
  const [isClearingDb, startClearingDbTransition] = useTransition();
  const [isExporting, startExportingTransition] = useTransition();
  const [isImporting, startImportingTransition] = useTransition();

  const [dataToImport, setDataToImport] = useState<{ customersToCreate: Omit<Customer, 'id'>[], storageRecords: any[] } | null>(null);
  const [isImportAlertOpen, setIsImportAlertOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const firestore = useFirestore();
  const appUser = useAppUser();
  const { toast } = useToast();

  const handleClearCache = () => {
    startClearingCacheTransition(() => {
        try {
            localStorage.clear();
            sessionStorage.clear();
            toast({ title: 'Cache Cleared', description: 'Reloading...' });
            setTimeout(() => window.location.reload(), 1000);
        } catch (error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        }
    });
  };

  const clearData = async (collectionsToClear: string[]) => {
    if (!firestore || !appUser?.warehouseId) throw new Error('Context missing.');
    let deletedCount = 0;
    for (const name of collectionsToClear) {
      const q = query(collection(firestore, name), where('warehouseId', '==', appUser.warehouseId));
      const snap = await getDocs(q);
      const batches = [];
      for (let i = 0; i < snap.docs.length; i += 500) {
        const batch = writeBatch(firestore);
        snap.docs.slice(i, i + 500).forEach(d => batch.delete(d.ref));
        batches.push(batch.commit());
      }
      await Promise.all(batches);
      deletedCount += snap.size;
    }
    return deletedCount;
  }

  const handleClearDatabase = async () => {
    startClearingDbTransition(async () => {
        try {
            await clearData(TRANSACTIONAL_COLLECTIONS);
            toast({ title: 'Success', description: 'Data cleared. Reloading...' });
            setTimeout(() => window.location.reload(), 1000);
        } catch (error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        }
    });
  };

  const handleExportData = async () => {
    if (!firestore || !appUser?.warehouseId) return;
    startExportingTransition(async () => {
      try {
        const data: any = {};
        for (const name of ALL_DATA_COLLECTIONS) {
          const q = query(collection(firestore, name), where('warehouseId', '==', appUser.warehouseId));
          const snap = await getDocs(q);
          data[name] = snap.docs.map(d => ({ ...d.data(), id: d.id }));
        }
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `backup-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        toast({ title: 'Export Complete' });
      } catch (error: any) {
        toast({ title: 'Export Error', description: error.message, variant: 'destructive' });
      }
    });
  };

  const handleImportClick = () => fileInputRef.current?.click();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const text = e.target?.result as string;
            const lines = text.trim().split(/\r?\n/);
            const header = lines.shift()?.split(',').map(h => h.trim()) || [];
            const customersMap = new Map<string, any>();
            const storageRecords: any[] = [];
            for (const line of lines) {
                const values = line.split(',');
                const row = header.reduce((obj, key, i) => ({ ...obj, [key]: values[i]?.trim() }), {} as any);
                if (!row.customer_name) continue;
                if (!customersMap.has(row.customer_name.toLowerCase())) {
                    customersMap.set(row.customer_name.toLowerCase(), {
                        name: row.customer_name, phone: row.customer_phone || '', 
                        fatherName: row.customer_father_name || '', village: row.customer_village || ''
                    });
                }
                if (row.record_id) {
                    storageRecords.push({ ...row, bagsIn: Number(row.bags_in), bagsStored: Number(row.bags_in) });
                }
            }
            setDataToImport({ customersToCreate: Array.from(customersMap.values()), storageRecords });
            setIsImportAlertOpen(true);
        } catch (error: any) {
            toast({ title: 'Import Error', description: error.message, variant: 'destructive'});
        }
    };
    reader.readAsText(file);
  };
  
  const handleConfirmImport = async () => {
    if (!dataToImport || !firestore || !appUser?.warehouseId) return;
    startImportingTransition(async () => {
      try {
        await clearData(TRANSACTIONAL_COLLECTIONS);
        const batch = writeBatch(firestore);
        const nameIdMap = new Map();
        for (const c of dataToImport.customersToCreate) {
            const ref = doc(collection(firestore, 'customers'));
            batch.set(ref, cleanForFirestore({ ...c, warehouseId: appUser.warehouseId }));
            nameIdMap.set(c.name.toLowerCase(), ref.id);
        }
        for (const r of dataToImport.storageRecords) {
            const cid = nameIdMap.get(r.customer_name.toLowerCase());
            if (cid) {
                const ref = doc(firestore, 'storageRecords', r.record_id);
                batch.set(ref, cleanForFirestore({
                    warehouseId: appUser.warehouseId, customerId: cid,
                    commodityDescription: r.commodity_description, location: r.location,
                    bagsIn: r.bagsIn, bagsOut: 0, bagsStored: r.bagsIn,
                    storageStartDate: new Date(r.storage_start_date),
                    billingCycle: '6-Month Initial', totalRentBilled: 0, payments: []
                }));
            }
        }
        await batch.commit();
        toast({ title: 'Import Success', description: 'Reloading...' });
        setTimeout(() => window.location.reload(), 1500);
      } catch (error: any) {
        toast({ title: 'Import Failed', description: error.message, variant: 'destructive'});
      }
    });
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-6">
        <Card>
            <CardHeader>
                <CardTitle>Data Management</CardTitle>
                <CardDescription>Export backups or import data from CSV.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <Button onClick={handleExportData} disabled={isExporting} className="w-full justify-start" variant="outline">
                    {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                    Export All Data as JSON
                </Button>
                <Separator />
                <Button onClick={handleImportClick} disabled={isImporting} className="w-full justify-start" variant="outline">
                    {isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                    Import from Excel CSV
                </Button>
                <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".csv" />
            </CardContent>
        </Card>
        
        <div className="space-y-8">
            <Card className="border-orange-500/50">
                <CardHeader><CardTitle className="text-orange-600 text-base">Reset Local Browser Session</CardTitle></CardHeader>
                <CardContent>
                    <Button variant="outline" className="w-full text-orange-600" onClick={handleClearCache} disabled={isClearingCache}>
                        Clear Local Cache
                    </Button>
                </CardContent>
            </Card>

            <Card className="border-destructive/50">
                <CardHeader><CardTitle className="text-destructive text-base">Danger Zone: Wipe Warehouse Data</CardTitle></CardHeader>
                <CardContent>
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive" className="w-full">Wipe All Transactional Data</Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Delete everything?</AlertDialogTitle>
                                <AlertDialogDescription>This will remove all customers and records for this warehouse. Setup (Crops/Lots) remains.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={handleClearDatabase} className="bg-destructive" disabled={isClearingDb}>
                                    Delete Now
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </CardContent>
            </Card>
        </div>
        
        <AlertDialog open={isImportAlertOpen} onOpenChange={setIsImportAlertOpen}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Confirm Overwrite</AlertDialogTitle>
                    <AlertDialogDescription>Importing will clear existing records. Continue?</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setDataToImport(null)}>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleConfirmImport} className="bg-destructive">Start Import</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </div>
  );
}
