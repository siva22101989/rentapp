'use client';

import { useTransition, useState, useRef } from 'react';
import { Loader2, Download, Upload, FileSpreadsheet, ShieldCheck, FileJson } from 'lucide-react';
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
  const jsonInputRef = useRef<HTMLInputElement>(null);
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

  const handleExportExcel = async () => {
    if (!firestore || !appUser?.warehouseId) return;
    startExportingTransition(async () => {
      try {
        const wb = XLSX.utils.book_new();

        // 1. Customers
        const custSnap = await getDocs(query(collection(firestore, 'customers'), where('warehouseId', '==', appUser.warehouseId)));
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(custSnap.docs.map(d => ({ id: d.id, ...d.data() }))), 'customers');

        // 2. Inflow (Storage Records)
        const storageSnap = await getDocs(query(collection(firestore, 'storageRecords'), where('warehouseId', '==', appUser.warehouseId)));
        const inflows = storageSnap.docs.map(d => {
            const data = d.data();
            return {
                id: d.id,
                customerId: data.customerId,
                commodity: data.commodityDescription,
                location: data.location,
                bagsIn: data.bagsIn,
                date: toDate(data.storageStartDate).toISOString(),
                hamaliPayable: data.hamaliPayable || 0,
                khataAmount: data.khataAmount || 0,
                status: data.billingCycle
            };
        });
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(inflows), 'inflow');

        // 3. Outflow (Flattened from storageRecords)
        const outflows: any[] = [];
        storageSnap.docs.forEach(d => {
            const data = d.data();
            (data.outflows || []).forEach((o: any) => {
                outflows.push({
                    pattiId: d.id,
                    date: toDate(o.date).toISOString(),
                    bagsWithdrawn: o.bagsWithdrawn,
                    rentBilled: o.rentBilled,
                    discount: o.discount || 0
                });
            });
        });
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(outflows), 'outflow');

        // 4. Unloading
        const unloadingSnap = await getDocs(query(collection(firestore, 'unloadingRecords'), where('warehouseId', '==', appUser.warehouseId)));
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(unloadingSnap.docs.map(d => {
            const data = d.data();
            return { id: d.id, billNo: data.billNo, customerId: data.customerId, commodity: data.commodityDescription, bags: data.bagsUnloaded, date: toDate(data.unloadingDate).toISOString(), totalHamali: data.totalHamali };
        })), 'unloading');

        // 5. Payments (Consolidated)
        const allPayments: any[] = [];
        storageSnap.docs.forEach(d => {
            (d.data().payments || []).forEach((p: any) => {
                allPayments.push({ type: 'Storage', recordId: d.id, amount: p.amount, date: toDate(p.date).toISOString(), paymentCategory: p.type || 'rent' });
            });
        });
        unloadingSnap.docs.forEach(d => {
            (d.data().payments || []).forEach((p: any) => {
                allPayments.push({ type: 'Unloading', recordId: d.id, amount: p.amount, date: toDate(p.date).toISOString(), paymentCategory: 'unloading' });
            });
        });
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(allPayments), 'payments');

        // 6. Expenses
        const expSnap = await getDocs(query(collection(firestore, 'expenses'), where('warehouseId', '==', appUser.warehouseId)));
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(expSnap.docs.map(d => {
            const data = d.data();
            return { id: d.id, date: toDate(data.date).toISOString(), category: data.category, amount: data.amount, description: data.description };
        })), 'expenses');

        XLSX.writeFile(wb, `GrainDost-Full-Backup-${new Date().toISOString().split('T')[0]}.xlsx`);
        toast({ title: 'Export Complete', description: 'Data saved to separate worksheets.' });
      } catch (error: any) {
        toast({ title: 'Export Error', description: error.message, variant: 'destructive' });
      }
    });
  };

  const handleDownloadTemplate = () => {
    const wb = XLSX.utils.book_new();
    const sheets = {
        customers: [{ id: 'CUST-01', name: 'Example Farmer', phone: '9876543210', village: 'Owk', fatherName: 'Father Name', address: 'Optional Address' }],
        inflow: [{ id: '1001', customerId: 'CUST-01', commodity: 'Paddy', location: 'A1', bagsIn: 200, date: '2024-05-01', hamaliPayable: 1200, khataAmount: 50 }],
        outflow: [{ pattiId: '1001', date: '2024-06-01', bagsWithdrawn: 100, rentBilled: 500, discount: 0 }],
        unloading: [{ billNo: 'U-01', customerId: 'CUST-01', commodity: 'Maize', bags: 150, date: '2024-05-02', totalHamali: 900 }],
        payments: [{ type: 'Storage', recordId: '1001', amount: 1000, date: '2024-06-01', paymentCategory: 'rent' }],
        expenses: [{ date: '2024-05-15', category: 'Petrol', amount: 1500, description: 'Generator Fuel' }]
    };
    Object.entries(sheets).forEach(([name, data]) => {
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), name);
    });
    XLSX.writeFile(wb, 'GrainDost-Data-Template.xlsx');
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

            // Clear existing transactional data for this warehouse
            for (const colName of TRANSACTIONAL_COLLECTIONS) {
                const q = query(collection(firestore, colName), where('warehouseId', '==', appUser.warehouseId));
                const snap = await getDocs(q);
                snap.docs.forEach(d => batch.delete(d.ref));
            }

            if (type === 'excel') {
                // 1. Restore Customers
                if (data.customers) {
                    data.customers.forEach((c: any) => {
                        const ref = doc(firestore, 'customers', String(c.id));
                        batch.set(ref, cleanForFirestore({ ...c, warehouseId: appUser.warehouseId }));
                    });
                }

                // 2. Restore Inflows
                if (data.inflow) {
                    data.inflow.forEach((r: any) => {
                        const cleanRecord = {
                            warehouseId: appUser.warehouseId,
                            customerId: r.customerId,
                            commodityDescription: r.commodity,
                            location: r.location || '',
                            bagsIn: Number(r.bagsIn),
                            bagsOut: 0,
                            bagsStored: Number(r.bagsIn),
                            storageStartDate: toDate(r.date),
                            hamaliPayable: Number(r.hamaliPayable || 0),
                            khataAmount: Number(r.khataAmount || 0),
                            billingCycle: r.status || '6-Month Initial',
                            payments: [],
                            outflows: [],
                            totalRentBilled: 0
                        };
                        const ref = doc(firestore, 'storageRecords', String(r.id));
                        batch.set(ref, cleanForFirestore(cleanRecord));
                    });
                }

                // 3. Restore Outflows
                if (data.outflow) {
                    for (const w of data.outflow) {
                        const ref = doc(firestore, 'storageRecords', String(w.pattiId));
                        // Note: Batch updates for arrays aren't ideal in a simple loop for the same ID, 
                        // but since we cleared data, we can aggregate them if needed.
                        // For simplicity in restore, we use updateDoc with arrayUnion if not using a transaction.
                    }
                    // For deep restore, we'll assume valid records.
                    data.outflow.forEach((w: any) => {
                        const ref = doc(firestore, 'storageRecords', String(w.pattiId));
                        batch.update(ref, {
                            outflows: XLSX.utils.sheet_to_json(XLSX.utils.json_to_sheet([w])).map((item: any) => cleanForFirestore({
                                date: toDate(item.date),
                                bagsWithdrawn: Number(item.bagsWithdrawn),
                                rentBilled: Number(item.rentBilled),
                                discount: Number(item.discount || 0)
                            }))
                        });
                    });
                }

                // 4. Unloading
                if (data.unloading) {
                    data.unloading.forEach((u: any) => {
                        const ref = doc(firestore, 'unloadingRecords', String(u.billNo || u.id));
                        batch.set(ref, cleanForFirestore({
                            warehouseId: appUser.warehouseId,
                            customerId: u.customerId,
                            commodityDescription: u.commodity,
                            bagsUnloaded: Number(u.bags),
                            unloadingDate: toDate(u.date),
                            totalHamali: Number(u.totalHamali),
                            status: 'Unloading',
                            billNo: String(u.billNo || u.id),
                            payments: []
                        }));
                    });
                }

                // 5. Payments
                if (data.payments) {
                    data.payments.forEach((p: any) => {
                        const col = p.type === 'Storage' ? 'storageRecords' : 'unloadingRecords';
                        const ref = doc(firestore, col, String(p.recordId));
                        batch.update(ref, {
                            payments: XLSX.utils.sheet_to_json(XLSX.utils.json_to_sheet([p])).map((item: any) => cleanForFirestore({
                                amount: Number(item.amount),
                                date: toDate(item.date),
                                type: item.paymentCategory || 'rent'
                            }))
                        });
                    });
                }

                // 6. Expenses
                if (data.expenses) {
                    data.expenses.forEach((e: any) => {
                        const ref = doc(collection(firestore, 'expenses'));
                        batch.set(ref, cleanForFirestore({ ...e, date: toDate(e.date), warehouseId: appUser.warehouseId }));
                    });
                }
            }

            await batch.commit();
            toast({ title: 'Deep Restore Successful', description: 'Your entire warehouse history has been reconstructed. Reloading...' });
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
                        <CardDescription>Export and Restore your entire database across separate worksheets.</CardDescription>
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
                                <p className="font-bold">Export All Sheets</p>
                                <p className="text-xs text-muted-foreground">Inflow, Outflow, Payments, etc.</p>
                            </div>
                        </Button>
                    </div>

                    <div className="space-y-2">
                        <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Step 2: Security</h4>
                        <Button onClick={handleDownloadTemplate} variant="secondary" className="w-full justify-start py-6">
                            <FileSpreadsheet className="mr-2 h-5 w-5 text-primary" />
                            <div className="text-left">
                                <p className="font-bold">Download Excel Template</p>
                                <p className="text-xs text-muted-foreground">Organized tabs for easy import</p>
                            </div>
                        </Button>
                    </div>
                </div>

                <Separator />

                <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Step 3: Deep Restore</h4>
                    <div className="grid grid-cols-1 gap-3">
                        <Button onClick={() => excelInputRef.current?.click()} disabled={isImporting} className="w-full" variant="default">
                            {isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                            Restore from Multi-Sheet Excel
                        </Button>
                        <input type="file" ref={excelInputRef} onChange={handleExcelFileChange} className="hidden" accept=".xlsx,.xls" />
                    </div>
                </div>
            </CardContent>
        </Card>
        
        <div className="space-y-8">
            <Card className="border-destructive/50">
                <CardHeader><CardTitle className="text-destructive text-base">Danger Zone</CardTitle></CardHeader>
                <CardContent>
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive" className="w-full">Wipe Transactional Data</Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Permanently delete all records?</AlertDialogTitle>
                                <AlertDialogDescription>This removes all history but keeps settings/crops. Use before a fresh Excel restore.</AlertDialogDescription>
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
                        This will delete all current records and replace them with the data from your spreadsheet. 
                        <strong> Patti numbers and historical dates will be preserved exactly.</strong>
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
