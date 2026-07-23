'use client';

import { useState } from 'react';
import type { Customer, StorageRecord, UnloadingRecord, WarehouseInfo, Commodity, Lot, CustomerPayment } from "@/lib/definitions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CustomerStatement } from './customer-statement';
import { useDoc } from '@/firebase/firestore/use-doc';
import { useFirestore } from '@/firebase/provider';
import { doc } from 'firebase/firestore';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { useAppUser } from '@/firebase/auth/use-user';

export function ReportClient({ records, customers, unloadingRecords, initialCustomerId, allRecords, commodities, lots, customerPayments }: { records: StorageRecord[], customers: Customer[], unloadingRecords: UnloadingRecord[], initialCustomerId?: string, allRecords: StorageRecord[], commodities: Commodity[], lots: Lot[], customerPayments?: CustomerPayment[] }) {
    const [selectedCustomerId, setSelectedCustomerId] = useState<string>(initialCustomerId || '');
    const firestore = useFirestore();
    const appUser = useAppUser();

    const statementCustomer = customers.find(c => c.id === selectedCustomerId);
    const statementRecords = records.filter(r => r.customerId === selectedCustomerId);
    const statementUnloadingRecords = unloadingRecords.filter(r => r.customerId === selectedCustomerId);

    const warehouseInfoRef = useMemoFirebase(
      () => (firestore && appUser?.warehouseId ? doc(firestore, 'warehouses', appUser.warehouseId) : null),
      [firestore, appUser]
    );
    const { data: warehouseInfo } = useDoc<WarehouseInfo>(warehouseInfoRef);

    return (
        <Card className="border-none shadow-none bg-transparent">
            <CardHeader className="flex-col md:flex-row items-start md:items-center justify-between gap-4 print-hide p-0 pb-6">
                <div className="flex-1">
                    <CardTitle className="text-xl font-bold uppercase tracking-tight">Statement of Account</CardTitle>
                    <CardDescription className="text-xs font-medium">Select a customer to generate a detailed ledger of their physical and financial position.</CardDescription>
                </div>
                 <div className="flex items-center gap-4 w-full md:w-auto">
                    <Select onValueChange={setSelectedCustomerId} value={selectedCustomerId}>
                        <SelectTrigger className="w-full md:w-[320px] h-10 font-bold border-2">
                            <SelectValue placeholder="Select a customer..." />
                        </SelectTrigger>
                        <SelectContent>
                            {customers.map(customer => (
                                <SelectItem key={customer.id} value={customer.id} className="text-sm font-medium">
                                    {customer.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                {statementCustomer ? (
                    <div>
                        <CustomerStatement 
                            customer={statementCustomer} 
                            records={statementRecords} 
                            unloadingRecords={statementUnloadingRecords} 
                            warehouseInfo={warehouseInfo}
                            allRecords={allRecords}
                            commodities={commodities}
                            lots={lots}
                            customers={customers}
                            customerPayments={customerPayments}
                        />
                    </div>
                ) : (
                    <div className="text-center text-muted-foreground py-24 border-2 border-dashed rounded-xl bg-white">
                        Please select a customer from the dropdown above to view their statement.
                    </div>
                )}
            </CardContent>
        </Card>
    );
}