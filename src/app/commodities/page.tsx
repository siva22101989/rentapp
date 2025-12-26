
'use client';
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/shared/page-header";
import { AddCommodityDialog } from "@/components/commodities/add-commodity-dialog";
import { CommoditiesTable } from "@/components/commodities/commodities-table";


export default function CommoditiesPage() {
  return (
    <AppLayout>
      <PageHeader
        title="Commodities"
        description="Manage commodity types and their rent rates."
      >
        <AddCommodityDialog />
      </PageHeader>
      <CommoditiesTable />
    </AppLayout>
  );
}
