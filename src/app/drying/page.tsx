
'use client';

import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/shared/page-header";
import { useCollection } from "@/firebase/firestore/use-collection";
import { useFirestore } from "@/firebase";
import { collection } from "firebase/firestore";
import type { Customer, DryingRecord } from "@/lib/definitions";
import { useMemoFirebase } from "@/hooks/use-memo-firebase";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AddDryingRecordForm } from "@/components/drying/add-drying-form";
import { DryingRecordsTable } from "@/components/drying/drying-records-table";

export default function DryingPage() {
    const firestore = useFirestore();

    const customersQuery = useMemoFirebase(
        () => (firestore ? collection(firestore, 'customers') : null),
        [firestore]
    );
    const { data: customers, loading: loadingCustomers } = useCollection<Customer>(customersQuery);

    const dryingRecordsQuery = useMemoFirebase(
        () => (firestore ? collection(firestore, 'dryingRecords') : null),
        [firestore]
    );
    const { data: dryingRecords, loading: loadingDryingRecords } = useCollection<DryingRecord>(dryingRecordsQuery);

    if (loadingCustomers || loadingDryingRecords) {
        return <AppLayout><div>Loading...</div></AppLayout>;
    }

    return (
        <AppLayout>
            <PageHeader
                title="Paddy Drying Process"
                description="Manage the entire workflow from unloading to billing."
            />
            <Tabs defaultValue="overview">
                <TabsList className="grid w-full grid-cols-2 md:w-[400px]">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="add">Add New Record</TabsTrigger>
                </TabsList>
                <TabsContent value="overview">
                    <Card>
                        <CardContent className="p-6">
                            <DryingRecordsTable records={dryingRecords || []} customers={customers || []} />
                        </CardContent>
                    </Card>
                </TabsContent>
                <TabsContent value="add">
                     <Card>
                        <CardContent className="p-6">
                            <AddDryingRecordForm customers={customers || []} />
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </AppLayout>
    );
}
