'use client';

import { useTransition, useState, useRef } from 'react';
import { Loader2, Trash2, Download, Upload, FileText, Info } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useFirestore } from '@/firebase/provider';
import { useToast } from '@/hooks/use-toast';
import { collection, writeBatch, getDocs, doc } from 'firebase/firestore';
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
import { cleanForFirestore, toDate } from '@/lib/utils';
import { Separator } from '../ui/separator';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';

const TRANSACTIONAL_COLLECTIONS = ['customers', 'storageRecords', 'expenses', 'unloadingRecords', 'dryingRecords', 'borrowings', 'lendings', 'otherIncomes'];
const SETUP_COLLECTIONS = ['commodities', 'lots', 'settings'];

export function DataSettings() {
  const [isClearingDb, startClearingDbTransition] = useTransition();
  const [isExporting, startExportingTransition] = useTransition();
  const [isImporting, startImportingTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const firestore = useFirestore();
  const { toast } = useToast();

  const clearData = async (collectionsToClear: string[]) => {
    if (!firestore) throw new Error('Firestore not initialized.');
    let deletedCount = 0;
    for (const collectionName of collectionsToClear) {
      const snapshot = await getDocs(collection(firestore, collectionName));
      if (snapshot.empty) continue;
      const batches = [];
      for (let i = 0; i < snapshot.docs.length; i += 500) {
        const batch = writeBatch(firestore);
        snapshot.docs.slice(i, i + 500).forEach(doc => batch.delete(doc.ref));
        batches.push(batch.commit());
      }
      await Promise.all(batches);
      deletedCount += snapshot.size;
    }
    return deletedCount;
  }

  const handleExportData = async () => {
    if (!firestore) return;
    startExportingTransition(async () => {
      try {
        const data: { [key: string]: any[] } = {};
        for (const col of [...TRANSACTIONAL_COLLECTIONS, ...SETUP_COLLECTIONS]) {
          const snapshot = await getDocs(collection(firestore, col));
          data[col] = snapshot.docs.map(d => ({ ...d.data(), id: d.id }));
        }
        const jsonString = JSON.stringify(data, (k, v) => (v?.toDate ? v.toDate().toISOString() : v), 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `warehouse-backup-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        toast({ title: 'Success', description: 'Data exported as JSON.' });
      } catch (error: any) {
        toast({ title: 'Export Error', description: error.message, variant: 'destructive' });
      }
    });
  };

  const handleImportClick = () => fileInputRef.current?.click();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !firestore) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      startImportingTransition(async () => {
        try {
          const data = JSON.parse(e.target?.result as string);
          await clearData(TRANSACTIONAL_COLLECTIONS);
          const batch = writeBatch(firestore);
          
          for (const colName of Object.keys(data)) {
             data[colName].forEach((item: any) => {
                const { id, ...rest } = item;
                const docRef = doc(firestore, colName, id || undefined);
                batch.set(docRef, cleanForFirestore(rest));
             });
          }
          await batch.commit();
          toast({ title: 'Import Successful', description: 'Database restored. Reloading...' });
          setTimeout(() => window.location.reload(), 1500);
        } catch (error: any) {
          toast({ title: 'Import Error', description: error.message, variant: 'destructive'});
        }
      });
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-6">
        <Card>
            <CardHeader>
                <CardTitle>Data Backup & Restoration</CardTitle>
                <CardDescription>Secure your database with JSON backups. Use these to restore your app to a previous state.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <Alert variant="destructive" className="bg-orange-50 border-orange-200">
                    <Info className="h-4 w-4 text-orange-600" />
                    <AlertTitle className="text-orange-800">Historical Date Protection</AlertTitle>
                    <AlertDescription className="text-orange-700">These tools preserve all historical inflow, outflow, and payment dates (e.g. 1.5.26) for accurate rent calculations.</AlertDescription>
                </Alert>
                <Button onClick={handleExportData} disabled={isExporting} className="w-full justify-start" variant="outline">
                    {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />} Full Backup as JSON
                </Button>
                <Button onClick={handleImportClick} disabled={isImporting} className="w-full justify-start" variant="outline">
                    {isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />} Restore from JSON File
                </Button>
                <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".json" />
            </CardContent>
        </Card>
        
        <Card className="border-destructive/50">
            <CardHeader>
                <CardTitle className="text-destructive">System Reset</CardTitle>
                <CardDescription>Permanently remove transactional data while keeping warehouse configuration (lots, commodities).</CardDescription>
            </CardHeader>
            <CardContent>
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="lg" className="w-full">
                            <Trash2 className="mr-2 h-4 w-4" /> Clear Transactional Data
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                            <AlertDialogDescription>This will delete all Customers, Bills, and Payments. Your Warehouse setup and Roles will remain intact.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={async () => {
                                startClearingDbTransition(async () => {
                                    await clearData(TRANSACTIONAL_COLLECTIONS);
                                    window.location.reload();
                                });
                            }} className="bg-destructive">Clear Data</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </CardContent>
        </Card>
    </div>
  );
}
