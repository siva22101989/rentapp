'use client';

import { useTransition, useRef } from 'react';
import { Loader2, Download, Upload, FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useFirestore, useAppUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { collection, writeBatch, getDocs, doc, query, where, setDoc } from 'firebase/firestore';
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const firestore = useFirestore();
  const appUser = useAppUser();
  const { toast } = useToast();

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
              // Flatten or stringify complex objects for Excel
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
        toast({ title: 'Export Complete', description: 'Excel file downloaded.' });
      } catch (error: any) {
        toast({ title: 'Export Error', description: error.message, variant: 'destructive' });
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
              
              // Restore complex objects and dates
              for (const key in cleaned) {
                const val = cleaned[key];
                if (typeof val === 'string') {
                    if (val.startsWith('[') || val.startsWith('{')) {
                        try {
                            const parsed = JSON.parse(val);
                            // Deep check for dates in arrays (like payments)
                            if (Array.isArray(parsed)) {
                                cleaned[key] = parsed.map(item => {
                                    if (item.date) return { ...item, date: toDate(item.date) };
                                    return item;
                                });
                            } else {
                                cleaned[key] = parsed;
                            }
                        } catch { /* not json */ }
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
          toast({ title: 'Import Success', description: `${totalImported} records restored. Page will reload.` });
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
                <CardTitle>Data Backup & Restore</CardTitle>
                <CardDescription>Download your entire database to Excel or restore from a previous file.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <Button onClick={handleExportExcel} disabled={isExporting} className="w-full justify-start" variant="outline">
                    {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                    Export Full History to Excel
                </Button>
                <Separator />
                <Button onClick={() => fileInputRef.current?.click()} disabled={isImporting} className="w-full justify-start" variant="outline">
                    {isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSpreadsheet className="mr-2 h-4 w-4" />}
                    Restore from Excel Backup
                </Button>
                <input type="file" ref={fileInputRef} onChange={handleImportExcel} className="hidden" accept=".xlsx,.xls" />
            </CardContent>
        </Card>
        
        <Card className="border-destructive/50">
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
                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                            <AlertDialogDescription>This will delete all customers, records, expenses, and payments. This cannot be undone.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction className="bg-destructive" onClick={async () => {
                                if (!firestore || !appUser?.warehouseId) return;
                                const colls = ['customers', 'storageRecords', 'unloadingRecords', 'expenses', 'payments', 'outflows'];
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