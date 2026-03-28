'use client';

import { useState } from 'react';
import type { Customer, StorageRecord, UnloadingRecord, WarehouseInfo } from "@/lib/definitions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CustomerStatement } from './customer-statement';
import { useDoc } from '@/firebase/firestore/use-doc';
import { useFirestore } from '@/firebase/provider';
import { doc } from 'firebase/firestore';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';

export function ReportClient({ records, customers, unloadingRecords, initialCustomerId }: { records: StorageRecord[], customers: Customer[], unloadingRecords: UnloadingRecord[], initialCustomerId?: string }) {
    const [selectedCustomerId, setSelectedCustomerId] = useState<string>(initialCustomerId || '');
    const firestore = useFirestore();

    const statementCustomer = customers.find(c => c.id === selectedCustomerId);
    const statementRecords = records.filter(r => r.customerId === selectedCustomerId);
    const statementUnloadingRecords = unloadingRecords.filter(r => r.customerId === selectedCustomerId);

    const warehouseInfoRef = useMemoFirebase(
      () => (firestore ? doc(firestore, 'settings', 'main') : null),
      [firestore]
    );
    const { data: warehouseInfo } = useDoc<WarehouseInfo>(warehouseInfoRef);

    return (
        <Card>
            <CardHeader className="flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex-1">
                    <CardTitle>Customer Statement of Account</CardTitle>
                    <CardDescription>Select a customer to generate a detailed statement of their account activity.</CardDescription>
                </div>
                 <div className="flex items-center gap-4 w-full md:w-auto">
                    <Select onValueChange={setSelectedCustomerId} value={selectedCustomerId}>
                        <SelectTrigger className="w-full md:w-[280px]">
                            <SelectValue placeholder="Select a customer..." />
                        </SelectTrigger>
                        <SelectContent>
                            {customers.map(customer => (
                                <SelectItem key={customer.id} value={customer.id}>
                                    {customer.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </CardHeader>
            <CardContent>
                {statementCustomer ? (
                    <div>
                        <CustomerStatement 
                            customer={statementCustomer} 
                            records={statementRecords} 
                            unloadingRecords={statementUnloadingRecords} 
                            warehouseInfo={warehouseInfo}
                        />
                    </div>
                ) : (
                    <div className="text-center text-muted-foreground py-16">
                        Please select a customer to view their statement.
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
