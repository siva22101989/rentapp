
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/shared/page-header";
import { SettingsClient } from "@/components/settings/settings-client";

export default function SettingsPage() {
  return (
    <AppLayout>
      <PageHeader
        title="Application Settings"
        description="Manage dangerous operations like clearing data."
      />
      <div className="mt-8">
        <SettingsClient />
      </div>
    </AppLayout>
  );
}
