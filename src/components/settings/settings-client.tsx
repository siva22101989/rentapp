'use client';

import { useTransition, useState } from 'react';
import { Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useFirestore } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { collection, writeBatch, getDocs } from 'firebase/firestore';
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


export function SettingsClient() {
  const [isClearingCache, startClearingCacheTransition] = useTransition();
  const [isClearingDb, startClearingDbTransition] = useTransition();
  
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

  return (
    <div className="flex flex-col items-center justify-center text-center gap-8">
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
