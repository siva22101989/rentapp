
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
];

// Map internal collection names to User-Friendly Excel Sheet Names
const SHEET_NAMES: Record<string, string> = {
    'customers': 'Customers',
    'storageRecords': 'Storage Records',
    'unloadingRecords': 'Unloading Process',
    'expenses': 'Expenses',
    'commodities': 'Crops',
    'lots': 'Lots',
    'withdrawals': 'Withdrawals',
    'payments': 'Payments'
};

export function DataSettings() {
  const [isExporting, startExportingTransition] = useTransition();
  const [isImporting, startImportingTransition] = useTransition();
  const excelInputRef = useRef<HTMLInputElement>(null);
  const jsonInputRef = useRef<HTMLInputElement>(null);

  const firestore = useFirestore();
  const appUser = useAppUser();
  const { toast } = useToast();

  const handleExportExcel = async () => {
    if (!firestore || !appUser?.warehouseId) return;
    startExportingTransition(async () => {
      try {
        const wb = XLSX.utils.book_new();
        
        // 1. Export Standard Collections
        for (const colName of COLLECTIONS) {
          const q = query(collection(firestore, colName), where('warehouseId', '==', appUser.warehouseId));
          const snap = await getDocs(q);
          const data = snap.docs.map(d => {
              const docData = d.data();
              const flat: any = { id: d.id };
              for (const key in docData) {
                  const val = docData[key];
                  if (val && typeof val === 'object' && !Array.isArray(val)) {
                      if (val.toDate || (val.seconds !== undefined)) {
                          flat[key] = toDate(val).toISOString();
                      } else {
                          flat[key] = JSON.stringify(val);
                      }
                  } else if (Array.isArray(val)) {
                      // We will export payments and withdrawals separately
                      continue;
                  } else {
                      flat[key] = val;
                  }
              }
              return flat;
          });
          if (data.length > 0) {
              XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), SHEET_NAMES[colName] || colName);
          }
        }

        // 2. Export Flattened Withdrawals (Outflows)
        const storageQ = query(collection(firestore, 'storageRecords'), where('warehouseId', '==', appUser.warehouseId));
        const storageSnap = await getDocs(storageQ);
        const allWithdrawals: any[] = [];
        const allPayments: any[] = [];

        storageSnap.docs.forEach(d => {
            const data = d.data();
            if (data.outflows) {
                data.outflows.forEach((o: any) => allWithdrawals.push({
                    recordId: d.id,
                    date: toDate(o.date).toISOString(),
                    bagsWithdrawn: o.bagsWithdrawn,
                    rentBilled: o.rentBilled,
                    discount: o.discount || 0
                }));
            }
            if (data.payments) {
                data.payments.forEach((p: any) => allPayments.push({
                    recordId: d.id,
                    recordType: 'storage',
                    date: toDate(p.date).toISOString(),
                    amount: p.amount,
                    type: p.type || 'other'
                }));
            }
        });

        const unloadingQ = query(collection(firestore, 'unloadingRecords'), where('warehouseId', '==', appUser.warehouseId));
        const unloadingSnap = await getDocs(unloadingQ);
        unloadingSnap.docs.forEach(d => {
            const data = d.data();
            if (data.payments) {
                data.payments.forEach((p: any) => allPayments.push({
                    recordId: d.id,
                    recordType: 'unloading',
                    date: toDate(p.date).toISOString(),
                    amount: p.amount,
                    type: p.type || 'unloading'
                }));
            }
        });

        if (allWithdrawals.length > 0) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(allWithdrawals), 'Withdrawals');
        if (allPayments.length > 0) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(allPayments), 'Payments');

        XLSX.writeFile(wb, `GrainDost-Backup-${new Date().toISOString().split('T')[0]}.xlsx`);
        toast({ title: 'Export Complete', description: 'Multi-sheet Excel backup downloaded.' });
      } catch (error: any) {
        toast({ title: 'Export Error', description: error.message, variant: 'destructive' });
      }
    });
  };

  const handleDownloadTemplate = () => {
    const wb = XLSX.utils.book_new();
    
    // Customers
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{ id: 'C1', name: 'Sandeep Reddy', phone: '9160606633', village: 'Owk' }]), 'Customers');
    
    // Storage Records
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{ id: '1001', customerId: 'C1', commodityDescription: 'Paddy', location: 'A1', bagsIn: 100, bagsStored: 100, storageStartDate: '2024-05-01' }]), 'Storage Records');
    
    // Withdrawals
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{ recordId: '1001', date: '2024-06-01', bagsWithdrawn: 20, rentBilled: 500 }]), 'Withdrawals');
    
    // Payments
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{ recordId: '1001', date: '2024-06-02', amount: 500, type: 'rent' }]), 'Payments');
    
    // Other Sheets
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{ billNo: 'U101', customerId: 'C1', bagsUnloaded: 150, unloadingDate: '2024-05-01', location: 'B1' }]), 'Unloading Process');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{ name: 'Paddy', billingType: 'slab', rate6Months: 36, rate1Year: 55 }]), 'Crops');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{ name: 'A1', capacity: 1000 }]), 'Lots');

    XLSX.writeFile(wb, 'GrainDost-Format-Template.xlsx');
    toast({ title: 'Template Downloaded', description: 'Organize your data exactly like the tabs in the template.' });
  }

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
          
          const recordWithdrawals: Record<string, any[]> = {};
          const recordPayments: Record<string, any[]> = {};

          // 1. Process Flat Sheets first (Withdrawals/Payments) to gather info
          workbook.SheetNames.forEach(sheetName => {
              if (sheetName === 'Withdrawals') {
                  const rows: any[] = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
                  rows.forEach(r => {
                      if (!recordWithdrawals[r.recordId]) recordWithdrawals[r.recordId] = [];
                      recordWithdrawals[r.recordId].push({
                          date: toDate(r.date),
                          bagsWithdrawn: Number(r.bagsWithdrawn),
                          rentBilled: Number(r.rentBilled),
                          discount: Number(r.discount || 0)
                      });
                  });
              }
              if (sheetName === 'Payments') {
                  const rows: any[] = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
                  rows.forEach(r => {
                      if (!recordPayments[r.recordId]) recordPayments[r.recordId] = [];
                      recordPayments[r.recordId].push({
                          date: toDate(r.date),
                          amount: Number(r.amount),
                          type: r.type || 'other'
                      });
                  });
              }
          });

          // 2. Process Main Collection Sheets
          let totalImported = 0;
          for (const sheetName of workbook.SheetNames) {
            // Find which collection this sheet belongs to
            const colName = Object.keys(SHEET_NAMES).find(key => SHEET_NAMES[key] === sheetName) || 
                            COLLECTIONS.find(c => c.toLowerCase() === sheetName.toLowerCase());
            
            if (!colName || colName === 'withdrawals' || colName === 'payments') continue;

            const sheet = workbook.Sheets[sheetName];
            const rows: any[] = XLSX.utils.sheet_to_json(sheet);
            
            for (const row of rows) {
              const { id, billNo, ...docData } = row;
              const cleaned: any = { ...docData, warehouseId: appUser.warehouseId };
              
              // Repair dates and attach withdrawals/payments
              for (const key in cleaned) {
                  if (key.toLowerCase().includes('date')) cleaned[key] = toDate(cleaned[key]);
              }

              const docId = (colName === 'unloadingRecords' && billNo) ? String(billNo) : (id ? String(id) : null);
              
              if (colName === 'storageRecords' && docId) {
                  cleaned.outflows = recordWithdrawals[docId] || [];
                  cleaned.payments = recordPayments[docId] || [];
              }
              if (colName === 'unloadingRecords' && docId) {
                  cleaned.payments = recordPayments[docId] || [];
              }

              const ref = docId ? doc(firestore, colName, docId) : doc(collection(firestore, colName));
              batch.set(ref, cleanForFirestore(cleaned), { merge: true });
              totalImported++;
            }
          }

          await batch.commit();
          toast({ title: 'Restore Complete', description: `${totalImported} records successfully restored with original dates.` });
          setTimeout(() => window.location.reload(), 2000);
        };
        reader.readAsArrayBuffer(file);
      } catch (error: any) {
        toast({ title: 'Restore Error', description: error.message, variant: 'destructive' });
      }
    });
  };

  return (
    <div className="space-y-6 mt-6">
        <Card className="bg-primary/5 border-primary/20">
            <CardHeader className="flex flex-row items-center gap-4">
                <ShieldCheck className="h-8 w-8 text-primary" />
                <div>
                    <CardTitle>Data Protection (Excel System)</CardTitle>
                    <CardDescription>Secure your entire warehouse history. All inflow, outflow, and payment dates are preserved exactly as recorded.</CardDescription>
                </div>
            </CardHeader>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <Card>
                <CardHeader>
                    <CardTitle>Download Backup</CardTitle>
                    <CardDescription>Creates a file with separate tabs for Customers, Records, etc.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Button onClick={handleExportExcel} disabled={isExporting} className="w-full justify-start" variant="outline">
                        {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSpreadsheet className="mr-2 h-4 w-4" />}
                        Export to Multi-Sheet Excel (.xlsx)
                    </Button>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Restore from Excel</CardTitle>
                    <CardDescription>Upload your backup to rebuild your database and fix historical dates.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Button onClick={handleDownloadTemplate} variant="secondary" className="w-full justify-start">
                        <FileDown className="mr-2 h-4 w-4" />
                        Download Excel Format Template
                    </Button>

                    <Button onClick={() => excelInputRef.current?.click()} disabled={isImporting} className="w-full justify-start" variant="outline">
                        {isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                        Upload & Deep Restore from Excel
                    </Button>
                    <input type="file" ref={excelInputRef} onChange={handleImportExcel} className="hidden" accept=".xlsx,.xls" />
                </CardContent>
            </Card>
        </div>
    </div>
  );
}
