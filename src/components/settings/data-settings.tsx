'use client';

import { useTransition, useState, useRef } from 'react';
import { Loader2, Download, Upload, FileSpreadsheet, ShieldCheck, FileJson, AlertCircle, Banknote, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useFirestore, useAppUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { collection, writeBatch, getDocs, doc, query, where, updateDoc } from 'firebase/firestore';
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
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';

const TRANSACTIONAL_COLLECTIONS = ['customers', 'storageRecords', 'expenses', 'unloadingRecords', 'dryingRecords', 'borrowings', 'lendings', 'otherIncomes'];

export function DataSettings() {
  const [isExporting, startExportingTransition] = useTransition();
  const [isImporting, startImportingTransition] = useTransition();
  const [isClearing, startClearingTransition] = useTransition();

  const [isImportAlertOpen, setIsImportAlertOpen] = useState(false);
  const [importMode, setImportAlertMode] = useState<'full' | 'payments'>('full');
  const [pendingImportData, setPendingImportData] = useState<any>(null);
  
  const excelInputRef = useRef<HTMLInputElement>(null);
  const paymentsOnlyInputRef = useRef<HTMLInputElement>(null);
  const jsonInputRef = useRef<HTMLInputElement>(null);

  const firestore = useFirestore();
  const appUser = useAppUser();
  const { toast } = useToast();

  const handleExportJson = async () => {
    if (!firestore || !appUser?.warehouseId) return;
    startExportingTransition(async () => {
      try {
        const fullBackup: any = {};
        for (const colName of TRANSACTIONAL_COLLECTIONS) {
            const snap = await getDocs(query(collection(firestore, colName), where('warehouseId', '==', appUser.warehouseId)));
            fullBackup[colName] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        }
        const blob = new Blob([JSON.stringify(fullBackup, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `GrainDost-Backup-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast({ title: 'JSON Export Successful' });
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

        // 1. Customers
        const custSnap = await getDocs(query(collection(firestore, 'customers'), where('warehouseId', '==', appUser.warehouseId)));
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(custSnap.docs.map(d => ({ 
            "Customer ID": String(d.id), 
            "Name": d.data().name,
            "Phone": String(d.data().phone || ''),
            "Village": d.data().village || '',
            "Father Name": d.data().fatherName || '',
            "Address": d.data().address || ''
        }))), 'customers');

        // 2. Inflow
        const storageSnap = await getDocs(query(collection(firestore, 'storageRecords'), where('warehouseId', '==', appUser.warehouseId)));
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(storageSnap.docs.map(d => {
            const data = d.data();
            return {
                "Storage ID": String(d.id),
                "Customer ID": String(data.customerId || ''),
                "Commodity": data.commodityDescription,
                "Lot No": data.location || '',
                "Bags Received": data.bagsIn,
                "Inflow Date": toDate(data.storageStartDate).toISOString().split('T')[0],
                "Handling Rate": data.hamaliRate || 0,
                "Total Handling Billed": data.hamaliPayable || 0,
                "Khata Amount": data.khataAmount || 0,
                "Status": data.billingCycle
            };
        })), 'inflow');

        // 3. Outflow
        const outflows: any[] = [];
        storageSnap.docs.forEach(d => {
            const data = d.data();
            (data.outflows || []).forEach((o: any) => {
                outflows.push({
                    "Storage ID": String(d.id),
                    "Withdrawal Date": toDate(o.date).toISOString().split('T')[0],
                    "Bags Withdrawn": o.bagsWithdrawn,
                    "Rent Billed": o.rentBilled,
                    "Discount": o.discount || 0
                });
            });
        });
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(outflows), 'outflow');

        // 4. Unloading
        const unloadingSnap = await getDocs(query(collection(firestore, 'unloadingRecords'), where('warehouseId', '==', appUser.warehouseId)));
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(unloadingSnap.docs.map(d => {
            const data = d.data();
            return { 
                "Bill No": String(data.billNo || d.id), 
                "Customer ID": String(data.customerId || ''), 
                "Commodity": data.commodityDescription, 
                "Bags Unloaded": data.bagsUnloaded, 
                "Unloading Date": toDate(data.unloadingDate).toISOString().split('T')[0], 
                "Customer Rate": data.hamaliPerBag || 0,
                "Total Hamali": data.totalHamali 
            };
        })), 'unloading');

        // 5. Payments
        const allPayments: any[] = [];
        storageSnap.docs.forEach(d => {
            (d.data().payments || []).forEach((p: any) => {
                allPayments.push({ 
                    "Type": 'Storage', 
                    "Storage ID": String(d.id), 
                    "Amount": p.amount, 
                    "Date": toDate(p.date).toISOString().split('T')[0], 
                    "Category": p.type || 'rent' 
                });
            });
        });
        unloadingSnap.docs.forEach(d => {
            (d.data().payments || []).forEach((p: any) => {
                allPayments.push({ 
                    "Type": 'Unloading', 
                    "Storage ID": String(d.data().billNo || d.id), 
                    "Amount": p.amount, 
                    "Date": toDate(p.date).toISOString().split('T')[0], 
                    "Category": 'unloading' 
                });
            });
        });
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(allPayments), 'payments');

        XLSX.writeFile(wb, `GrainDost-Backup-${new Date().toISOString().split('T')[0]}.xlsx`);
        toast({ title: 'Excel Export Successful' });
      } catch (error: any) {
        toast({ title: 'Export Error', description: error.message, variant: 'destructive' });
      }
    });
  };

  const handleDownloadTemplate = () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{ "Customer ID": 'CUST-01', "Name": 'Customer Name', "Phone": '9876543210', "Village": 'Village', "Father Name": 'Father', "Address": 'Address' }]), 'customers');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{ "Storage ID": '1001', "Customer ID": 'CUST-01', "Commodity": 'Paddy', "Lot No": 'A1', "Bags Received": 2191, "Inflow Date": '2024-05-01', "Handling Rate": 50, "Total Handling Billed": 109550, "Khata Amount": 100, "Status": "6-Month Initial" }]), 'inflow');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{ "Storage ID": '1001', "Withdrawal Date": '2024-06-01', "Bags Withdrawn": 1000, "Rent Billed": 5000, "Discount": 0 }]), 'outflow');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{ "Bill No": 'U-01', "Customer ID": 'CUST-01', "Commodity": 'Paddy', "Bags Unloaded": 2191, "Unloading Date": '2024-05-01', "Customer Rate": 6, "Total Hamali": 13146 }]), 'unloading');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{ "Type": 'Storage', "Storage ID": '1001', "Amount": 50000, "Date": '2024-05-15', "Category": 'hamali' }]), 'payments');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{ "Ref No": 'E-01', "Category": 'Petrol', "Description": 'Fuel', "Amount": 1500, "Date": '2024-05-10' }]), 'expenses');
    XLSX.writeFile(wb, 'GrainDost-Restore-Template.xlsx');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, mode: 'full' | 'payments' | 'json') => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            if (mode === 'json') {
                const data = JSON.parse(event.target?.result as string);
                setPendingImportData(data);
                setImportAlertMode('full');
            } else {
                const data = new Uint8Array(event.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });
                const importData: any = {};
                workbook.SheetNames.forEach(name => {
                    importData[name.toLowerCase()] = XLSX.utils.sheet_to_json(workbook.Sheets[name]);
                });
                setPendingImportData(importData);
                setImportAlertMode(mode);
            }
            setIsImportAlertOpen(true);
        } catch (err: any) {
            toast({ title: 'Read Error', description: 'Invalid file format.', variant: 'destructive' });
        }
    };
    if (mode === 'json') reader.readAsText(file);
    else reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const executeDeepRestore = async () => {
    if (!pendingImportData || !firestore || !appUser?.warehouseId) return;
    startImportingTransition(async () => {
        try {
            const batch = writeBatch(firestore);
            const data = pendingImportData;
            const warehouseId = appUser.warehouseId;

            if (importMode === 'full') {
                for (const colName of TRANSACTIONAL_COLLECTIONS) {
                    const snap = await getDocs(query(collection(firestore, colName), where('warehouseId', '==', warehouseId)));
                    snap.docs.forEach(d => batch.delete(d.ref));
                }

                const storageRecordsMap: Record<string, any> = {};
                if (data.inflow) {
                    data.inflow.forEach((r: any) => {
                        const id = String(r["Storage ID"] || r.id || '').trim();
                        if (id) {
                            storageRecordsMap[id] = {
                                warehouseId,
                                customerId: String(r["Customer ID"] || '').trim(),
                                commodityDescription: String(r["Commodity"] || ''),
                                location: String(r["Lot No"] || ''),
                                bagsIn: Number(r["Bags Received"] || 0),
                                bagsOut: 0,
                                bagsStored: Number(r["Bags Received"] || 0),
                                storageStartDate: toDate(r["Inflow Date"]),
                                hamaliRate: Number(r["Handling Rate"] || 0),
                                hamaliPayable: Number(r["Total Handling Billed"] || 0),
                                khataAmount: Number(r["Khata Amount"] || 0),
                                billingCycle: String(r["Status"] || '6-Month Initial'),
                                payments: [],
                                outflows: [],
                                totalRentBilled: 0,
                            };
                        }
                    });
                }

                if (data.outflow) {
                    data.outflow.forEach((o: any) => {
                        const id = String(o["Storage ID"] || o.id || '').trim();
                        if (storageRecordsMap[id]) {
                            const bagsWithdrawn = Number(o["Bags Withdrawn"] || 0);
                            const rentBilled = Number(o["Rent Billed"] || 0);
                            const outflowDate = toDate(o["Withdrawal Date"]);
                            storageRecordsMap[id].outflows.push({ date: outflowDate, bagsWithdrawn, rentBilled, discount: Number(o["Discount"] || 0) });
                            storageRecordsMap[id].bagsOut += bagsWithdrawn;
                            storageRecordsMap[id].bagsStored -= bagsWithdrawn;
                            storageRecordsMap[id].totalRentBilled += rentBilled;
                            if (storageRecordsMap[id].bagsStored <= 0) {
                                storageRecordsMap[id].storageEndDate = outflowDate;
                                storageRecordsMap[id].billingCycle = 'Completed';
                            }
                        }
                    });
                }

                const unloadingRecordsMap: Record<string, any> = {};
                if (data.unloading) {
                    data.unloading.forEach((u: any) => {
                        const id = String(u["Bill No"] || u.id || u["Storage ID"] || '').trim();
                        const bags = Number(u["Bags Unloaded"] || 0);
                        const totalH = Number(u["Total Hamali"] || 0);
                        unloadingRecordsMap[id] = {
                            warehouseId,
                            billNo: id,
                            customerId: String(u["Customer ID"] || '').trim(),
                            commodityDescription: String(u["Commodity"] || ''),
                            bagsUnloaded: bags,
                            unloadingDate: toDate(u["Unloading Date"]),
                            totalHamali: totalH,
                            status: 'Billed',
                            bagsSentToDrying: bags,
                            hamaliPerBag: Number(u["Customer Rate"]) || (bags > 0 ? totalH / bags : 0),
                            payments: []
                        };
                    });
                }

                if (data.payments) {
                    data.payments.forEach((p: any) => {
                        const amount = Number(p["Amount"] || 0);
                        const date = toDate(p["Date"]);
                        const type = String(p["Category"] || 'rent');
                        const id = String(p["Storage ID"] || p["Bill No"] || '').trim();
                        if (p["Type"] === 'Storage' && storageRecordsMap[id]) {
                            storageRecordsMap[id].payments.push({ amount, date, type });
                        } else if (p["Type"] === 'Unloading' && unloadingRecordsMap[id]) {
                            unloadingRecordsMap[id].payments.push({ amount, date, type: 'unloading' });
                        }
                    });
                }

                Object.entries(storageRecordsMap).forEach(([id, r]) => batch.set(doc(firestore, 'storageRecords', id), cleanForFirestore(r)));
                Object.entries(unloadingRecordsMap).forEach(([id, r]) => batch.set(doc(firestore, 'unloadingRecords', id), cleanForFirestore(r)));

                if (data.customers) {
                    data.customers.forEach((c: any) => {
                        const id = String(c["Customer ID"] || c.id || '').trim();
                        if (id) batch.set(doc(firestore, 'customers', id), cleanForFirestore({ warehouseId, name: String(c["Name"] || ''), phone: String(c["Phone"] || ''), village: String(c["Village"] || ''), fatherName: String(c["Father Name"] || ''), address: String(c["Address"] || '') }));
                    });
                }

                if (data.expenses) {
                    data.expenses.forEach((e: any) => batch.set(doc(collection(firestore, 'expenses')), cleanForFirestore({ warehouseId, refNo: String(e["Ref No"] || ''), category: String(e["Category"] || 'Other'), description: String(e["Description"] || ''), amount: Number(e["Amount"] || 0), date: toDate(e["Date"]) })));
                }
            } else if (importMode === 'payments') {
                const storageSnap = await getDocs(query(collection(firestore, 'storageRecords'), where('warehouseId', '==', warehouseId)));
                const unloadingSnap = await getDocs(query(collection(firestore, 'unloadingRecords'), where('warehouseId', '==', warehouseId)));
                
                const sMap: any = {}; storageSnap.docs.forEach(d => sMap[d.id] = { ref: d.ref, payments: [] });
                const uMap: any = {}; unloadingSnap.docs.forEach(d => uMap[d.data().billNo || d.id] = { ref: d.ref, payments: [] });

                if (data.payments) {
                    data.payments.forEach((p: any) => {
                        const id = String(p["Storage ID"] || '').trim();
                        const amount = Number(p["Amount"] || 0);
                        const date = toDate(p["Date"]);
                        const type = String(p["Category"] || 'rent');

                        if (p["Type"] === 'Storage' && sMap[id]) {
                            sMap[id].payments.push({ amount, date, type });
                        } else if (p["Type"] === 'Unloading' && uMap[id]) {
                            uMap[id].payments.push({ amount, date, type: 'unloading' });
                        }
                    });
                }

                Object.values(sMap).forEach((v: any) => batch.update(v.ref, { payments: cleanForFirestore(v.payments) }));
                Object.values(uMap).forEach((v: any) => batch.update(v.ref, { payments: cleanForFirestore(v.payments) }));
            }
            
            await batch.commit();
            toast({ title: 'Operation Successful' });
            setIsImportAlertOpen(false);
            setPendingImportData(null);
        } catch (err: any) {
            console.error("Restore Error:", err);
            toast({ title: 'Operation Failed', description: err.message, variant: 'destructive' });
        }
    });
  };

  return (
    <Card className="max-w-4xl mx-auto border-primary/20 shadow-md mt-6">
        <CardHeader className="bg-secondary/30">
            <div className="flex items-center gap-3">
                <ShieldCheck className="h-6 w-6 text-primary" />
                <div>
                    <CardTitle className="text-xl">Historical Data Protection</CardTitle>
                    <CardDescription>Export and Restore using Storage IDs to perfectly rebuild your godown history.</CardDescription>
                </div>
            </div>
        </CardHeader>
        <CardContent className="space-y-8 pt-6">
            <div className="space-y-4">
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Step 1: Backup</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Button onClick={handleExportExcel} disabled={isExporting} variant="outline" className="h-auto py-4 px-6 justify-start">
                         <div className="bg-green-100 p-2 rounded-lg mr-4"><FileSpreadsheet className="h-5 w-5 text-green-600" /></div>
                        <div className="text-left">
                            <p className="font-bold text-sm">Export Excel</p>
                            <p className="text-xs text-muted-foreground">All worksheets</p>
                        </div>
                    </Button>
                    <Button onClick={handleExportJson} disabled={isExporting} variant="outline" className="h-auto py-4 px-6 justify-start">
                         <div className="bg-blue-100 p-2 rounded-lg mr-4"><FileJson className="h-5 w-5 text-blue-600" /></div>
                        <div className="text-left">
                            <p className="font-bold text-sm">Export JSON</p>
                            <p className="text-xs text-muted-foreground">Technical data dump</p>
                        </div>
                    </Button>
                </div>
            </div>

            <div className="space-y-4">
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Step 2: Security</h4>
                <Button onClick={handleDownloadTemplate} variant="outline" className="w-full h-auto py-4 px-6 justify-start border-dashed">
                    <div className="bg-slate-100 p-2 rounded-lg mr-4"><Download className="h-5 w-5 text-slate-600" /></div>
                    <div className="text-left">
                        <p className="font-bold text-sm">Download Master Template</p>
                        <p className="text-xs text-muted-foreground">Required Excel format for full restoration</p>
                    </div>
                </Button>
            </div>

            <div className="space-y-4 pt-4">
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Step 3: Deep Restore</h4>
                <Alert className="bg-muted/40 border-dashed">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle className="text-xs font-bold">Warning:</AlertTitle>
                    <AlertDescription className="text-xs text-muted-foreground">
                        Full Restore will erase current data and reconstruct your history using the IDs in your file.
                    </AlertDescription>
                </Alert>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Button onClick={() => excelInputRef.current?.click()} disabled={isImporting} className="w-full h-12 text-sm font-bold">
                        {isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                        Full Excel Restore
                    </Button>
                    <input type="file" ref={excelInputRef} onChange={(e) => handleFileChange(e, 'full')} className="hidden" accept=".xlsx,.xls" />

                    <Button onClick={() => paymentsOnlyInputRef.current?.click()} disabled={isImporting} variant="secondary" className="w-full h-12 text-sm font-bold">
                         <History className="mr-2 h-4 w-4" />
                        Update Payments Only
                    </Button>
                    <input type="file" ref={paymentsOnlyInputRef} onChange={(e) => handleFileChange(e, 'payments')} className="hidden" accept=".xlsx,.xls" />
                </div>
            </div>

            <Separator />
            <div className="flex justify-center pt-2">
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button variant="link" className="text-destructive text-xs hover:no-underline">Factory Reset (Wipe All Data)</Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                            <AlertDialogDescription>Permanently delete every record. This cannot be undone.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => {
                                if (!firestore || !appUser?.warehouseId) return;
                                startClearingTransition(async () => {
                                    const batch = writeBatch(firestore);
                                    for (const colName of TRANSACTIONAL_COLLECTIONS) {
                                        const snap = await getDocs(query(collection(firestore, colName), where('warehouseId', '==', appUser.warehouseId)));
                                        snap.docs.forEach(d => batch.delete(d.ref));
                                    }
                                    await batch.commit();
                                    toast({ title: 'Database Wiped' });
                                });
                            }} className="bg-destructive text-destructive-foreground">Confirm Wipe</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </CardContent>

        <AlertDialog open={isImportAlertOpen} onOpenChange={setIsImportAlertOpen}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>{importMode === 'full' ? 'Execute Full Data Reconstruction?' : 'Update Payments History?'}</AlertDialogTitle>
                    <AlertDialogDescription>
                        {importMode === 'full' 
                            ? 'All current data will be replaced with the records in your file. Storage IDs will be preserved.' 
                            : 'This will update payment history for existing Storage IDs found in your Excel file. Other data remains unchanged.'}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => { setPendingImportData(null); setIsImportAlertOpen(false); }}>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={executeDeepRestore}>Execute Restore</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </Card>
  );
}
