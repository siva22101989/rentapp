'use client';

import { useTransition, useRef } from 'react';
import { Loader2, Download, Upload, FileSpreadsheet, FileJson, ShieldCheck, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useFirestore, useAppUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { collection, writeBatch, getDocs, doc, query, where } from 'firebase/firestore';
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
import * as XLSX from 'xlsx';

const COLLECTIONS = [
    'customers', 
    'storageRecords', 
    'unloadingRecords', 
    'dryingRecords', 
    'expenses', 
    'borrowings', 
    'lendings', 
    'otherIncomes',
    'commodities',
    'lots',
    'warehouses'
];

export function DataSettings() {
  const [isExporting, startExportingTransition] = useTransition();
  const [isImporting, startImportingTransition] = useTransition();
  const excelInputRef = useRef<HTMLInputElement>(null);
  const jsonInputRef = useRef<HTMLInputElement>(null);

  const firestore = useFirestore();
  const appUser = useAppUser();
  const { toast } = useToast();

  const handleExportJSON = async () => {
    if (!firestore || !appUser?.warehouseId) return;
    startExportingTransition(async () => {
      try {
        const fullData: any = {};
        for (const name of COLLECTIONS) {
          const q = query(collection(firestore, name), where('warehouseId', '==', appUser.warehouseId));
          const snap = await getDocs(q);
          fullData[name] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        }
        
        const blob = new Blob([JSON.stringify(fullData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `GrainDost-Backup-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        toast({ title: 'Export Complete', description: 'JSON backup downloaded.' });
      } catch (error: any) {
        toast({ title: 'Export Error', description: error.message, variant: 'destructive' });
      }
    });
  };

  const handleExportExcel = async () => {
    if (!firestore || !appUser?.warehouseId) return;
    startExportingTransition(async () => {
      try {
        const wb = XLSX.utils.book_new();
        for (const name of COLLECTIONS) {
          const q = query(collection(firestore, name), where('warehouseId', '==', appUser.warehouseId));
          const snap = await getDocs(q);
          const data = snap.docs.map(d => {
              const docData = d.data();
              const flat: any = { id: d.id };
              for (const key in docData) {
                  const val = docData[key];
                  if (val && typeof val === 'object') {
                      if (val.toDate || (val.seconds !== undefined)) {
                          flat[key] = toDate(val).toISOString();
                      } else {
                          flat[key] = JSON.stringify(val);
                      }
                  } else {
                      flat[key] = val;
                  }
              }
              return flat;
          });
          if (data.length > 0) {
              const ws = XLSX.utils.json_to_sheet(data);
              XLSX.utils.book_append_sheet(wb, ws, name);
          }
        }
        XLSX.writeFile(wb, `GrainDost-Backup-${new Date().toISOString().split('T')[0]}.xlsx`);
        toast({ title: 'Export Complete', description: 'Excel backup downloaded.' });
      } catch (error: any) {
        toast({ title: 'Export Error', description: error.message, variant: 'destructive' });
      }
    });
  };

  const repairDates = (obj: any) => {
      if (!obj || typeof obj !== 'object') return;
      for (const key in obj) {
          const val = obj[key];
          // Check if key implies a date or if value looks like a serial number/ISO string
          if (key.toLowerCase().includes('date') || key === 'storageStartDate' || key === 'storageEndDate') {
              obj[key] = toDate(val);
          } else if (Array.isArray(val)) {
              val.forEach(repairDates);
          } else if (typeof val === 'object') {
              repairDates(val);
          }
      }
  };

  const handleImportJSON = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !firestore || !appUser?.warehouseId) return;

    startImportingTransition(async () => {
        try {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const data = JSON.parse(e.target?.result as string);
                    const batch = writeBatch(firestore);
                    let total = 0;

                    for (const colName in data) {
                        if (!COLLECTIONS.includes(colName)) continue;
                        const items = data[colName];
                        for (const item of items) {
                            const { id, ...rest } = item;
                            const cleaned = { ...rest, warehouseId: appUser.warehouseId };
                            repairDates(cleaned);

                            const ref = id ? doc(firestore, colName, String(id)) : doc(collection(firestore, colName));
                            batch.set(ref, cleanForFirestore(cleaned), { merge: true });
                            total++;
                        }
                    }
                    await batch.commit();
                    toast({ title: 'Import Success', description: `${total} records restored from JSON.` });
                    setTimeout(() => window.location.reload(), 2000);
                } catch (err: any) {
                    toast({ title: 'JSON Error', description: 'Failed to parse JSON file.', variant: 'destructive' });
                }
            };
            reader.readAsText(file);
        } catch (error: any) {
            toast({ title: 'Import Error', description: error.message, variant: 'destructive' });
        }
    });
  };

  const handleImportExcel = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !firestore || !appUser?.warehouseId) return;

    startImportingTransition(async () => {
      try {
        const reader = new FileReader();
        reader.onload = async (e) => {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const batch = writeBatch(firestore);
          let totalImported = 0;

          for (const sheetName of workbook.SheetNames) {
            if (!COLLECTIONS.includes(sheetName)) continue;
            const sheet = workbook.Sheets[sheetName];
            const rows: any[] = XLSX.utils.sheet_to_json(sheet);
            for (const row of rows) {
              const { id, ...docData } = row;
              const cleaned: any = { ...docData, warehouseId: appUser.warehouseId };
              
              for (const key in cleaned) {
                const val = cleaned[key];
                if (typeof val === 'string') {
                    if (val.startsWith('[') || val.startsWith('{')) {
                        try {
                            const parsed = JSON.parse(val);
                            repairDates(parsed);
                            cleaned[key] = parsed;
                        } catch { 
                            // Not JSON, treat as string
                        }
                    } else if (key.toLowerCase().includes('date') || key === 'storageStartDate' || key === 'storageEndDate') {
                        cleaned[key] = toDate(val);
                    }
                } else if (typeof val === 'number') {
                    if (key.toLowerCase().includes('date') || key === 'storageStartDate' || key === 'storageEndDate') {
                        cleaned[key] = toDate(val);
                    }
                }
              }
              const ref = id ? doc(firestore, sheetName, String(id)) : doc(collection(firestore, sheetName));
              batch.set(ref, cleanForFirestore(cleaned), { merge: true });
              totalImported++;
            }
          }
          await batch.commit();
          toast({ title: 'Import Success', description: `${totalImported} records restored from Excel.` });
          setTimeout(() => window.location.reload(), 2000);
        };
        reader.readAsArrayBuffer(file);
      } catch (error: any) {
        toast({ title: 'Import Error', description: error.message, variant: 'destructive' });
      }
    });
  };

  return (
    <div className="space-y-6 mt-6">
        <Card className="bg-primary/5 border-primary/20">
            <CardHeader className="flex flex-row items-center gap-4">
                <ShieldCheck className="h-8 w-8 text-primary" />
                <div>
                    <CardTitle>Data Protection & Recovery</CardTitle>
                    <CardDescription>Always keep a local backup. Use these tools to restore your historical records while preserving original dates.</CardDescription>
                </div>
            </CardHeader>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <Card>
                <CardHeader>
                    <CardTitle>Create Backup (Export)</CardTitle>
                    <CardDescription>Save your database as a readable Excel file or technical JSON file.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Button onClick={handleExportExcel} disabled={isExporting} className="w-full justify-start" variant="outline">
                        {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSpreadsheet className="mr-2 h-4 w-4" />}
                        Export to Excel (.xlsx)
                    </Button>
                    <Button onClick={handleExportJSON} disabled={isExporting} className="w-full justify-start" variant="outline">
                        {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileJson className="mr-2 h-4 w-4" />}
                        Export to JSON (.json)
                    </Button>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Restore Data (Import)</CardTitle>
                    <CardDescription>Upload your backup file. Our system will repair date formats to ensure accurate rent calculations.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Button onClick={() => excelInputRef.current?.click()} disabled={isImporting} className="w-full justify-start" variant="outline">
                        {isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                        Restore from Excel
                    </Button>
                    <input type="file" ref={excelInputRef} onChange={handleImportExcel} className="hidden" accept=".xlsx,.xls" />

                    <Button onClick={() => jsonInputRef.current?.click()} disabled={isImporting} className="w-full justify-start" variant="outline">
                        {isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                        Restore from JSON
                    </Button>
                    <input type="file" ref={jsonInputRef} onChange={handleImportJSON} className="hidden" accept=".json" />
                </CardContent>
            </Card>
            
            <Card className="md:col-span-2 border-destructive/30">
                <CardHeader className="flex flex-row items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                    <CardTitle className="text-destructive text-base">Danger Zone</CardTitle>
                </CardHeader>
                <CardContent>
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive" className="w-full sm:w-auto">Clear All Transactional Data</Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>WARNING: Permanent Deletion</AlertDialogTitle>
                                <AlertDialogDescription>
                                    This will delete all customers, storage records, unloading records, and payments. This cannot be undone. Please ensure you have a backup first.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={async () => {
                                    if (!firestore || !appUser?.warehouseId) return;
                                    const colls = ['customers', 'storageRecords', 'unloadingRecords', 'dryingRecords', 'expenses', 'borrowings', 'lendings', 'otherIncomes'];
                                    for (const name of colls) {
                                        const q = query(collection(firestore, name), where('warehouseId', '==', appUser.warehouseId));
                                        const snap = await getDocs(q);
                                        const batch = writeBatch(firestore);
                                        snap.docs.forEach(d => batch.delete(d.ref));
                                        await batch.commit();
                                    }
                                    toast({ title: "Data Cleared", description: "All warehouse transactions have been deleted." });
                                    setTimeout(() => window.location.reload(), 1500);
                                }}>Delete Everything Permanently</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </CardContent>
            </Card>
        </div>
    </div>
  );
}
