
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
            // Liabilities
            const hamaliLiability = record.hamaliPayable || 0;
            const rentLiability = record.totalRentBilled || 0;
            const khataLiability = record.khataAmount || 0;
            const totalLiabilities = hamaliLiability + rentLiability + khataLiability;

            // All Payments (sum everything regardless of type for total accuracy)
            const totalPaid = (record.payments || []).reduce((acc, p) => acc + p.amount, 0);
            
            const balanceDue = totalLiabilities - totalPaid;

            // Only include records with an actual outstanding balance
            if (balanceDue > 0.5) {
                const s = getSummary(record.customerId);
                s.totalBilled += totalLiabilities;
                s.amountPaid += totalPaid;
                s.balanceDue += balanceDue;
                
                // Determine breakdown (apply payments to hamali first, then rent/khata)
                const hamaliPending = Math.max(0, hamaliLiability - totalPaid);
                const remainingPaidAfterHamali = Math.max(0, totalPaid - hamaliLiability);
                const rentPending = Math.max(0, (rentLiability + khataLiability) - remainingPaidAfterHamali);
                
                s.hamaliPending += hamaliPending;
                s.rentPending += rentPending;
                s.recordCount++;
            }
        });

        // Process Unloading Records (which only have hamali liability)
        unloadingRecords.forEach(record => {
            const hamaliLiability = record.totalHamali || 0;
            const totalPaid = (record.payments || []).reduce((acc, p) => acc + p.amount, 0);
            const balanceDue = hamaliLiability - totalPaid;

            if (balanceDue > 0.5) {
                const s = getSummary(record.customerId);
                s.totalBilled += hamaliLiability;
                s.amountPaid += totalPaid;
                s.balanceDue += balanceDue;
                s.hamaliPending += balanceDue;
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
