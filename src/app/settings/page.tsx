
'use client';
import { AppLayout } from "@/components/layout/app-layout";
import { SettingsLayout } from "@/components/settings/settings-layout";
import { PageHeader } from "@/components/shared/page-header";

export default function SettingsPage() {
  return (
    <AppLayout>
      <PageHeader
        title="Settings"
        description="Manage your account, warehouse preferences, and crop configurations."
      />
      <div className="mt-4">
        <SettingsLayout />
      </div>
    </AppLayout>
  );
}
