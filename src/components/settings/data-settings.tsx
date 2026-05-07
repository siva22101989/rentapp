'use client';

import { useTransition, useRef } from 'react';
import { Loader2, Download, Upload, FileSpreadsheet, FileJson, ShieldCheck, FileDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useFirestore, useAppUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { collection, writeBatch, getDocs, doc, query, where } from 'firebase/firestore';
import { cleanForFirestore, toDate } from '@/lib/utils';
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
                      } else if (Array.isArray(val)) {
                          flat[key] = JSON.stringify(val);
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

  const handleDownloadTemplate = () => {
    const wb = XLSX.utils.book_new();
    
    // Customers Sheet
    const custData = [
        { id: 'CUST-1', name: 'M.yellaya', phone: '9963368248', fatherName: '', village: 'Koilakuntla road owk', address: '' },
        { id: 'CUST-2', name: 'Bala muni', phone: '9177942110', fatherName: '', village: 'Metupalle', address: '' }
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(custData), 'customers');

    // Storage Records Sheet
    const storageData = [
        { id: '1001', customerId: 'CUST-1', commodityDescription: 'Paddy', location: 'A1', bagsIn: 100, bagsStored: 100, storageStartDate: '2024-01-15', hamaliPayable: 1200, workerHamaliPayable: 1000, billingCycle: '6-Month Initial' }
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(storageData), 'storageRecords');

    XLSX.writeFile(wb, 'GrainDost-Data-Template.xlsx');
    toast({ title: 'Template Downloaded', description: 'Fill the id column in customers and use it in customerId for records.' });
  }

  const repairDates = (obj: any) => {
      if (!obj || typeof obj !== 'object') return;
      for (const key in obj) {
          const val = obj[key];
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
                    setTimeout(() => window.location.reload(), 1500);
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
                        } catch { }
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
          setTimeout(() => window.location.reload(), 1500);
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
                    <Button onClick={handleDownloadTemplate} variant="secondary" className="w-full justify-start">
                        <FileDown className="mr-2 h-4 w-4" />
                        Download Excel Format (Recommended)
                    </Button>

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
        </div>
    </div>
  );
}