'use client';

import { useTransition, useRef } from 'react';
import { Loader2, Download, Upload, FileSpreadsheet, FileJson } from 'lucide-react';
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

  // --- EXPORT LOGIC ---

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

  // --- IMPORT LOGIC ---

  const handleImportJSON = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !firestore || !appUser?.warehouseId) return;

    startImportingTransition(async () => {
        try {
            const reader = new FileReader();
            reader.onload = async (e) => {
                const data = JSON.parse(e.target?.result as string);
                const batch = writeBatch(firestore);
                let total = 0;

                for (const colName in data) {
                    if (!COLLECTIONS.includes(colName)) continue;
                    const items = data[colName];
                    for (const item of items) {
                        const { id, ...rest } = item;
                        const cleaned = { ...rest, warehouseId: appUser.warehouseId };
                        
                        // Repair nested dates (payments, outflows, etc)
                        if (Array.isArray(cleaned.payments)) {
                            cleaned.payments = cleaned.payments.map((p: any) => ({ ...p, date: toDate(p.date) }));
                        }
                        if (Array.isArray(cleaned.outflows)) {
                            cleaned.outflows = cleaned.outflows.map((o: any) => ({ ...o, date: toDate(o.date) }));
                        }
                        if (cleaned.storageStartDate) cleaned.storageStartDate = toDate(cleaned.storageStartDate);
                        if (cleaned.storageEndDate) cleaned.storageEndDate = toDate(cleaned.storageEndDate);
                        if (cleaned.unloadingDate) cleaned.unloadingDate = toDate(cleaned.unloadingDate);

                        const ref = id ? doc(firestore, colName, String(id)) : doc(collection(firestore, colName));
                        batch.set(ref, cleanForFirestore(cleaned), { merge: true });
                        total++;
                    }
                }
                await batch.commit();
                toast({ title: 'Import Success', description: `${total} records restored.` });
                setTimeout(() => window.location.reload(), 2000);
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
                            if (Array.isArray(parsed)) {
                                cleaned[key] = parsed.map(item => {
                                    if (item.date) return { ...item, date: toDate(item.date) };
                                    return item;
                                });
                            } else {
                                cleaned[key] = parsed;
                            }
                        } catch { }
                    } else if (!isNaN(Date.parse(val)) && val.includes('-')) {
                        cleaned[key] = new Date(val);
                    }
                }
              }
              const ref = id ? doc(firestore, sheetName, String(id)) : doc(collection(firestore, sheetName));
              batch.set(ref, cleanForFirestore(cleaned), { merge: true });
              totalImported++;
            }
          }
          await batch.commit();
          toast({ title: 'Import Success', description: `${totalImported} records restored.` });
          setTimeout(() => window.location.reload(), 2000);
        };
        reader.readAsArrayBuffer(file);
      } catch (error: any) {
        toast({ title: 'Import Error', description: error.message, variant: 'destructive' });
      }
    });
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-6">
        <Card>
            <CardHeader>
                <CardTitle>Data Backup (Export)</CardTitle>
                <CardDescription>Save your data to your local device.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <Button onClick={handleExportExcel} disabled={isExporting} className="w-full justify-start" variant="outline">
                    {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSpreadsheet className="mr-2 h-4 w-4" />}
                    Export Full Backup to Excel
                </Button>
                <Button onClick={handleExportJSON} disabled={isExporting} className="w-full justify-start" variant="outline">
                    {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileJson className="mr-2 h-4 w-4" />}
                    Export Full Backup to JSON
                </Button>
            </CardContent>
        </Card>

        <Card>
            <CardHeader>
                <CardTitle>Data Restore (Import)</CardTitle>
                <CardDescription>Restore data from a backup file. Existing records will be merged.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <Button onClick={() => excelInputRef.current?.click()} disabled={isImporting} className="w-full justify-start" variant="outline">
                    {isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                    Restore from Excel Backup
                </Button>
                <input type="file" ref={excelInputRef} onChange={handleImportExcel} className="hidden" accept=".xlsx,.xls" />

                <Button onClick={() => jsonInputRef.current?.click()} disabled={isImporting} className="w-full justify-start" variant="outline">
                    {isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                    Restore from JSON Backup
                </Button>
                <input type="file" ref={jsonInputRef} onChange={handleImportJSON} className="hidden" accept=".json" />
            </CardContent>
        </Card>
        
        <Card className="md:col-span-2 border-destructive/50">
            <CardHeader>
                <CardTitle className="text-destructive text-base">Danger Zone</CardTitle>
                <CardDescription>Permanently remove data from this warehouse.</CardDescription>
            </CardHeader>
            <CardContent>
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button variant="destructive" className="w-full">Clear Transactional Data</Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                            <AlertDialogDescription>This will delete all customers, storage records, unloading records, expenses, and payments. THIS CANNOT BE UNDONE.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction className="bg-destructive" onClick={async () => {
                                if (!firestore || !appUser?.warehouseId) return;
                                const colls = ['customers', 'storageRecords', 'unloadingRecords', 'dryingRecords', 'expenses', 'borrowings', 'lendings', 'otherIncomes'];
                                for (const name of colls) {
                                    const q = query(collection(firestore, name), where('warehouseId', '==', appUser.warehouseId));
                                    const snap = await getDocs(q);
                                    const batch = writeBatch(firestore);
                                    snap.docs.forEach(d => batch.delete(d.ref));
                                    await batch.commit();
                                }
                                window.location.reload();
                            }}>Delete Everything</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </CardContent>
        </Card>
    </div>
  );
}
