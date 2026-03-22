
'use client';
import { AppLayout } from "@/components/layout/app-layout";
import { SettingsLayout } from "@/components/settings/settings-layout";
import { PageHeader } from "@/components/shared/page-header";
import { Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppUser } from "@/firebase/auth/use-user";
import { ManageTeamDialog } from "@/components/settings/manage-team-dialog";

export default function SettingsPage() {
  const appUser = useAppUser();
  const isOwner = appUser?.role === 'owner';

  return (
    <AppLayout>
      <PageHeader
        title="Settings"
        description="Manage your account, warehouse preferences, and crop configurations."
      >
        {isOwner && (
          <ManageTeamDialog>
            <Button variant="outline">
                <Users className="mr-2 h-4 w-4" />
                Manage Team
            </Button>
          </ManageTeamDialog>
        )}
      </PageHeader>
      <div className="mt-4">
        <SettingsLayout />
      </div>
    </AppLayout>
  );
}
