'use client';

import { useTransition, useState, useRef } from 'react';
import { Loader2, Download, Upload, FileSpreadsheet, ShieldCheck, FileJson, AlertCircle, Database } from 'lucide-react';
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
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';

const TRANSACTIONAL_COLLECTIONS = ['customers', 'storageRecords', 'expenses', 'unloadingRecords', 'dryingRecords', 'borrowings', 'lendings', 'otherIncomes'];

export function DataSettings() {
  const [isExporting, startExportingTransition] = useTransition();
  const [isImporting, startImportingTransition] = useTransition();
  const [isClearing, startClearingTransition] = useTransition();

  const [isImportAlertOpen, setIsImportAlertOpen] = useState(false);
  const [pendingImportData, setPendingImportData] = useState<any>(null);
  const excelInputRef = useRef<HTMLInputElement>(null);
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
        
        toast({ title: 'JSON Export Successful', description: 'Technical data dump saved.' });
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

        // 2. Inflow (Godown Inventory)
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

        // 3. Outflow (Withdrawal History)
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

        // 4. Unloading (Truck Register)
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
                    "Customer ID": String(d.data().customerId || ''), 
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
                    "Bill No": String(d.data().billNo || d.id), 
                    "Customer ID": String(d.data().customerId || ''), 
                    "Amount": p.amount, 
                    "Date": toDate(p.date).toISOString().split('T')[0], 
                    "Category": 'unloading' 
                });
            });
        });
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(allPayments), 'payments');

        // 6. Expenses
        const expSnap = await getDocs(query(collection(firestore, 'expenses'), where('warehouseId', '==', appUser.warehouseId)));
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(expSnap.docs.map(d => {
            const data = d.data();
            return {
                "Ref No": String(data.refNo || ''),
                "Category": data.category,
                "Description": data.description,
                "Amount": data.amount,
                "Date": toDate(data.date).toISOString().split('T')[0]
            };
        })), 'expenses');

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
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{ "Type": 'Storage', "Storage ID": '1001', "Customer ID": 'CUST-01', "Amount": 50000, "Date": '2024-05-15', "Category": 'hamali' }]), 'payments');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{ "Ref No": 'E-01', "Category": 'Petrol', "Description": 'Fuel', "Amount": 1500, "Date": '2024-05-10' }]), 'expenses');
    XLSX.writeFile(wb, 'GrainDost-Restore-Template.xlsx');
  };

  const handleJsonFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const data = JSON.parse(event.target?.result as string);
            setPendingImportData(data);
            setIsImportAlertOpen(true);
        } catch (err: any) {
            toast({ title: 'Read Error', description: 'Invalid JSON file format.', variant: 'destructive' });
        }
    };
    reader.readAsText(file);
    e.target.value = '';
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
                importData[name.toLowerCase()] = XLSX.utils.sheet_to_json(workbook.Sheets[name]);
            });
            setPendingImportData(importData);
            setIsImportAlertOpen(true);
        } catch (err: any) {
            toast({ title: 'Read Error', description: 'Invalid Excel file format.', variant: 'destructive' });
        }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const executeDeepRestore = async () => {
    if (!pendingImportData || !firestore || !appUser?.warehouseId) return;
    startImportingTransition(async () => {
        try {
            const batch = writeBatch(firestore);
            const data = pendingImportData;
            const warehouseId = appUser.warehouseId;

            // 1. Wipe current transactional data
            for (const colName of TRANSACTIONAL_COLLECTIONS) {
                const snap = await getDocs(query(collection(firestore, colName), where('warehouseId', '==', warehouseId)));
                snap.docs.forEach(d => batch.delete(d.ref));
            }

            // 2. Restore Customers
            if (data.customers && Array.isArray(data.customers)) {
                data.customers.forEach((c: any) => {
                    const id = String(c["Customer ID"] || c.id || '').trim();
                    if (id) {
                        const { "Customer ID": _id, id: _id2, warehouseId: _wh, ...rest } = c;
                        batch.set(doc(firestore, 'customers', id), cleanForFirestore({ ...rest, warehouseId }));
                    }
                });
            }

            // 3. Prepare Storage Records Map
            const storageRecordsMap: Record<string, any> = {};
            if (data.inflow && Array.isArray(data.inflow)) {
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

            // 4. Restore Outflows (Withdrawals)
            if (data.outflow && Array.isArray(data.outflow)) {
                data.outflow.forEach((o: any) => {
                    const id = String(o["Storage ID"] || o.id || '').trim();
                    if (storageRecordsMap[id]) {
                        const bagsWithdrawn = Number(o["Bags Withdrawn"] || 0);
                        const rentBilled = Number(o["Rent Billed"] || 0);
                        const outflowDate = toDate(o["Withdrawal Date"]);
                        
                        storageRecordsMap[id].outflows.push({
                            date: outflowDate,
                            bagsWithdrawn: bagsWithdrawn,
                            rentBilled: rentBilled,
                            discount: Number(o["Discount"] || 0)
                        });
                        
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

            // 5. Restore Payments
            if (data.payments && Array.isArray(data.payments)) {
                data.payments.forEach((p: any) => {
                    const amount = Number(p["Amount"] || 0);
                    const date = toDate(p["Date"]);
                    const type = String(p["Category"] || 'rent');

                    if (p["Type"] === 'Storage' && p["Storage ID"]) {
                        const id = String(p["Storage ID"]).trim();
                        if (storageRecordsMap[id]) {
                            storageRecordsMap[id].payments.push({ amount, date, type });
                        }
                    }
                });
            }

            // Write all reconstructed Storage Records
            Object.entries(storageRecordsMap).forEach(([id, r]) => {
                batch.set(doc(firestore, 'storageRecords', id), cleanForFirestore(r));
            });

            // 6. Restore Unloading Records
            if (data.unloading && Array.isArray(data.unloading)) {
                data.unloading.forEach((u: any) => {
                    const id = String(u["Bill No"] || u.id || '').trim();
                    const bags = Number(u["Bags Unloaded"] || 0);
                    const totalH = Number(u["Total Hamali"] || 0);
                    const record = {
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
                    batch.set(doc(firestore, 'unloadingRecords', id), cleanForFirestore(record));
                });
            }

            // 7. Restore Expenses
            if (data.expenses && Array.isArray(data.expenses)) {
                data.expenses.forEach((e: any) => {
                    const expense = {
                        warehouseId,
                        refNo: String(e["Ref No"] || ''),
                        category: String(e["Category"] || 'Other'),
                        description: String(e["Description"] || ''),
                        amount: Number(e["Amount"] || 0),
                        date: toDate(e["Date"]),
                    };
                    batch.set(doc(collection(firestore, 'expenses')), cleanForFirestore(expense));
                });
            }
            
            await batch.commit();
            toast({ title: 'Data Reconstruction Successful', description: 'Your warehouse history has been rebuilt.' });
            setIsImportAlertOpen(false);
            setPendingImportData(null);
        } catch (err: any) {
            console.error("Restore Error:", err);
            toast({ title: 'Restore Failed', description: err.message, variant: 'destructive' });
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
                         <div className="bg-green-100 p-2 rounded-lg mr-4">
                            <FileSpreadsheet className="h-5 w-5 text-green-600" />
                        </div>
                        <div className="text-left">
                            <p className="font-bold text-sm">Export Excel</p>
                            <p className="text-xs text-muted-foreground">Organized worksheets</p>
                        </div>
                    </Button>
                    <Button onClick={handleExportJson} disabled={isExporting} variant="outline" className="h-auto py-4 px-6 justify-start">
                         <div className="bg-blue-100 p-2 rounded-lg mr-4">
                            <FileJson className="h-5 w-5 text-blue-600" />
                        </div>
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
                    <div className="bg-slate-100 p-2 rounded-lg mr-4">
                        <Download className="h-5 w-5 text-slate-600" />
                    </div>
                    <div className="text-left">
                        <p className="font-bold text-sm">Download Excel Restore Template</p>
                        <p className="text-xs text-muted-foreground">Required format for Step 3</p>
                    </div>
                </Button>
            </div>

            <div className="space-y-4 pt-4">
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Step 3: Deep Restore</h4>
                <Alert className="bg-muted/40 border-dashed">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle className="text-xs font-bold">Warning:</AlertTitle>
                    <AlertDescription className="text-xs text-muted-foreground">
                        Deep Restore will delete all existing transactional data and reconstruct it using the IDs and worksheets from your file.
                    </AlertDescription>
                </Alert>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Button onClick={() => excelInputRef.current?.click()} disabled={isImporting} className="w-full h-12 text-sm font-bold">
                        {isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                        Restore from Excel
                    </Button>
                    <input type="file" ref={excelInputRef} onChange={handleExcelFileChange} className="hidden" accept=".xlsx,.xls" />

                    <Button onClick={() => jsonInputRef.current?.click()} disabled={isImporting} variant="secondary" className="w-full h-12 text-sm font-bold">
                         <Database className="mr-2 h-4 w-4" />
                        Restore from JSON
                    </Button>
                    <input type="file" ref={jsonInputRef} onChange={handleJsonFileChange} className="hidden" accept=".json" />
                </div>
            </div>

            <Separator />
            <div className="flex justify-center pt-2">
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button variant="link" className="text-destructive text-xs hover:no-underline">
                            Factory Reset (Wipe All Data)
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                                This will permanently delete every record for your warehouse. This cannot be undone.
                            </AlertDialogDescription>
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
                    <AlertDialogTitle>Execute Data Reconstruction?</AlertDialogTitle>
                    <AlertDialogDescription>
                        All current transactional data will be erased and replaced with the records in your file. Storage IDs will be preserved.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => { setPendingImportData(null); setIsImportAlertOpen(false); }}>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={executeDeepRestore}>Execute Deep Restore</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </Card>
  );
}
