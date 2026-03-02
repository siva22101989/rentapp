
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { ShieldAlert } from "lucide-react";

export default function AnomalyDetectionPage() {
  return (
    <AppLayout>
      <PageHeader
        title="Anomaly Detection Tool"
        description="This feature is temporarily unavailable due to a configuration issue."
      />
      <div className="mt-8 flex justify-center">
        <Card className="w-full max-w-lg text-center">
            <CardContent className="p-8">
                <ShieldAlert className="mx-auto h-12 w-12 text-muted-foreground" />
                <p className="mt-4 text-muted-foreground">The AI features have been temporarily disabled to resolve a package installation issue.</p>
            </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
