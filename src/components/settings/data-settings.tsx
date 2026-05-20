'use client';

import { useTransition, useState, useRef } from 'react';
import { Loader2, Download, Upload, FileSpreadsheet, ShieldCheck, FileJson, AlertCircle, History } from 'lucide-react';
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
        }))), 'Customers');

        // 2. Storage Records
        const storageSnap = await getDocs(query(collection(firestore, 'storageRecords'), where('warehouseId', '==', appUser.warehouseId)));
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(storageSnap.docs.map(d => {
            const data = d.data();
            return {
                "Storage ID": String(d.id),
                "Customer ID": String(data.customerId || ''),
                "Commodity": data.commodityDescription,
                "Inflow Type": data.inflowType || 'Direct',
                "Lot No": data.location || '',
                "Inflow Date": toDate(data.storageStartDate).toISOString().split('T')[0],
                "Direct Inflow Bags": data.bagsForDrying || data.bagsIn,
                "Godown Bags (Final Stacked)": data.bagsIn,
                "Handling Rate": data.hamaliRate || 0,
                "Total Handling Billed": data.hamaliPayable || 0,
                "Khata Amount": data.khataAmount || 0,
                "Status": data.billingCycle
            };
        })), 'Storage Records');

        // 3. Withdrawals
        const withdrawals: any[] = [];
        storageSnap.docs.forEach(d => {
            const data = d.data();
            (data.outflows || []).forEach((o: any, idx: number) => {
                withdrawals.push({
                    "Patti No": `${d.id}-${idx + 1}`,
                    "Parent Storage ID": String(d.id),
                    "Withdrawal Date": toDate(o.date).toISOString().split('T')[0],
                    "Bags Withdrawn": o.bagsWithdrawn,
                    "Rent Billed": o.rentBilled,
                    "Discount": o.discount || 0
                });
            });
        });
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(withdrawals), 'Withdrawals');

        // 4. Unloading Records
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
        })), 'Unloading Records');

        // 5. Stock Movements
        const movements: any[] = [];
        storageSnap.docs.forEach(d => {
            const data = d.data();
            movements.push({ "Date": toDate(data.storageStartDate).toISOString().split('T')[0], "Type": 'IN', "Ref": d.id, "Bags": data.bagsIn, "Commodity": data.commodityDescription });
            (data.outflows || []).forEach((o: any) => {
                movements.push({ "Date": toDate(o.date).toISOString().split('T')[0], "Type": 'OUT', "Ref": d.id, "Bags": o.bagsWithdrawn, "Commodity": data.commodityDescription });
            });
        });
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(movements.sort((a,b) => a.Date.localeCompare(b.Date))), 'Stock Movements');

        // 6. Payments
        const allPayments: any[] = [];
        storageSnap.docs.forEach(d => {
            (d.data().payments || []).forEach((p: any) => {
                allPayments.push({ "Type": 'Storage', "Storage ID": String(d.id), "Amount": p.amount, "Date": toDate(p.date).toISOString().split('T')[0], "Category": p.type || 'rent' });
            });
        });
        unloadingSnap.docs.forEach(d => {
            (d.data().payments || []).forEach((p: any) => {
                allPayments.push({ "Type": 'Unloading', "Storage ID": String(d.data().billNo || d.id), "Amount": p.amount, "Date": toDate(p.date).toISOString().split('T')[0], "Category": 'unloading' });
            });
        });
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(allPayments), 'Payments');

        // 7. Expenses
        const expSnap = await getDocs(query(collection(firestore, 'expenses'), where('warehouseId', '==', appUser.warehouseId)));
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(expSnap.docs.map(d => ({
            "Ref No": d.data().refNo || '',
            "Date": toDate(d.data().date).toISOString().split('T')[0],
            "Category": d.data().category,
            "Description": d.data().description,
            "Amount": d.data().amount
        }))), 'Expenses');

        XLSX.writeFile(wb, `GrainDost-Master-Export-${new Date().toISOString().split('T')[0]}.xlsx`);
        toast({ title: 'Excel Export Successful' });
      } catch (error: any) {
        toast({ title: 'Export Error', description: error.message, variant: 'destructive' });
      }
    });
  };

  const handleDownloadTemplate = () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{ "Customer ID": 'C-101', "Name": 'Customer Name', "Phone": '9876543210', "Village": 'Village', "Father Name": 'Father', "Address": 'Address' }]), 'Customers');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{ "Storage ID": '1001', "Customer ID": 'C-101', "Commodity": 'Paddy', "Inflow Type": "Direct", "Lot No": 'A1', "Inflow Date": '2024-05-01', "Direct Inflow Bags": 2191, "Godown Bags (Final Stacked)": 2191, "Handling Rate": 50, "Total Handling Billed": 109550, "Khata Amount": 100, "Status": "6-Month Initial" }]), 'Storage Records');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{ "Patti No": '1001-1', "Parent Storage ID": '1001', "Withdrawal Date": '2024-06-01', "Bags Withdrawn": 1000, "Rent Billed": 5000, "Discount": 0 }]), 'Withdrawals');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{ "Bill No": 'U-1001', "Customer ID": 'C-101', "Commodity": 'Paddy', "Bags Unloaded": 2191, "Unloading Date": '2024-05-01', "Customer Rate": 6, "Total Hamali": 13146 }]), 'Unloading Records');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{ "Type": 'Storage', "Storage ID": '1001', "Amount": 50000, "Date": '2024-05-15', "Category": 'hamali' }]), 'Payments');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{ "Ref No": 'E-1001', "Category": 'Petrol', "Description": 'Generator Fuel', "Amount": 1500, "Date": '2024-05-10' }]), 'Expenses');
    XLSX.writeFile(wb, 'GrainDost-Master-Restore-Template.xlsx');
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
                const storageSheet = data['storage records'] || data.inflow;
                if (storageSheet) {
                    storageSheet.forEach((r: any) => {
                        const id = String(r["Storage ID"] || r.id || '').trim();
                        if (id) {
                            storageRecordsMap[id] = {
                                warehouseId,
                                customerId: String(r["Customer ID"] || '').trim(),
                                commodityDescription: String(r["Commodity"] || ''),
                                location: String(r["Lot No"] || ''),
                                bagsIn: Number(r["Godown Bags (Final Stacked)"] || r["Bags Received"] || 0),
                                bagsForDrying: Number(r["Direct Inflow Bags"] || 0),
                                bagsOut: 0,
                                bagsStored: Number(r["Godown Bags (Final Stacked)"] || r["Bags Received"] || 0),
                                storageStartDate: toDate(r["Inflow Date"]),
                                inflowType: r["Inflow Type"] || 'Direct',
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

                const withdrawalSheet = data.withdrawals || data.outflow;
                if (withdrawalSheet) {
                    withdrawalSheet.forEach((o: any) => {
                        const id = String(o["Parent Storage ID"] || o["Storage ID"] || '').trim();
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
                const unloadingSheet = data['unloading records'] || data.unloading;
                if (unloadingSheet) {
                    unloadingSheet.forEach((u: any) => {
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

                const paymentsSheet = data.payments;
                if (paymentsSheet) {
                    paymentsSheet.forEach((p: any) => {
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
                    data.expenses.forEach((e: any) => {
                        const expRef = doc(collection(firestore, 'expenses'));
                        batch.set(expRef, cleanForFirestore({ warehouseId, refNo: String(e["Ref No"] || ''), category: String(e["Category"] || 'Other'), description: String(e["Description"] || ''), amount: Number(e["Amount"] || 0), date: toDate(e["Date"]) }));
                    });
                }
            } else if (importMode === 'payments') {
                const storageSnap = await getDocs(query(collection(firestore, 'storageRecords'), where('warehouseId', '==', warehouseId)));
                const unloadingSnap = await getDocs(query(collection(firestore, 'unloadingRecords'), where('warehouseId', '==', warehouseId)));
                
                const sMap: any = {}; storageSnap.docs.forEach(d => sMap[d.id] = { ref: d.ref, payments: d.data().payments || [] });
                const uMap: any = {}; unloadingSnap.docs.forEach(d => {
                    const billNo = String(d.data().billNo || d.id).trim();
                    uMap[billNo] = { ref: d.ref, payments: d.data().payments || [] };
                });

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
            toast({ title: 'Restore Complete', description: 'History ledger has been rebuilt successfully.' });
            setIsImportAlertOpen(false);
            setPendingImportData(null);
        } catch (err: any) {
            console.error("Restore failed:", err);
            toast({ title: 'Operation Failed', description: err.message, variant: 'destructive' });
        }
    });
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

  return (
    <Card className="max-w-4xl mx-auto border-primary/20 shadow-md mt-6">
        <CardHeader className="bg-secondary/30 border-b">
            <div className="flex items-center gap-3">
                <ShieldCheck className="h-6 w-6 text-primary" />
                <div>
                    <CardTitle className="text-xl">History Reconstruction Console</CardTitle>
                    <CardDescription>Professional tools to manage, export, and reconstruct your warehouse audit history.</CardDescription>
                </div>
            </div>
        </CardHeader>
        <CardContent className="space-y-8 pt-8">
            <div className="space-y-4">
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 text-slate-600 text-[10px]">1</span>
                    Step 1: Status Snapshots
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Button onClick={handleExportExcel} disabled={isExporting} variant="outline" className="h-auto py-5 px-6 justify-start hover:border-green-500 hover:bg-green-50/50 group transition-all">
                         <div className="bg-green-100 p-2.5 rounded-xl mr-5 group-hover:scale-110 transition-transform"><FileSpreadsheet className="h-6 w-6 text-green-600" /></div>
                        <div className="text-left">
                            <p className="font-black text-sm text-slate-800 uppercase tracking-tighter">Export All to Excel</p>
                            <p className="text-[10px] text-muted-foreground font-bold uppercase">7-Sheet Audit Ledger</p>
                        </div>
                    </Button>
                    <Button onClick={handleExportJson} disabled={isExporting} variant="outline" className="h-auto py-5 px-6 justify-start hover:border-blue-500 hover:bg-blue-50/50 group transition-all">
                         <div className="bg-blue-100 p-2.5 rounded-xl mr-5 group-hover:scale-110 transition-transform"><FileJson className="h-6 w-6 text-blue-600" /></div>
                        <div className="text-left">
                            <p className="font-black text-sm text-slate-800 uppercase tracking-tighter">Technical JSON Backup</p>
                            <p className="text-[10px] text-muted-foreground font-bold uppercase">Full Database Snapshot</p>
                        </div>
                    </Button>
                </div>
            </div>

            <div className="space-y-4">
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 text-slate-600 text-[10px]">2</span>
                    Step 2: Restoration Templates
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Button onClick={handleDownloadTemplate} variant="outline" className="h-auto py-5 px-6 justify-start border-dashed hover:border-slate-900 group transition-all">
                        <div className="bg-slate-100 p-2.5 rounded-xl mr-5 group-hover:bg-slate-900 transition-colors"><Download className="h-6 w-6 text-slate-600 group-hover:text-white" /></div>
                        <div className="text-left">
                            <p className="font-black text-sm text-slate-800 uppercase tracking-tighter">Master Excel Template</p>
                            <p className="text-[10px] text-muted-foreground font-bold uppercase">Ledger Reconstruction Format</p>
                        </div>
                    </Button>
                    <Button onClick={() => XLSX.writeFile(XLSX.utils.book_new(), 'GrainDost-Payments-Only-Template.xlsx')} variant="outline" className="h-auto py-5 px-6 justify-start border-dashed hover:border-slate-900 group transition-all">
                        <div className="bg-slate-100 p-2.5 rounded-xl mr-5 group-hover:bg-slate-900 transition-colors"><Download className="h-6 w-6 text-slate-600 group-hover:text-white" /></div>
                        <div className="text-left">
                            <p className="font-black text-sm text-slate-800 uppercase tracking-tighter">Payments Only Template</p>
                            <p className="text-[10px] text-muted-foreground font-bold uppercase">Cash History Migration Only</p>
                        </div>
                    </Button>
                </div>
            </div>

            <div className="space-y-4 pt-4 border-t-2 border-slate-100">
                <h4 className="text-xs font-black text-primary uppercase tracking-[0.2em] flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary text-[10px]">3</span>
                    Step 3: Deep Restore Actions
                </h4>
                
                <Alert className="bg-primary/5 border-primary/20 rounded-xl">
                    <AlertCircle className="h-4 w-4 text-primary" />
                    <AlertTitle className="text-xs font-black uppercase tracking-widest text-primary">Data Integrity Warning</AlertTitle>
                    <AlertDescription className="text-[11px] font-bold text-slate-500 uppercase leading-relaxed">
                        Full reconstruction will wipe your current Godown inventory and replace it with your file data. Use with caution.
                    </AlertDescription>
                </Alert>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button disabled={isImporting} className="w-full h-14 text-sm font-black uppercase tracking-widest bg-primary hover:bg-primary/90 shadow-xl shadow-primary/20">
                                {isImporting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Upload className="mr-2 h-5 w-5" />}
                                Full History Reconstruction
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="rounded-2xl border-2">
                            <AlertDialogHeader>
                                <AlertDialogTitle className="text-xl font-black uppercase tracking-tighter">Confirm Audit Overwrite</AlertDialogTitle>
                                <AlertDialogDescription className="text-sm font-medium">Please select your source file to begin the deep restoration process. All IDs will be mapped exactly.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <div className="grid grid-cols-1 gap-2 my-4">
                                <Button variant="outline" onClick={() => excelInputRef.current?.click()} className="h-12 font-bold">Excel Template (.xlsx)</Button>
                                <Button variant="outline" onClick={() => jsonInputRef.current?.click()} className="h-12 font-bold">Technical JSON (.json)</Button>
                            </div>
                            <AlertDialogFooter><AlertDialogCancel className="font-bold">Cancel Operation</AlertDialogCancel></AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                    <input type="file" ref={excelInputRef} onChange={(e) => handleFileChange(e, 'full')} className="hidden" accept=".xlsx,.xls" />
                    <input type="file" ref={jsonInputRef} onChange={(e) => handleFileChange(e, 'json')} className="hidden" accept=".json" />

                    <Button onClick={() => paymentsOnlyInputRef.current?.click()} disabled={isImporting} variant="secondary" className="w-full h-14 text-sm font-black uppercase tracking-widest border-2">
                         <History className="mr-2 h-5 w-5" />
                        Restore Payments Only
                    </Button>
                    <input type="file" ref={paymentsOnlyInputRef} onChange={(e) => handleFileChange(e, 'payments')} className="hidden" accept=".xlsx,.xls" />
                </div>
            </div>

            <Separator className="my-4" />
            <div className="flex justify-center pt-2">
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button variant="link" className="text-destructive font-bold text-[10px] uppercase tracking-widest hover:no-underline hover:text-red-700">Wipe All Transactional Data (Super Admin Reset)</Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="border-destructive/30 border-2">
                        <AlertDialogHeader>
                            <AlertDialogTitle className="text-destructive font-black uppercase">Final Factory Reset Warning</AlertDialogTitle>
                            <AlertDialogDescription className="font-bold">This will permanently delete every customer, bill, and payment record for this warehouse. This action is irreversible.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel className="font-bold">Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => {
                                if (!firestore || !appUser?.warehouseId) return;
                                startClearingTransition(async () => {
                                    const batch = writeBatch(firestore);
                                    for (const colName of TRANSACTIONAL_COLLECTIONS) {
                                        const snap = await getDocs(query(collection(firestore, colName), where('warehouseId', '==', appUser.warehouseId)));
                                        snap.docs.forEach(d => batch.delete(d.ref));
                                    }
                                    await batch.commit();
                                    toast({ title: 'Warehouse Database Wiped' });
                                });
                            }} className="bg-destructive text-white font-bold">Yes, Wipe Database</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </CardContent>

        <AlertDialog open={isImportAlertOpen} onOpenChange={setIsImportAlertOpen}>
            <AlertDialogContent className="rounded-2xl border-2">
                <AlertDialogHeader>
                    <AlertDialogTitle className="text-xl font-black uppercase tracking-tighter">
                        {importMode === 'full' ? 'Execute Reconstruction?' : 'Apply Payment Sync?'}
                    </AlertDialogTitle>
                    <AlertDialogDescription className="text-sm font-medium">
                        {importMode === 'full' 
                            ? 'Warning: All current inventory will be cleared. History will be rebuilt exactly as per your file. Bill IDs will be preserved.' 
                            : 'This will append new cash transactions to your existing records without modifying inventory quantities.'}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => { setPendingImportData(null); setIsImportAlertOpen(false); }} className="font-bold">Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={executeDeepRestore} className="font-bold bg-primary text-white">Execute Reconstruction</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </Card>
  );
}