
'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Loader2, ShieldAlert } from 'lucide-react';
import { getAnomalyDetection } from '@/lib/actions';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

type AnomalyState = {
  anomalies: string | null;
  success: boolean;
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} size="lg">
      {pending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Analyzing...
        </>
      ) : (
        <>
          <ShieldAlert className="mr-2 h-4 w-4" />
          Analyze Storage Records
        </>
      )}
    </Button>
  );
}

export function AnomalyDetectionClient() {
  const initialState: AnomalyState = { anomalies: null, success: true };
  const [state, formAction] = useActionState(getAnomalyDetection, initialState);

  return (
    <div className="flex flex-col items-center justify-center text-center">
      <form action={formAction}>
        <SubmitButton />
      </form>

      {state.anomalies && (
        <Card className="mt-8 w-full max-w-2xl text-left">
          <CardContent className="p-6">
            <h3 className="font-semibold mb-4">Analysis Results:</h3>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {state.anomalies}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
