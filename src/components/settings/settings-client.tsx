'use client';

import { useTransition, useState, useRef } from 'react';
import { Loader2, Trash2, Download, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useFirestore } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { collection, writeBatch, getDocs, doc, setDoc } from 'firebase/firestore';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cleanForFirestore } from '@/lib/utils';


const COLLECTION_NAMES = ['customers', 'storageRecords', 'expenses', 'unloadingRecords', 'dryingRecords', 'commodities'];

export function SettingsClient() {
  const [isClearingCache, startClearingCacheTransition] = useTransition();
  const [isClearingDb, startClearingDbTransition] = useTransition();
  const [isExporting, startExportingTransition] = useTransition();
  const [isImporting, startImportingTransition] = useTransition();
  
  const [dataToImport, setDataToImport] = useState<any>(null);
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

  const clearAllData = async () => {
    if (!firestore) {
      throw new Error('Firestore is not initialized.');
    }
    let deletedCount = 0;
    for (const collectionName of COLLECTION_NAMES) {
      const collectionRef = collection(firestore, collectionName);
      const snapshot = await getDocs(collectionRef);
      if (snapshot.empty) continue;
      
      const batch = writeBatch(firestore);
      snapshot.docs.forEach(doc => {
          batch.delete(doc.ref);
      });
      await batch.commit();
      deletedCount += snapshot.size;
    }
    return deletedCount;
  }

  const handleClearDatabase = async () => {
    startClearingDbTransition(async () => {
        try {
            const deletedCount = await clearAllData();
            toast({
                title: 'Database Cleared',
                description: `Successfully deleted all data. Total documents removed: ${deletedCount}.`,
            });
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
        for (const collectionName of COLLECTION_NAMES) {
          const collectionRef = collection(firestore, collectionName);
          const snapshot = await getDocs(collectionRef);
          data[collectionName] = snapshot.docs.map(d => ({ ...d.data(), id: d.id }));
        }

        // Convert Timestamps to ISO strings for JSON compatibility
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
            const text = e.target?.result;
            if (typeof text !== 'string') {
              throw new Error('Failed to read file.');
            }
            const parsedData = JSON.parse(text);
            
            // Basic validation
            const collectionsArePresent = COLLECTION_NAMES.every(name => Array.isArray(parsedData[name]));
            if (!collectionsArePresent) {
                throw new Error('Invalid backup file format. Some collections are missing or not arrays.');
            }

            setDataToImport(parsedData);
            setIsImportAlertOpen(true);

        } catch (error: any) {
            toast({ title: 'Import Error', description: `Invalid JSON file or format: ${error.message}`, variant: 'destructive'});
        }
    };
    reader.readAsText(file);
    event.target.value = ''; // Reset file input
  };
  
  const handleConfirmImport = () => {
    if (!dataToImport || !firestore) return;
    
    startImportingTransition(async () => {
      try {
        // 1. Clear existing data
        await clearAllData();

        // 2. Import new data
        for (const collectionName of COLLECTION_NAMES) {
          const items = dataToImport[collectionName];
          if (items && items.length > 0) {
            // Firestore batches can hold up to 500 operations.
            for (let i = 0; i < items.length; i += 500) {
              const batch = writeBatch(firestore);
              const chunk = items.slice(i, i + 500);
              chunk.forEach((item: any) => {
                const { id, ...data } = item;
                if (id) {
                  const docRef = doc(firestore, collectionName, id);
                  batch.set(docRef, cleanForFirestore(data));
                }
              });
              await batch.commit();
            }
          }
        }
        
        toast({ title: 'Import Successful', description: 'All data has been replaced with the backup file.' });

      } catch (error: any) {
        toast({ title: 'Import Failed', description: `An error occurred: ${error.message}`, variant: 'destructive'});
      } finally {
        setIsImportAlertOpen(false);
        setDataToImport(null);
      }
    });
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
        <Card className="w-full max-w-md mx-auto">
            <CardHeader>
                <CardTitle>Data Management</CardTitle>
                <CardDescription>
                    Export your current database as a JSON backup file, or import a backup file to restore your data.
                </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
                 <Button onClick={handleExportData} disabled={isExporting} size="lg" variant="outline">
                    {isExporting ? (
                        <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Exporting...
                        </>
                    ) : (
                        <>
                        <Download className="mr-2 h-4 w-4" />
                        Export All Data
                        </>
                    )}
                </Button>
                <Button onClick={handleImportClick} disabled={isImporting} size="lg" variant="outline">
                    {isImporting ? (
                        <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Importing...
                        </>
                    ) : (
                        <>
                        <Upload className="mr-2 h-4 w-4" />
                        Import from File
                        </>
                    )}
                </Button>
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="hidden"
                    accept="application/json"
                />
            </CardContent>
        </Card>
        
        <div className="space-y-8 w-full max-w-md mx-auto">
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
                    <CardTitle className="text-destructive">Clear All Database Data</CardTitle>
                    <CardDescription>
                        This will permanently delete all data from the database. This action cannot be undone.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="lg">
                                <Trash2 className="mr-2 h-4 w-4" />
                                Clear Database
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    This action is permanent and cannot be undone. All data in the database will be deleted, including all customers, storage records, and expenses.
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
                                        'Yes, delete everything'
                                    )}
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </CardContent>
            </Card>
        </div>
        
        {/* Import confirmation dialog */}
        <AlertDialog open={isImportAlertOpen} onOpenChange={setIsImportAlertOpen}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Confirm Data Import</AlertDialogTitle>
                    <AlertDialogDescription>
                        This will **permanently delete all current data** in your database and replace it with the data from the selected backup file. This action cannot be undone.
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
