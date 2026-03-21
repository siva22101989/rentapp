
'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User, Warehouse, Wheat, Database, Bell, MessageSquare, CreditCard } from "lucide-react";
import { ProfileSettings } from "./profile-settings";
import { WarehouseSettings } from "./warehouse-settings";
import { CropsRatesSettings } from "./crops-rates-settings";
import { DataSettings } from "./data-settings";
import { Card, CardContent } from "../ui/card";

const tabs = [
    { value: "profile", label: "Profile", icon: User },
    { value: "warehouse", label: "Warehouse", icon: Warehouse },
    { value: "crops_rates", label: "Crops & Rates", icon: Wheat },
    { value: "data", label: "Data", icon: Database },
    { value: "notifications", label: "Notifications", icon: Bell },
    { value: "sms", label: "SMS", icon: MessageSquare },
    { value: "billing", label: "Billing", icon: CreditCard },
];

export function SettingsLayout() {
    return (
        <Tabs defaultValue="profile" className="w-full">
            <div className="overflow-x-auto">
                <TabsList className="grid w-full grid-cols-3 sm:w-auto sm:grid-cols-7 h-auto p-1">
                    {tabs.map((tab) => (
                        <TabsTrigger key={tab.value} value={tab.value} className="text-xs sm:text-sm">
                            <tab.icon className="mr-1 h-4 w-4" />
                            {tab.label}
                        </TabsTrigger>
                    ))}
                </TabsList>
            </div>
            <TabsContent value="profile">
                <ProfileSettings />
            </TabsContent>
            <TabsContent value="warehouse">
                <WarehouseSettings />
            </TabsContent>
            <TabsContent value="crops_rates">
                <CropsRatesSettings />
            </TabsContent>
            <TabsContent value="data">
                <DataSettings />
            </TabsContent>
            <TabsContent value="notifications">
                 <Card className="mt-6"><CardContent className="p-8 text-center text-muted-foreground">Notifications settings are not available yet.</CardContent></Card>
            </TabsContent>
             <TabsContent value="sms">
                <Card className="mt-6"><CardContent className="p-8 text-center text-muted-foreground">SMS settings are not available yet.</CardContent></Card>
            </TabsContent>
             <TabsContent value="billing">
                <Card className="mt-6"><CardContent className="p-8 text-center text-muted-foreground">Billing settings are not available yet.</CardContent></Card>
            </TabsContent>
        </Tabs>
    );
}
