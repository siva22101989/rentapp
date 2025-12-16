
'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { Loader2, Database } from 'lucide-react';
import { seedDatabase } from '@/lib/actions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Terminal } from "lucide-react"

type SeedState = {
  message: string | null;
  success: boolean;
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} size="lg">
      {pending ? (
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
  );
}

export function SeedClient() {
  const initialState: SeedState = { message: null, success: false };
  const [state, formAction] = useFormState(seedDatabase, initialState);

  return (
    <div className="flex flex-col items-center justify-center text-center">
        <Card className="w-full max-w-md">
            <CardHeader>
                <CardTitle>Confirm Seeding</CardTitle>
                <CardDescription>
                    This will overwrite existing data in the 'customers' and 'storageRecords' collections with matching IDs.
                </CardDescription>
            </CardHeader>
            <CardContent>
                 <form action={formAction}>
                    <SubmitButton />
                </form>
            </CardContent>
        </Card>

      {state.message && (
        <Alert className={`mt-8 max-w-md ${state.success ? 'border-green-500 text-green-700' : 'border-destructive text-destructive'}`}>
          <Terminal className="h-4 w-4" />
          <AlertTitle>{state.success ? 'Success!' : 'Error!'}</AlertTitle>
          <AlertDescription className="whitespace-pre-wrap">
            {state.message}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
