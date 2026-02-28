'use client';

import { useTransition, useState, useRef } from 'react';
import { Loader2, Trash2, Download, Upload, FileText } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useFirestore } from '@/firebase/provider';
import { useToast } from '@/hooks/use-toast';
import { collection, writeBatch, getDocs, doc } from 'firebase/firestore';
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
import { cleanForFirestore } from '@/lib/utils';
import { Separator } from '../ui/separator';
import type { Customer } from '@/lib/definitions';
import { WarehouseInfoForm } from './warehouse-info-form';

// Collections to clear for testing purposes (preserving setup data)
const TRANSACTIONAL_COLLECTIONS = ['customers', 'storageRecords', 'expenses', 'unloadingRecords', 'dryingRecords'];
// All collections for full backup
const ALL_DATA_COLLECTIONS = ['customers', 'storageRecords', 'expenses', 'unloadingRecords', 'dryingRecords', 'commodities', 'lots'];

export function SettingsClient() {
  const [isClearingCache, startClearingCacheTransition] = useTransition();
  const [isClearingDb, startClearingDbTransition] = useTransition();
  const [isExporting, startExportingTransition] = useTransition();
  const [isImporting, startImportingTransition] = useTransition();
  
  const [dataToImport, setDataToImport] = useState<{ customersToCreate: Omit<Customer, 'id'>[], storageRecords: any[] } | null>(null);
  const [isImportAlertOpen, setIsImportAlertOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const firestore = useFirestore();
  const { toast } = useToast();

  const handleClearCache = () => {
    startClearingCacheTransition(() => {
        try {
            // Clear local and session storage
            localStorage.clear();
            sessionStorage.clear();

            // Clear Cache API
            if ('caches' in window) {
                caches.keys().then((names) => {
                    for (const name of names) {
                        caches.delete(name);
                    }
                });
            }

            toast({
                title: 'Cache Cleared',
                description: 'Local storage, session storage, and browser cache have been cleared. The page will now reload.',
            });

            // Hard reload the page
            setTimeout(() => {
                window.location.reload();
            }, 1500);

        } catch (error: any) {
            toast({
                title: 'Error',
                description: `Failed to clear cache: ${error.message}`,
                variant: 'destructive',
            });
        }
    });
  };

  const clearData = async (collectionsToClear: string[]) => {
    if (!firestore) {
      throw new Error('Firestore is not initialized.');
    }
    let deletedCount = 0;
    for (const collectionName of collectionsToClear) {
      const collectionRef = collection(firestore, collectionName);
      const snapshot = await getDocs(collectionRef);
      if (snapshot.empty) continue;
      
      const batches = [];
      for (let i = 0; i < snapshot.docs.length; i += 500) {
        const batch = writeBatch(firestore);
        const chunk = snapshot.docs.slice(i, i + 500);
        chunk.forEach(doc => {
            batch.delete(doc.ref);
        });
        batches.push(batch.commit());
      }
      
      await Promise.all(batches);
      deletedCount += snapshot.size;
    }
    return deletedCount;
  }

  const handleClearDatabase = async () => {
    startClearingDbTransition(async () => {
        try {
            const deletedCount = await clearData(TRANSACTIONAL_COLLECTIONS);
            toast({
                title: 'Transactional Data Cleared',
                description: `Successfully deleted transactional data (customers, records, etc.). Commodities and lots were not affected. Total documents removed: ${deletedCount}. The page will now reload.`,
            });
            setTimeout(() => {
                window.location.reload();
            }, 2000);
        } catch (error: any) {
             toast({
                title: 'Error',
                description: `Failed to clear database: ${error.message}`,
                variant: 'destructive',
            });
        }
    });
  };

  const handleExportData = async () => {
    if (!firestore) {
      toast({ title: 'Error', description: 'Firestore is not initialized.', variant: 'destructive' });
      return;
    }
    startExportingTransition(async () => {
      try {
        const data: { [key: string]: any[] } = {};
        for (const collectionName of ALL_DATA_COLLECTIONS) {
          const collectionRef = collection(firestore, collectionName);
          const snapshot = await getDocs(collectionRef);
          data[collectionName] = snapshot.docs.map(d => ({ ...d.data(), id: d.id }));
        }

        const jsonString = JSON.stringify(data, (key, value) => {
          if (value && value.toDate) {
            return value.toDate().toISOString();
          }
          return value;
        }, 2);

        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const date = new Date().toISOString().split('T')[0];
        a.download = `warehouse-backup-${date}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        toast({ title: 'Success', description: 'Data exported successfully.' });

      } catch (error: any) {
        toast({ title: 'Error', description: `Failed to export data: ${error.message}`, variant: 'destructive' });
      }
    });
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const text = e.target?.result as string;
            if (!text) throw new Error('File is empty.');

            const lines = text.trim().split(/\r?\n/);
            const headerLine = lines.shift()?.trim();
            if (!headerLine) throw new Error('Invalid CSV: Missing header.');
            
            const header = headerLine.split(',').map(h => h.trim());
            
            const customersMapByName = new Map<string, Omit<Customer, 'id'>>();
            const storageRecords: any[] = [];

            for (const line of lines) {
                if (!line.trim()) continue;
                const values = line.split(',');
                const row = header.reduce((obj, key, index) => {
                    obj[key] = values[index]?.trim() || '';
                    return obj;
                }, {} as { [key: string]: string });

                const customerName = row.customer_name;
                if (!customerName) {
                    continue; 
                }

                const customerNameKey = customerName.toLowerCase().trim();
                
                if (!customersMapByName.has(customerNameKey)) {
                    customersMapByName.set(customerNameKey, {
                        name: customerName,
                        phone: row.customer_phone || '',
                        fatherName: row.customer_father_name || '',
                        village: row.customer_village || '',
                    });
                }
                
                const recordId = row.record_id;
                if (recordId) {
                    const bagsStored = Number(row.bags_in) || 0;
                    storageRecords.push({
                        recordId: recordId,
                        customerName: customerName, // Use name for linking later
                        commodityDescription: row.commodity_description,
                        location: row.location,
                        bagsIn: bagsStored,
                        bagsStored: bagsStored,
                        storageStartDate: new Date(row.storage_start_date),
                        hamaliPayable: Number(row.hamali_payable) || 0,
                        lorryTractorNo: row.lorry_tractor_no,
                        weight: Number(row.weight) || 0,
                        khataAmount: Number(row.khata_amount) || 0,
                    });
                }
            }
            
            const customersToCreate = Array.from(customersMapByName.values());
            
            setDataToImport({
                customersToCreate,
                storageRecords,
            });
            setIsImportAlertOpen(true);

        } catch (error: any) {
            toast({ title: 'Import Error', description: `Failed to parse CSV file: ${error.message}`, variant: 'destructive'});
        }
    };
    reader.readAsText(file);
    event.target.value = ''; // Reset file input
  };
  
  const handleConfirmImport = () => {
    if (!dataToImport || !firestore) return;
    
    startImportingTransition(async () => {
      try {
        await clearData(TRANSACTIONAL_COLLECTIONS);

        const batch = writeBatch(firestore);
        const customerNameIdMap = new Map<string, string>();

        for (const customerData of dataToImport.customersToCreate) {
            const customerRef = doc(collection(firestore, 'customers'));
            batch.set(customerRef, cleanForFirestore(customerData));
            customerNameIdMap.set(customerData.name.toLowerCase().trim(), customerRef.id);
        }
        
        for (const recordData of dataToImport.storageRecords) {
            const customerId = customerNameIdMap.get(recordData.customerName.toLowerCase().trim());
            if (customerId) {
                 const { recordId, customerName, ...rest } = recordData;
                 const recordRef = doc(firestore, 'storageRecords', recordId);
                 const finalRecord = {
                    ...rest,
                    customerId: customerId,
                    bagsOut: 0,
                    storageEndDate: null,
                    billingCycle: '6-Month Initial',
                    payments: [],
                    totalRentBilled: 0,
                    inflowType: 'Direct',
                    dryingRecordId: '',
                    outflows: [],
                 };
                 batch.set(recordRef, cleanForFirestore(finalRecord));
            }
        }
        
        await batch.commit();
        
        toast({ title: 'Import Successful', description: 'Data has been imported. Page will reload.' });
        
        setTimeout(() => {
            window.location.reload();
        }, 2000);

      } catch (error: any) {
        toast({ title: 'Import Failed', description: `An error occurred: ${error.message}`, variant: 'destructive'});
      }
    });
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
        <WarehouseInfoForm />
        
        <div className="space-y-8 w-full max-w-md mx-auto">
            <Card>
                <CardHeader>
                    <CardTitle>Data Management</CardTitle>
                    <CardDescription>
                        Import data from an Excel file (CSV) or export all current data to a JSON backup.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div>
                        <h4 className="text-sm font-medium mb-2">Step 1: Download Sample Excel File</h4>
                        <p className="text-xs text-muted-foreground px-2 mb-2">
                            Download the sample file and fill it with your customer and storage information.
                        </p>
                        <Button asChild size="sm" variant="secondary" className="w-full justify-start">
                            <Link href="/all-data-template.csv" download>
                                <FileText className="mr-2 h-4 w-4" />
                                Download Sample Excel File (.csv)
                            </Link>
                        </Button>
                    </div>

                    <Separator />

                    <div>
                        <h4 className="text-sm font-medium mb-2">Step 2: Import Your File</h4>
                        <div className="space-y-2">
                            <Button onClick={handleImportClick} disabled={isImporting} className="w-full justify-start" variant="outline">
                                {isImporting ? (
                                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Importing...</>
                                ) : (
                                    <><Upload className="mr-2 h-4 w-4" /> Import from Excel File (.csv)</>
                                )}
                            </Button>
                            <p className="text-xs text-muted-foreground px-2 mt-2">
                                This will **overwrite all existing data** (customers, records, etc.) with the content from your file.
                            </p>
                        </div>
                    </div>

                    <Separator />
                    
                    <div>
                        <h4 className="text-sm font-medium mb-2">Backup</h4>
                        <p className="text-xs text-muted-foreground px-2 mb-2">
                            Export all data from the database into a single JSON file for safekeeping.
                        </p>
                        <Button onClick={handleExportData} disabled={isExporting} className="w-full justify-start" variant="outline">
                            {isExporting ? (
                                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Exporting...</>
                            ) : (
                                <><Download className="mr-2 h-4 w-4" /> Export All Data as JSON</>
                            )}
                        </Button>
                    </div>

                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        className="hidden"
                        accept=".csv"
                    />
                </CardContent>
            </Card>

            <Card className="w-full border-orange-500/50">
                <CardHeader>
                    <CardTitle className="text-orange-600">Clear Local Data</CardTitle>
                    <CardDescription>
                        This will clear all local storage and cached data for this application in your browser. This is useful for resetting the UI.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Button onClick={handleClearCache} disabled={isClearingCache} size="lg" variant="outline" className="text-orange-600 border-orange-500 hover:bg-orange-50 hover:text-orange-700">
                        {isClearingCache ? (
                            <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Clearing...
                            </>
                        ) : (
                            <>
                            <Trash2 className="mr-2 h-4 w-4" />
                            Clear Cache and Reload
                            </>
                        )}
                    </Button>
                </CardContent>
            </Card>
            
            <Card className="w-full border-destructive/50">
                <CardHeader>
                    <CardTitle className="text-destructive">Clear Transactional Data</CardTitle>
                    <CardDescription>
                        This will permanently delete all transactional data (customers, records, expenses) but will keep your setup data (Commodities, Lots).
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="lg">
                                <Trash2 className="mr-2 h-4 w-4" />
                                Clear Transactional Data
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    This action is permanent and cannot be undone. All customers, storage records, unloading/drying records, and expenses will be deleted. Your Commodities and Lots will not be affected.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                    onClick={handleClearDatabase}
                                    className="bg-destructive hover:bg-destructive/90"
                                    disabled={isClearingDb}
                                >
                                    {isClearingDb ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Deleting...
                                        </>
                                    ) : (
                                        'Yes, delete transactional data'
                                    )}
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
                    <AlertDialogTitle>Confirm Data Import</AlertDialogTitle>
                    <AlertDialogDescription>
                        This will **permanently delete all current data** and replace it with the data from your CSV file. This action cannot be undone. Are you sure you want to continue?
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setDataToImport(null)}>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={handleConfirmImport}
                        className="bg-destructive hover:bg-destructive/90"
                        disabled={isImporting}
                    >
                        {isImporting ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Importing...
                            </>
                        ) : (
                            'Yes, overwrite and import'
                        )}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </div>
  );
}
