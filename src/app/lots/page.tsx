
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/shared/page-header";
import { LotsClient } from "@/components/lots/lots-client";

export default function LotsPage() {
  return (
    <AppLayout>
      <PageHeader
        title="Manage Lots"
        description="Add, remove, and view all storage lot locations in the warehouse."
      />
      <LotsClient />
    </AppLayout>
  );
}
