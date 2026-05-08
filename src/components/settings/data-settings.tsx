'use client';

import { useTransition, useState, useRef } from 'react';
import { Loader2, Trash2, Download, Upload, FileSpreadsheet, ShieldCheck } from 'lucide-react';
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

const TRANSACTIONAL_COLLECTIONS = ['customers', 'storageRecords', 'expenses', 'unloadingRecords', 'dryingRecords', 'borrowings', 'lendings', 'otherIncomes'];
const ALL_DATA_COLLECTIONS = [...TRANSACTIONAL_COLLECTIONS, 'commodities', 'lots', 'warehouses'];

export function DataSettings() {
  const [isClearingCache, startClearingCacheTransition] = useTransition();
  const [isClearingDb, startClearingDbTransition] = useTransition();
  const [isExporting, startExportingTransition] = useTransition();
  const [isImporting, startImportingTransition] = useTransition();

  const [isImportAlertOpen, setIsImportAlertOpen] = useState(false);
  const [pendingImportData, setPendingImportData] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const excelInputRef = useRef<HTMLInputElement>(null);

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

  const handleExportJSON = async () => {
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
        a.download = `backup-json-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        toast({ title: 'JSON Export Complete' });
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
        for (const name of TRANSACTIONAL_COLLECTIONS) {
          const q = query(collection(firestore, name), where('warehouseId', '==', appUser.warehouseId));
          const snap = await getDocs(q);
          const rows = snap.docs.map(d => {
            const data = d.data();
            const clean: any = { id: d.id };
            Object.keys(data).forEach(k => {
              if (Array.isArray(data[k])) clean[k] = JSON.stringify(data[k]);
              else if (data[k]?.toDate) clean[k] = data[k].toDate().toISOString();
              else clean[k] = data[k];
            });
            return clean;
          });
          const ws = XLSX.utils.json_to_sheet(rows);
          XLSX.utils.book_append_sheet(wb, ws, name);
        }
        XLSX.writeFile(wb, `backup-excel-${new Date().toISOString().split('T')[0]}.xlsx`);
        toast({ title: 'Excel Export Complete' });
      } catch (error: any) {
        toast({ title: 'Excel Export Error', description: error.message, variant: 'destructive' });
      }
    });
  };

  const handleDownloadTemplate = () => {
    const wb = XLSX.utils.book_new();
    const sheets = {
        customers: [{ id: '1', name: 'Example Customer', phone: '9876543210', village: 'Village Name', fatherName: 'Father Name' }],
        storageRecords: [{ id: '1001', customerId: '1', commodityDescription: 'Paddy', location: 'A1', bagsIn: 100, storageStartDate: '2024-01-01', hamaliPayable: 500 }],
        withdrawals: [{ pattiId: '1001', date: '2024-02-01', bagsWithdrawn: 50, rentBilled: 200 }],
        payments: [{ pattiId: '1001', date: '2024-02-01', amount: 300, type: 'rent' }],
        expenses: [{ date: '2024-01-15', category: 'Petrol', description: 'Gen Set', amount: 1000 }]
    };
    Object.entries(sheets).forEach(([name, data]) => {
        const ws = XLSX.utils.json_to_sheet(data);
        XLSX.utils.book_append_sheet(wb, ws, name);
    });
    XLSX.writeFile(wb, 'GrainDost-Template.xlsx');
  };

  const handleExcelFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const data = new Uint8Array(event.target?.result as ArrayBuffer);
            const workbook = XLSX.read(data, { type: 'array' });
            const importData: any = {};
            workbook.SheetNames.forEach(name => {
                importData[name] = XLSX.utils.sheet_to_json(workbook.Sheets[name]);
            });
            setPendingImportData({ type: 'excel', data: importData });
            setIsImportAlertOpen(true);
        } catch (err: any) {
            toast({ title: 'Import Error', description: err.message, variant: 'destructive' });
        }
    };
    reader.readAsArrayBuffer(file);
  };

  const executeDeepRestore = async () => {
    if (!pendingImportData || !firestore || !appUser?.warehouseId) return;
    startImportingTransition(async () => {
        try {
            const batch = writeBatch(firestore);
            const { type, data } = pendingImportData;

            if (type === 'excel') {
                // Clear old transactional data for this warehouse first
                for (const colName of TRANSACTIONAL_COLLECTIONS) {
                    const q = query(collection(firestore, colName), where('warehouseId', '==', appUser.warehouseId));
                    const snap = await getDocs(q);
                    snap.docs.forEach(d => batch.delete(d.ref));
                }

                // Restore Customers
                if (data.customers) {
                    data.customers.forEach((c: any) => {
                        const ref = doc(firestore, 'customers', String(c.id));
                        batch.set(ref, cleanForFirestore({ ...c, warehouseId: appUser.warehouseId }));
                    });
                }

                // Restore Storage Records (Pattis)
                const pattiMap = new Map();
                if (data.storageRecords) {
                    data.storageRecords.forEach((r: any) => {
                        const cleanRecord = {
                            ...r,
                            warehouseId: appUser.warehouseId,
                            storageStartDate: new Date(r.storageStartDate),
                            payments: [],
                            outflows: [],
                            bagsOut: 0,
                            bagsStored: r.bagsIn || 0,
                            totalRentBilled: 0
                        };
                        const ref = doc(firestore, 'storageRecords', String(r.id));
                        batch.set(ref, cleanForFirestore(cleanRecord));
                        pattiMap.set(String(r.id), cleanRecord);
                    });
                }

                // Apply Withdrawals to records
                if (data.withdrawals) {
                    data.withdrawals.forEach((w: any) => {
                        const recordId = String(w.pattiId);
                        const ref = doc(firestore, 'storageRecords', recordId);
                        batch.update(ref, {
                            outflows: XLSX.utils.sheet_to_json(XLSX.utils.json_to_sheet([w])).map((item: any) => cleanForFirestore({
                                date: new Date(item.date),
                                bagsWithdrawn: Number(item.bagsWithdrawn),
                                rentBilled: Number(item.rentBilled),
                                discount: Number(item.discount || 0)
                            }))
                        });
                    });
                }

                // Apply Payments to records
                if (data.payments) {
                    data.payments.forEach((p: any) => {
                        const recordId = String(p.pattiId);
                        const ref = doc(firestore, 'storageRecords', recordId);
                        batch.update(ref, {
                            payments: XLSX.utils.sheet_to_json(XLSX.utils.json_to_sheet([p])).map((item: any) => cleanForFirestore({
                                amount: Number(item.amount),
                                date: new Date(item.date),
                                type: item.type || 'rent'
                            }))
                        });
                    });
                }
            }

            await batch.commit();
            toast({ title: 'Deep Restore Successful', description: 'Your entire history has been recovered. Reloading...' });
            setTimeout(() => window.location.reload(), 1500);
        } catch (err: any) {
            toast({ title: 'Restore Failed', description: err.message, variant: 'destructive' });
        }
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-6">
        <Card className="lg:col-span-2 border-primary/20 shadow-md">
            <CardHeader>
                <div className="flex items-center gap-3">
                    <ShieldCheck className="h-6 w-6 text-primary" />
                    <div>
                        <CardTitle>Historical Data Protection</CardTitle>
                        <CardDescription>Export and Restore your entire database. This tool repairs original dates automatically.</CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Step 1: Backup</h4>
                        <Button onClick={handleExportExcel} disabled={isExporting} className="w-full justify-start py-6" variant="outline">
                            {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSpreadsheet className="mr-2 h-5 w-5 text-green-600" />}
                            <div className="text-left">
                                <p className="font-bold">Export to Excel</p>
                                <p className="text-xs text-muted-foreground">Human-readable spreadsheet</p>
                            </div>
                        </Button>
                        <Button onClick={handleExportJSON} disabled={isExporting} className="w-full justify-start" variant="ghost" size="sm">
                            <Download className="mr-2 h-4 w-4" /> Export Technical JSON
                        </Button>
                    </div>

                    <div className="space-y-2">
                        <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Step 2: Security</h4>
                        <Button onClick={handleDownloadTemplate} variant="secondary" className="w-full justify-start py-6">
                            <FileSpreadsheet className="mr-2 h-5 w-5" />
                            <div className="text-left">
                                <p className="font-bold">Download Excel Format</p>
                                <p className="text-xs text-muted-foreground">Format for organizing old data</p>
                            </div>
                        </Button>
                    </div>
                </div>

                <Separator />

                <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Step 3: Deep Restore</h4>
                    <p className="text-xs text-muted-foreground bg-secondary/50 p-3 rounded-md border border-dashed border-primary/30">
                        <strong>Important:</strong> Restoring from a file will replace all current transactional data for your warehouse. Patti numbers, original inflow dates, and payments will be perfectly reconstructed.
                    </p>
                    <div className="flex gap-2">
                        <Button onClick={() => excelInputRef.current?.click()} disabled={isImporting} className="flex-1" variant="default">
                            {isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                            Deep Restore from Excel File
                        </Button>
                        <input type="file" ref={excelInputRef} onChange={handleExcelFileChange} className="hidden" accept=".xlsx,.xls" />
                    </div>
                </div>
            </CardContent>
        </Card>
        
        <div className="space-y-8">
            <Card className="border-orange-500/50">
                <CardHeader><CardTitle className="text-orange-600 text-base">Session Reset</CardTitle></CardHeader>
                <CardContent>
                    <Button variant="outline" className="w-full text-orange-600" onClick={handleClearCache} disabled={isClearingCache}>
                        Clear Local Cache
                    </Button>
                </CardContent>
            </Card>

            <Card className="border-destructive/50">
                <CardHeader><CardTitle className="text-destructive text-base">Danger Zone</CardTitle></CardHeader>
                <CardContent>
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive" className="w-full">Wipe Current Data</Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Permanently delete all data?</AlertDialogTitle>
                                <AlertDialogDescription>This will remove all customers and records for this warehouse. Use this before performing a Deep Restore.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => { setPendingImportData({ type: 'clear' }); executeDeepRestore(); }} className="bg-destructive" disabled={isClearingDb}>
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
                    <AlertDialogTitle>Confirm Deep Restore</AlertDialogTitle>
                    <AlertDialogDescription>
                        This will delete all current records and replace them with the data from your file. 
                        <strong> All historical dates will be preserved.</strong>
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setPendingImportData(null)}>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={executeDeepRestore} className="bg-primary">Start Deep Restore</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </div>
  );
}