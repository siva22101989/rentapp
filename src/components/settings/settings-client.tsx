'use client';

import { useTransition, useState } from 'react';
import { Loader2, Trash2, Database, Terminal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { useFirestore } from '@/firebase';
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
import customersData from '@/lib/data/customers.json';
import storageRecordsData from '@/lib/data/storageRecords.json';
import { cleanForFirestore } from '@/lib/utils';


export function SettingsClient() {
  const [isClearingCache, startClearingCacheTransition] = useTransition();
  const [isClearingDb, startClearingDbTransition] = useTransition();
  const [isSeeding, startSeedingTransition] = useTransition();
  
  const firestore = useFirestore();
  const { toast } = useToast();
  const [seedResult, setSeedResult] = useState<{ message: string; success: boolean } | null>(null);

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

  const handleClearDatabase = async () => {
    if (!firestore) {
      toast({ title: 'Error', description: 'Firestore is not initialized.', variant: 'destructive' });
      return;
    }

    startClearingDbTransition(async () => {
        const collectionsToDelete = ['customers', 'storageRecords', 'expenses', 'unloadingRecords', 'dryingRecords', 'commodities'];
        let deletedCount = 0;

        try {
            for (const collectionName of collectionsToDelete) {
                const collectionRef = collection(firestore, collectionName);
                const snapshot = await getDocs(collectionRef);
                const batch = writeBatch(firestore);
                snapshot.docs.forEach(doc => {
                    batch.delete(doc.ref);
                });
                await batch.commit();
                deletedCount += snapshot.size;
            }
            toast({
                title: 'Database Cleared',
                description: `Successfully deleted all data from ${collectionsToDelete.join(', ')}. Total documents removed: ${deletedCount}.`,
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

  const handleSeed = () => {
    if (!firestore) {
      toast({
        title: 'Error',
        description: 'Firestore is not initialized.',
        variant: 'destructive',
      });
      return;
    }

    startSeedingTransition(async () => {
      try {
        // First, clear the collections that will be seeded
        const collectionsToClear = ['customers', 'storageRecords'];
        for (const collectionName of collectionsToClear) {
            const collectionRef = collection(firestore, collectionName);
            const snapshot = await getDocs(collectionRef);
            if (!snapshot.empty) {
                const deleteBatch = writeBatch(firestore);
                snapshot.docs.forEach(doc => {
                    deleteBatch.delete(doc.ref);
                });
                await deleteBatch.commit();
            }
        }

        const batch = writeBatch(firestore);

        // Seed Customers
        customersData.forEach((customer) => {
          const docRef = doc(firestore, 'customers', customer.id);
          batch.set(docRef, cleanForFirestore(customer));
        });

        // Seed Storage Records
        storageRecordsData.forEach((record: any) => {
          const docRef = doc(firestore, 'storageRecords', record.id);
          const adaptedRecord = {
            ...record,
            storageStartDate: new Date(record.storageStartDate),
            storageEndDate: record.storageEndDate ? new Date(record.storageEndDate) : null,
            payments: (record.payments || []).map((p: any) => ({
              ...p,
              date: new Date(p.date),
            })),
          };
          batch.set(docRef, cleanForFirestore(adaptedRecord));
        });

        await batch.commit();

        setSeedResult({
            message: `Cleared old data and successfully seeded database.\n- Customers: ${customersData.length}\n- Storage Records: ${storageRecordsData.length}`,
            success: true,
        });
      } catch (error: any) {
        console.error('Seeding failed:', error);
        setSeedResult({
            message: `Failed to seed database: ${error.message}`,
            success: false,
        });
      }
    });
  };

  return (
    <div className="flex flex-col items-center justify-center text-center gap-8">
        <Card className="w-full max-w-md">
            <CardHeader>
                <CardTitle>Seed Database</CardTitle>
                <CardDescription>
                    Populate your Firestore database with initial dummy data. This will clear existing customers and storage records first.
                </CardDescription>
            </CardHeader>
            <CardContent>
                 <Button onClick={handleSeed} disabled={isSeeding} size="lg">
                    {isSeeding ? (
                        <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Seeding...
                        </>
                    ) : (
                        <>
                        <Database className="mr-2 h-4 w-4" />
                        Seed Database
                        </>
                    )}
                </Button>
            </CardContent>
        </Card>

        {seedResult && (
            <Alert className={`max-w-md ${seedResult.success ? 'border-green-500 text-green-700' : 'border-destructive text-destructive'}`}>
            <Terminal className="h-4 w-4" />
            <AlertTitle>{seedResult.success ? 'Success!' : 'Error!'}</AlertTitle>
            <AlertDescription className="whitespace-pre-wrap">
                {seedResult.message}
            </AlertDescription>
            </Alert>
        )}
        
        <Card className="w-full max-w-md border-orange-500/50">
            <CardHeader>
                <CardTitle className="text-orange-600">Clear Local Data</CardTitle>
                <CardDescription>
                    This will clear all local storage, session storage, and cached data for this application in your browser. This is useful for resetting the UI and application state.
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
        
        <Card className="w-full max-w-md border-destructive/50">
            <CardHeader>
                <CardTitle className="text-destructive">Clear All Database Data</CardTitle>
                <CardDescription>
                    This is a destructive action and cannot be undone. It will permanently delete all customers, storage records, and other transactional data from the database.
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
                                This action is permanent and cannot be undone. All data in the database will be deleted, including all customers, storage records, expenses, unloading, and drying records.
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
  );
}
