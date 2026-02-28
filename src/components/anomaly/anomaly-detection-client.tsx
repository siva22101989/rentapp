'use client';

import { useState, useTransition } from 'react';
import { Loader2, ShieldAlert } from 'lucide-react';
import { getAnomalyDetection } from '@/lib/actions';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useCollection } from "@/firebase/firestore/use-collection";
import { collection } from "firebase/firestore";
import { useFirestore } from "@/firebase/provider";
import { useMemoFirebase } from "@/hooks/use-memo-firebase";
import type { StorageRecord } from "@/lib/definitions";
import { useToast } from '@/hooks/use-toast';

export function AnomalyDetectionClient() {
  const [isAnalyzing, startTransition] = useTransition();
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const firestore = useFirestore();
  const { toast } = useToast();

  const recordsQuery = useMemoFirebase(
    () => (firestore ? collection(firestore, 'storageRecords') : null),
    [firestore]
  );
  const { data: storageRecords, loading } = useCollection<StorageRecord>(recordsQuery);

  const handleAnalysis = () => {
    if (!storageRecords) {
        toast({ title: 'Error', description: 'Storage records are not available.', variant: 'destructive' });
        return;
    }
    startTransition(async () => {
        const plainRecords = JSON.parse(JSON.stringify(storageRecords));
        const result = await getAnomalyDetection(plainRecords);
        if (result.success) {
            setAnalysisResult(result.anomalies);
        } else {
            toast({ title: 'Analysis Failed', description: result.anomalies, variant: 'destructive' });
            setAnalysisResult(null);
        }
    });
  };

  if (loading) {
      return (
          <div className="flex justify-center">
              <p>Loading storage records...</p>
          </div>
      )
  }

  return (
    <div className="flex flex-col items-center justify-center text-center">
      <Button onClick={handleAnalysis} disabled={isAnalyzing || loading} size="lg">
        {isAnalyzing ? (
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

      {analysisResult && (
        <Card className="mt-8 w-full max-w-2xl text-left">
          <CardContent className="p-6">
            <h3 className="font-semibold mb-4">Analysis Results:</h3>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {analysisResult}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
