
'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User, Warehouse, Wheat, Database, Bell, MessageSquare, CreditCard } from "lucide-react";
import { ProfileSettings } from "./profile-settings";
import { WarehouseSettings } from "./warehouse-settings";
import { CropsRatesSettings } from "./crops-rates-settings";
import { DataSettings } from "./data-settings";
import { Card, CardContent } from "../ui/card";
import { SmsSettings } from "./sms-settings";
import { useAppUser } from "@/firebase/auth/use-user";

const allTabs = [
    { value: "profile", label: "Profile", icon: User, roles: ['owner', 'supervisor', 'biller'] },
    { value: "warehouse", label: "Warehouse", icon: Warehouse, roles: ['owner'] },
    { value: "crops_rates", label: "Crops & Rates", icon: Wheat, roles: ['owner'] },
    { value: "data", label: "Data", icon: Database, roles: ['owner'] },
    { value: "sms", label: "SMS", icon: MessageSquare, roles: ['owner'] },
    { value: "notifications", label: "Notifications", icon: Bell, roles: ['owner', 'supervisor', 'biller'] },
    { value: "billing", label: "Billing", icon: CreditCard, roles: ['owner'] },
];

export function SettingsLayout() {
    const appUser = useAppUser();

    const accessibleTabs = allTabs.filter(tab => appUser && tab.roles.includes(appUser.role));
    
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
                <TabsList className="grid w-full grid-cols-3 sm:w-auto sm:grid-cols-7 h-auto p-1">
                    {accessibleTabs.map((tab) => (
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
                <SmsSettings />
            </TabsContent>
             <TabsContent value="billing">
                <Card className="mt-6"><CardContent className="p-8 text-center text-muted-foreground">Billing settings are not available yet.</CardContent></Card>
            </TabsContent>
        </Tabs>
    );
}
