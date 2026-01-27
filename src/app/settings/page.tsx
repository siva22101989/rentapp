
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/shared/page-header";
import { SettingsClient } from "@/components/settings/settings-client";

export default function SettingsPage() {
  return (
    <AppLayout>
      <PageHeader
        title="Application Settings"
        description="Manage data operations like seeding and clearing the database."
      />
      <div className="mt-8">
        <SettingsClient />
      </div>
    </AppLayout>
  );
}
