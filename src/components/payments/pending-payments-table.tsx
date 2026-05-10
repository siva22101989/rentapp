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
};

export function PendingPaymentsTable({ records, customers, unloadingRecords }: { records: StorageRecord[], customers: Customer[], unloadingRecords: UnloadingRecord[] }) {

    const pendingSummaries = useMemo(() => {
        if (!records || !unloadingRecords || !customers) return [];
        
        const summaryMap: Record<string, {
            totalBilled: number,
            amountPaid: number,
            totalHamaliLiability: number
        }> = {};
        
        const customerMap = new Map(customers.map(c => [c.id, c.name]));

        const getSummary = (id: string) => {
            if (!summaryMap[id]) {
                summaryMap[id] = {
                    totalBilled: 0,
                    amountPaid: 0,
                    totalHamaliLiability: 0
                };
            }
            return summaryMap[id];
        };

        // 1. Process Storage Records
        records.forEach(r => {
            const s = getSummary(r.customerId);
            const hamali = r.hamaliPayable || 0;
            const rent = r.totalRentBilled || 0;
            const khata = r.khataAmount || 0;
            const totalLiabilities = hamali + rent + khata;
            const totalPaid = (r.payments || []).reduce((acc, p) => acc + p.amount, 0);

            s.totalBilled += totalLiabilities;
            s.amountPaid += totalPaid;
            s.totalHamaliLiability += hamali;
        });

        // 2. Process Unloading Records (Remaining in plot)
        unloadingRecords.forEach(r => {
            const s = getSummary(r.customerId);
            const remainingBags = Math.max(0, (r.bagsUnloaded || 0) - (r.bagsSentToDrying || 0));
            const remainingHamaliLiability = remainingBags * (r.hamaliPerBag || 0);
            const totalPaid = (r.payments || []).reduce((acc, p) => acc + p.amount, 0);

            s.totalBilled += remainingHamaliLiability;
            s.amountPaid += totalPaid;
            s.totalHamaliLiability += remainingHamaliLiability;
        });

        // 3. Convert to array and filter
        return Object.entries(summaryMap).map(([customerId, data]) => {
            const balanceDue = data.totalBilled - data.amountPaid;
            
            // Financial Allocation Rule: Payments settle Hamali first
            const hamaliPending = Math.max(0, data.totalHamaliLiability - data.amountPaid);
            const rentPending = Math.max(0, balanceDue - hamaliPending);

            return {
                customerId,
                customerName: customerMap.get(customerId) || 'Unknown',
                totalBilled: data.totalBilled,
                amountPaid: data.amountPaid,
                balanceDue,
                hamaliPending,
                rentPending
            } as CustomerPendingSummary;
        })
        .filter(s => s.balanceDue > 0.5) // Only show those with balance
        .sort((a, b) => b.balanceDue - a.balanceDue);

    }, [records, unloadingRecords, customers]);

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between print-hide">
                <CardTitle>Outstanding Balances (Consolidated)</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="printable-area">
                    <PendingDuesReportTable
                        summaries={pendingSummaries}
                        title="Customer-wise Pending Dues Report"
                    />
                </div>
            </CardContent>
        </Card>
  );
}
