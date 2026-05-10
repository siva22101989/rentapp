'use client';
import { useMemo } from "react";
import type { Customer, StorageRecord, UnloadingRecord } from "@/lib/definitions";
import { PendingDuesReportTable } from "../reports/pending-dues-report-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
        
        const summaryMap: Record<string, {
            totalBilled: number,
            amountPaid: number,
            totalHamaliLiability: number,
            recordCount: number
        }> = {};
        
        const customerMap = new Map(customers.map(c => [c.id, c.name]));

        // Helper to get or initialize a customer summary
        const getSummary = (id: string) => {
            if (!summaryMap[id]) {
                summaryMap[id] = {
                    totalBilled: 0,
                    amountPaid: 0,
                    totalHamaliLiability: 0,
                    recordCount: 0
                };
            }
            return summaryMap[id];
        };

        // 1. Process Storage Records (Pattis)
        // These already contain their own hamali (including moved portion from plot) and rent
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
            s.recordCount++;
        });

        // 2. Process Unloading Records
        // To avoid double-counting, we only calculate hamali for bags NOT yet moved to storage
        unloadingRecords.forEach(r => {
            const s = getSummary(r.customerId);
            
            const remainingBags = Math.max(0, (r.bagsUnloaded || 0) - (r.bagsSentToDrying || 0));
            const remainingHamaliLiability = remainingBags * (r.hamaliPerBag || 0);
            const totalPaid = (r.payments || []).reduce((acc, p) => acc + p.amount, 0);

            s.totalBilled += remainingHamaliLiability;
            s.amountPaid += totalPaid;
            s.totalHamaliLiability += remainingHamaliLiability;
            
            // Increment record count if there is still something pending or if it's an active unloading record
            if (remainingBags > 0 || totalPaid > 0) {
                 s.recordCount++;
            }
        });

        // 3. Finalize and Filter only customers with a real balance
        return Object.entries(summaryMap).map(([customerId, data]) => {
            const balanceDue = data.totalBilled - data.amountPaid;
            
            // Financial Allocation Rule: Payments settle Hamali first, then Rent/Khata
            const hamaliPending = Math.max(0, data.totalHamaliLiability - data.amountPaid);
            const remainingPaidAfterHamali = Math.max(0, data.amountPaid - data.totalHamaliLiability);
            const rentPending = Math.max(0, (data.totalBilled - data.totalHamaliLiability) - remainingPaidAfterHamali);

            return {
                customerId,
                customerName: customerMap.get(customerId) || 'Unknown',
                totalBilled: data.totalBilled,
                amountPaid: data.amountPaid,
                balanceDue,
                hamaliPending,
                rentPending,
                recordCount: data.recordCount
            } as CustomerPendingSummary;
        })
        .filter(s => s.balanceDue > 0.5) // Ignore negligible or zero balances
        .sort((a, b) => b.balanceDue - a.balanceDue);

    }, [records, unloadingRecords, customers]);

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between print-hide">
                <CardTitle>Outstanding Balances (By Customer)</CardTitle>
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
