
'use client';
import { useMemo } from "react";
import type { Customer, StorageRecord, UnloadingRecord } from "@/lib/definitions";
import { PendingDuesReportTable } from "../reports/pending-dues-report-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toDate } from "@/lib/utils";

export type CustomerPendingSummary = {
    customerId: string;
    customerName: string;
    totalBilled: number;
    amountPaid: number;
    balanceDue: number;
    hamaliPending: number;
    rentPending: number;
    recordCount: number;
};

export function PendingPaymentsTable({ records, customers, unloadingRecords }: { records: StorageRecord[], customers: Customer[], unloadingRecords: UnloadingRecord[] }) {

    const pendingSummaries = useMemo(() => {
        if (!records || !unloadingRecords || !customers) return [];
        
        const summaryMap: Record<string, CustomerPendingSummary> = {};
        const customerMap = new Map(customers.map(c => [c.id, c.name]));

        // Helper to get or init summary
        const getSummary = (customerId: string) => {
            if (!summaryMap[customerId]) {
                summaryMap[customerId] = {
                    customerId,
                    customerName: customerMap.get(customerId) || 'Unknown',
                    totalBilled: 0,
                    amountPaid: 0,
                    balanceDue: 0,
                    hamaliPending: 0,
                    rentPending: 0,
                    recordCount: 0,
                };
            }
            return summaryMap[customerId];
        };

        // Process Storage Records
        records.forEach(record => {
            const hamaliPayable = record.hamaliPayable || 0;
            const totalRentBilled = record.totalRentBilled || 0;

            const hamaliPaid = (record.payments || [])
                .filter(p => p.type === 'hamali')
                .reduce((acc, p) => acc + p.amount, 0);

            const rentPaid = (record.payments || [])
                .filter(p => p.type === 'rent')
                .reduce((acc, p) => acc + p.amount, 0);
            
            const otherPaid = (record.payments || [])
                .filter(p => p.type === 'other' || !p.type || p.type === 'discount')
                .reduce((acc, p) => acc + p.amount, 0);

            const totalBilled = hamaliPayable + totalRentBilled;
            const amountPaid = hamaliPaid + rentPaid + otherPaid;
            const balanceDue = totalBilled - amountPaid;

            if (balanceDue > 0.5) {
                const s = getSummary(record.customerId);
                s.totalBilled += totalBilled;
                s.amountPaid += amountPaid;
                s.balanceDue += balanceDue;
                s.hamaliPending += Math.max(0, hamaliPayable - hamaliPaid);
                s.rentPending += Math.max(0, totalRentBilled - rentPaid - otherPaid);
                s.recordCount++;
            }
        });

        // Process Unloading Records
        unloadingRecords.forEach(record => {
            const totalBilled = record.totalHamali || 0;
            const amountPaid = (record.payments || []).reduce((acc, p) => acc + p.amount, 0);
            const balanceDue = totalBilled - amountPaid;

            if (balanceDue > 0.5) {
                const s = getSummary(record.customerId);
                s.totalBilled += totalBilled;
                s.amountPaid += amountPaid;
                s.balanceDue += balanceDue;
                s.hamaliPending += Math.max(0, balanceDue);
                s.recordCount++;
            }
        });

        return Object.values(summaryMap).sort((a, b) => b.balanceDue - a.balanceDue);
    }, [records, unloadingRecords, customers]);

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between print-hide">
                <CardTitle>Outstanding Balances (By Customer)</CardTitle>
            </CardHeader>
            <CardContent>
                <div>
                    <PendingDuesReportTable
                        summaries={pendingSummaries}
                        title="Customer-wise Pending Dues Report"
                    />
                </div>
            </CardContent>
        </Card>
  );
}
