
'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User, Warehouse, Wheat, Database, Bell, MessageSquare } from "lucide-react";
import { ProfileSettings } from "./profile-settings";
import { WarehouseSettings } from "./warehouse-settings";
import { CropsRatesSettings } from "./crops-rates-settings";
import { DataSettings } from "./data-settings";
import { Card, CardContent } from "../ui/card";
import { SmsSettings } from "./sms-settings";
import { useAppUser } from "@/firebase/auth/use-user";
import { BillingSettings } from "./billing-settings";

const allTabs = [
    { value: "profile", label: "Profile", icon: User, roles: ['super-admin', 'owner', 'supervisor', 'biller'] },
    { value: "billing", label: "Manage Warehouses", icon: Warehouse, roles: ['super-admin'] },
    { value: "warehouse", label: "My Warehouse", icon: Warehouse, roles: ['owner'] },
    { value: "crops_rates", label: "Crops & Rates", icon: Wheat, roles: ['owner'] },
    { value: "data", label: "Data", icon: Database, roles: ['owner'] },
    { value: "sms", label: "SMS", icon: MessageSquare, roles: ['owner'] },
    { value: "notifications", label: "Notifications", icon: Bell, roles: ['owner', 'supervisor', 'biller'] },
];

export function SettingsLayout() {
    const appUser = useAppUser();

    const accessibleTabs = allTabs.filter(tab => {
        if (!appUser) return false;
        return tab.roles.includes(appUser.role);
    });
    
    if (!appUser) {
        return null;
    }
    
    if (accessibleTabs.length === 0) {
        return (
             <Card className="mt-6">
                <CardContent className="p-8 text-center text-muted-foreground">
                    You do not have permission to view any settings.
                </CardContent>
            </Card>
        );
    }

    return (
        <Tabs defaultValue={accessibleTabs[0].value} className="w-full">
            <div className="overflow-x-auto">
                <TabsList>
                    {accessibleTabs.map((tab) => (
                        <TabsTrigger key={tab.value} value={tab.value}>
                            <tab.icon className="mr-2 h-4 w-4" />
                            {tab.label}
                        </TabsTrigger>
                    ))}
                </TabsList>
            </div>
            {accessibleTabs.find(t => t.value === 'profile') && (
                <TabsContent value="profile">
                    <ProfileSettings />
                </TabsContent>
            )}
            {accessibleTabs.find(t => t.value === 'billing') && (
                <TabsContent value="billing">
                    <BillingSettings />
                </TabsContent>
            )}
            {accessibleTabs.find(t => t.value === 'warehouse') && (
                <TabsContent value="warehouse">
                    <WarehouseSettings />
                </TabsContent>
            )}
            {accessibleTabs.find(t => t.value === 'crops_rates') && (
                <TabsContent value="crops_rates">
                    <CropsRatesSettings />
                </TabsContent>
            )}
            {accessibleTabs.find(t => t.value === 'data') && (
                <TabsContent value="data">
                    <DataSettings />
                </TabsContent>
            )}
            {accessibleTabs.find(t => t.value === 'notifications') && (
                 <TabsContent value="notifications">
                    <Card className="mt-6"><CardContent className="p-8 text-center text-muted-foreground">Notifications settings are not available yet.</CardContent></Card>
                </TabsContent>
            )}
            {accessibleTabs.find(t => t.value === 'sms') && (
                 <TabsContent value="sms">
                    <SmsSettings />
                </TabsContent>
            )}
        </Tabs>
    );
}
