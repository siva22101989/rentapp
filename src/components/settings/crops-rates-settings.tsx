
'use client';

import { CommoditiesTable } from "@/components/commodities/commodities-table";
import { LotsClient } from "@/components/lots/lots-client";
import { AddCommodityDialog } from "@/components/commodities/add-commodity-dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";

export function CropsRatesSettings() {
  return (
    <div className="space-y-6 mt-6">
        <Card>
            <CardHeader className="flex-row items-start justify-between">
                <div>
                    <CardTitle>Commodities & Rates</CardTitle>
                    <CardDescription>Manage commodity types and their specific rent rates.</CardDescription>
                </div>
                <AddCommodityDialog />
            </CardHeader>
            <CardContent>
                <CommoditiesTable />
            </CardContent>
        </Card>

        <LotsClient />
    </div>
  );
}
