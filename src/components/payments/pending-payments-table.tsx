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
    lastActivityDate: Date;
};

export function PendingPaymentsTable({ records, customers, unloadingRecords, title = "Consolidated Pending Dues Register" }: { records: StorageRecord[], customers: Customer[], unloadingRecords: UnloadingRecord[], title?: string }) {

    const pendingSummaries = useMemo(() => {
        if (!records || !unloadingRecords || !customers) return [];
        
        const summaryMap: Record<string, {
            totalBilled: number,
            amountPaid: number,
            totalHamaliLiability: number,
            lastDate: number
        }> = {};
        
        const customerMap = new Map(customers.map(c => [c.id, c.name]));

        const getSummary = (id: string) => {
            if (!summaryMap[id]) {
                summaryMap[id] = {
                    totalBilled: 0,
                    amountPaid: 0,
                    totalHamaliLiability: 0,
                    lastDate: 0
                };
            }
            return summaryMap[id];
        };

        // 1. Process All Storage Records
        records.forEach(r => {
            const s = getSummary(r.customerId);
            // Patti hamaliPayable was already calculated on Truck Bags in InitiateDryingForm
            const hamali = r.hamaliPayable || 0; 
            const rent = r.totalRentBilled || 0;
            const khata = r.khataAmount || 0;
            const totalLiabilities = hamali + rent + khata;
            const totalPaid = (r.payments || []).reduce((acc, p) => acc + p.amount, 0);

            s.totalBilled += totalLiabilities;
            s.amountPaid += totalPaid;
            s.totalHamaliLiability += hamali;
            
            const rDate = toDate(r.storageStartDate).getTime();
            if (rDate > s.lastDate) s.lastDate = rDate;
        });

        // 2. Process Unloading Records (Only count bags still in plot)
        unloadingRecords.forEach(r => {
            const s = getSummary(r.customerId);
            const remainingBags = Math.max(0, (r.bagsUnloaded || 0) - (r.bagsSentToDrying || 0));
            const remainingHamaliLiability = remainingBags * (r.hamaliPerBag || 0);
            const totalPaidOnUnloading = (r.payments || []).reduce((acc, p) => acc + p.amount, 0);
            
            s.totalBilled += remainingHamaliLiability;
            s.amountPaid += totalPaidOnUnloading;
            s.totalHamaliLiability += remainingHamaliLiability;

            const uDate = toDate(r.unloadingDate).getTime();
            if (uDate > s.lastDate) s.lastDate = uDate;
        });

        // 3. Convert to array and calculate breakdowns
        return Object.entries(summaryMap).map(([customerId, data]) => {
            const balanceDue = data.totalBilled - data.amountPaid;
            
            // Payments clear Hamali first
            const hamaliPending = Math.max(0, data.totalHamaliLiability - data.amountPaid);
            const rentPending = Math.max(0, balanceDue - hamaliPending);

            return {
                customerId,
                customerName: customerMap.get(customerId) || 'Unknown',
                totalBilled: data.totalBilled,
                amountPaid: data.amountPaid,
                balanceDue,
                hamaliPending,
                rentPending,
                lastActivityDate: new Date(data.lastDate)
            } as CustomerPendingSummary;
        })
        .filter(s => s.balanceDue > 0.5)
        .sort((a, b) => b.lastActivityDate.getTime() - a.lastActivityDate.getTime());

    }, [records, unloadingRecords, customers]);

    return (
        <Card>
            <CardHeader className="print-hide">
                <CardTitle>{title}</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="printable-area">
                    <PendingDuesReportTable
                        summaries={pendingSummaries}
                        title={title}
                    />
                </div>
            </CardContent>
        </Card>
  );
}