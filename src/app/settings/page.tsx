
'use client';
import { AppLayout } from "@/components/layout/app-layout";
import { SettingsLayout } from "@/components/settings/settings-layout";
import { PageHeader } from "@/components/shared/page-header";
import { Users } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function SettingsPage() {
  return (
    <AppLayout>
      <PageHeader
        title="Settings"
        description="Manage your account, warehouse preferences, and crop configurations."
      >
        <Button variant="outline">
            <Users className="mr-2 h-4 w-4" />
            Manage Team
        </Button>
      </PageHeader>
      <div className="mt-4">
        <SettingsLayout />
      </div>
    </AppLayout>
  );
}
