
'use client';
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/shared/page-header";
import { AddCommodityDialog } from "@/components/commodities/add-commodity-dialog";
import { CommoditiesTable } from "@/components/commodities/commodities-table";
import { LotsClient } from "@/components/lots/lots-client";
import { Separator } from "@/components/ui/separator";


export default function CommoditiesPage() {
  return (
    <AppLayout>
      <PageHeader
        title="Commodities & Lots"
        description="Manage commodity types, rent rates, and storage lot locations."
      >
        <AddCommodityDialog />
      </PageHeader>
      <div className="space-y-8">
        <CommoditiesTable />
        <Separator />
        <LotsClient />
      </div>
    </AppLayout>
  );
}
