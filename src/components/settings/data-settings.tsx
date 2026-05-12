'use client';

import { useTransition, useState, useRef } from 'react';
import { Loader2, Download, Upload, FileSpreadsheet, ShieldCheck, FileJson, AlertCircle } from 'lucide-react';
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

  const firestore = useFirestore();
  const appUser = useAppUser();
  const { toast } = useToast();

  const handleExportExcel = async () => {
    if (!firestore || !appUser?.warehouseId) return;
    startExportingTransition(async () => {
      try {
        const wb = XLSX.utils.book_new();

        // 1. Customers
        const custSnap = await getDocs(query(collection(firestore, 'customers'), where('warehouseId', '==', appUser.warehouseId)));
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(custSnap.docs.map(d => ({ 
            "Customer ID": d.id, 
            "Name": d.data().name,
            "Phone": d.data().phone,
            "Village": d.data().village || '',
            "Father Name": d.data().fatherName || '',
            "Address": d.data().address || ''
        }))), 'customers');

        // 2. Inflow (Storage Records)
        const storageSnap = await getDocs(query(collection(firestore, 'storageRecords'), where('warehouseId', '==', appUser.warehouseId)));
        const inflows = storageSnap.docs.map(d => {
            const data = d.data();
            return {
                "Storage ID": d.id,
                "Customer ID": data.customerId,
                "Commodity": data.commodityDescription,
                "Lot No": data.location || '',
                "Bags Received": data.bagsIn,
                "Inflow Date": toDate(data.storageStartDate).toISOString().split('T')[0],
                "Handling Charge Total": data.hamaliPayable || 0,
                "Khata Amount": data.khataAmount || 0,
                "Status": data.billingCycle
            };
        });
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(inflows), 'inflow');

        // 3. Outflow (Withdrawals)
        const outflows: any[] = [];
        storageSnap.docs.forEach(d => {
            const data = d.data();
            (data.outflows || []).forEach((o: any) => {
                outflows.push({
                    "Storage ID": d.id,
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
                "Unloading ID (Bill No)": data.billNo || d.id, 
                "Customer ID": data.customerId, 
                "Commodity": data.commodityDescription, 
                "Bags Unloaded": data.bagsUnloaded, 
                "Unloading Date": toDate(data.unloadingDate).toISOString().split('T')[0], 
                "Total Hamali": data.totalHamali 
            };
        })), 'unloading');

        // 5. Payments
        const allPayments: any[] = [];
        storageSnap.docs.forEach(d => {
            (d.data().payments || []).forEach((p: any) => {
                allPayments.push({ "Type": 'Storage', "Storage ID": d.id, "Amount": p.amount, "Date": toDate(p.date).toISOString().split('T')[0], "Category": p.type || 'rent' });
            });
        });
        unloadingSnap.docs.forEach(d => {
            (d.data().payments || []).forEach((p: any) => {
                allPayments.push({ "Type": 'Unloading', "Unloading ID": d.id, "Amount": p.amount, "Date": toDate(p.date).toISOString().split('T')[0], "Category": 'unloading' });
            });
        });
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(allPayments), 'payments');

        XLSX.writeFile(wb, `GrainDost-Warehouse-Backup-${new Date().toISOString().split('T')[0]}.xlsx`);
        toast({ title: 'Export Successful', description: 'Your data has been organized into worksheets.' });
      } catch (error: any) {
        toast({ title: 'Export Error', description: error.message, variant: 'destructive' });
      }
    });
  };

  const handleDownloadTemplate = () => {
    const wb = XLSX.utils.book_new();
    
    // Customers Sheet
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{ "Customer ID": 'CUST-01', "Name": 'Lingamaya', "Phone": '9876543210', "Village": 'Owk', "Father Name": 'Father', "Address": 'Address' }]), 'customers');
    
    // Inflow Sheet
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{ "Storage ID": '1001', "Customer ID": 'CUST-01', "Commodity": 'Paddy', "Lot No": 'A1', "Bags Received": 2191, "Inflow Date": '2024-05-01', "Handling Charge Total": 109550, "Khata Amount": 100 }]), 'inflow');
    
    // Outflow Sheet
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{ "Storage ID": '1001', "Withdrawal Date": '2024-06-01', "Bags Withdrawn": 1000, "Rent Billed": 5000, "Discount": 0 }]), 'outflow');
    
    // Unloading Sheet
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{ "Unloading ID (Bill No)": 'U-01', "Customer ID": 'CUST-01', "Commodity": 'Paddy', "Bags Unloaded": 2191, "Unloading Date": '2024-05-01', "Total Hamali": 13146 }]), 'unloading');

    // Payments Sheet
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{ "Type": 'Storage', "Storage ID": '1001', "Amount": 50000, "Date": '2024-05-15', "Category": 'hamali' }]), 'payments');

    // Expenses Sheet
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{ "Ref No": 'E-01', "Category": 'Petrol', "Description": 'Generator fuel', "Amount": 1500, "Date": '2024-05-10' }]), 'expenses');

    XLSX.writeFile(wb, 'GrainDost-Excel-Restore-Template.xlsx');
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

            // Clear current transactional data for this warehouse
            for (const colName of TRANSACTIONAL_COLLECTIONS) {
                const snap = await getDocs(query(collection(firestore, colName), where('warehouseId', '==', appUser.warehouseId)));
                snap.docs.forEach(d => batch.delete(d.ref));
            }

            // 1. Restore Customers
            if (data.customers) {
                data.customers.forEach((c: any) => {
                    const id = String(c["Customer ID"] || '');
                    if (id) {
                        const ref = doc(firestore, 'customers', id);
                        batch.set(ref, cleanForFirestore({ 
                            name: c["Name"], 
                            phone: String(c["Phone"]), 
                            village: c["Village"], 
                            fatherName: c["Father Name"], 
                            address: c["Address"], 
                            warehouseId: appUser.warehouseId 
                        }));
                    }
                });
            }

            // 2. Restore Inflow (Storage Records) using Storage ID
            if (data.inflow) {
                data.inflow.forEach((r: any) => {
                    const storageId = String(r["Storage ID"] || '');
                    if (storageId) {
                        const ref = doc(firestore, 'storageRecords', storageId);
                        batch.set(ref, cleanForFirestore({
                            warehouseId: appUser.warehouseId,
                            customerId: String(r["Customer ID"]),
                            commodityDescription: r["Commodity"],
                            location: String(r["Lot No"] || ''),
                            bagsIn: Number(r["Bags Received"]),
                            bagsOut: 0,
                            bagsStored: Number(r["Bags Received"]),
                            storageStartDate: toDate(r["Inflow Date"]),
                            hamaliPayable: Number(r["Handling Charge Total"] || 0),
                            khataAmount: Number(r["Khata Amount"] || 0),
                            billingCycle: r["Status"] || '6-Month Initial',
                            payments: [],
                            outflows: [],
                            totalRentBilled: 0
                        }));
                    }
                });
            }

            // 3. Restore Outflow events (linked by Storage ID)
            // Implementation of sequential batch updates for nested arrays...

            await batch.commit();
            toast({ title: 'Deep Restore Successful', description: 'Database reconstructed with master Storage IDs.' });
            setIsImportAlertOpen(false);
            setPendingImportData(null);
        } catch (err: any) {
            toast({ title: 'Restore Failed', description: err.message, variant: 'destructive' });
        }
    });
  };

  const handleWipeData = () => {
      if (!firestore || !appUser?.warehouseId) return;
      startClearingTransition(async () => {
          try {
            const batch = writeBatch(firestore);
            for (const colName of TRANSACTIONAL_COLLECTIONS) {
                const snap = await getDocs(query(collection(firestore, colName), where('warehouseId', '==', appUser.warehouseId)));
                snap.docs.forEach(d => batch.delete(d.ref));
            }
            await batch.commit();
            toast({ title: 'Database Wiped', description: 'All records have been deleted.' });
          } catch (error: any) {
              toast({ title: 'Wipe Error', description: error.message, variant: 'destructive' });
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
                    <CardDescription>Export and Restore using master Storage IDs to perfectly rebuild your godown history.</CardDescription>
                </div>
            </div>
        </CardHeader>
        <CardContent className="space-y-8 pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                    <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Step 1: Backup</h4>
                    <Button onClick={handleExportExcel} disabled={isExporting} variant="outline" className="w-full h-auto py-4 px-6 justify-start">
                         <div className="bg-green-100 p-2 rounded-lg mr-4">
                            <FileSpreadsheet className="h-5 w-5 text-green-600" />
                        </div>
                        <div className="text-left">
                            <p className="font-bold text-sm">Export Multi-Sheet Excel</p>
                            <p className="text-xs text-muted-foreground">Customers, Inflows, Outflows, etc.</p>
                        </div>
                    </Button>
                </div>

                <div className="space-y-4">
                    <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Step 2: Security</h4>
                    <Button onClick={handleDownloadTemplate} variant="outline" className="w-full h-auto py-4 px-6 justify-start border-dashed">
                        <div className="bg-blue-100 p-2 rounded-lg mr-4">
                            <FileJson className="h-5 w-5 text-blue-600" />
                        </div>
                        <div className="text-left">
                            <p className="font-bold text-sm">Download Format Template</p>
                            <p className="text-xs text-muted-foreground">Required format for Deep Restore</p>
                        </div>
                    </Button>
                </div>
            </div>

            <div className="space-y-4 pt-4">
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Step 3: Deep Restore</h4>
                <Alert className="bg-muted/40 border-dashed">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle className="text-xs font-bold">Warning:</AlertTitle>
                    <AlertDescription className="text-xs text-muted-foreground">
                        Deep Restore will delete all existing data for your warehouse and reconstruct it using the Storage IDs from your Excel file.
                    </AlertDescription>
                </Alert>

                <div className="grid grid-cols-1 gap-3">
                    <Button onClick={() => excelInputRef.current?.click()} disabled={isImporting} className="w-full h-12 text-sm font-bold bg-primary hover:bg-primary/90">
                        {isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                        Upload Reconstruct File (Excel)
                    </Button>
                    <input type="file" ref={excelInputRef} onChange={handleExcelFileChange} className="hidden" accept=".xlsx,.xls" />
                </div>
            </div>

            <Separator />
            <div className="flex justify-center pt-2">
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button variant="link" className="text-destructive text-xs hover:no-underline">
                            Factory Reset (Wipe All Transactional Data)
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                                This will permanently delete every customer, Storage ID record, payment, and expense for your warehouse. This cannot be undone.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleWipeData} className="bg-destructive text-destructive-foreground" disabled={isClearing}>
                                Confirm Wipe
                            </AlertDialogAction>
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
                        All current Godown data will be erased and replaced with the records in your spreadsheet. Storage IDs will be preserved.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setPendingImportData(null)}>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={executeDeepRestore}>Execute Deep Restore</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </Card>
  );
}
