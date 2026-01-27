
'use client';

import { useTransition, useState } from 'react';
import { Loader2, Database } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Terminal } from "lucide-react"
import { useFirestore } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { collection, writeBatch, doc } from 'firebase/firestore';
import customersData from '@/lib/data/customers.json';
import storageRecordsData from '@/lib/data/storageRecords.json';
import { cleanForFirestore } from '@/lib/utils';

export function SeedClient() {
  const [isSeeding, startSeedingTransition] = useTransition();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [result, setResult] = useState<{ message: string; success: boolean } | null>(null);

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
        const batch = writeBatch(firestore);

        // Seed Customers
        customersData.forEach((customer) => {
          const docRef = doc(firestore, 'customers', customer.id);
          batch.set(docRef, cleanForFirestore(customer));
        });

        // Seed Storage Records
        storageRecordsData.forEach((record: any) => {
          const docRef = doc(firestore, 'storageRecords', record.id);
          // Dates in JSON are strings, cleanForFirestore will convert them
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

        setResult({
            message: `Successfully seeded database.\n- Customers: ${customersData.length}\n- Storage Records: ${storageRecordsData.length}`,
            success: true,
        });
      } catch (error: any) {
        console.error('Seeding failed:', error);
        setResult({
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
                <CardTitle>Confirm Seeding</CardTitle>
                <CardDescription>
                    This will overwrite existing data in the 'customers' and 'storageRecords' collections with matching IDs.
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

      {result && (
        <Alert className={`mt-8 max-w-md ${result.success ? 'border-green-500 text-green-700' : 'border-destructive text-destructive'}`}>
          <Terminal className="h-4 w-4" />
          <AlertTitle>{result.success ? 'Success!' : 'Error!'}</AlertTitle>
          <AlertDescription className="whitespace-pre-wrap">
            {result.message}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
