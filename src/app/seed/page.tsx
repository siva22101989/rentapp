
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/shared/page-header";
import { SeedClient } from "@/components/seed/seed-client";

export default function SeedPage() {
  return (
    <AppLayout>
      <PageHeader
        title="Seed Database"
        description="Populate your Firestore database with initial dummy data from local JSON files."
      />
      <div className="mt-8">
        <SeedClient />
      </div>
    </AppLayout>
  );
}
