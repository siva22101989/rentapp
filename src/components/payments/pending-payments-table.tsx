'use client';
import { useMemo } from "react";
import type { Customer, StorageRecord, UnloadingRecord } from "@/lib/definitions";
import { PendingDuesReportTable } from "../reports/pending-dues-report-table";
import { toDate } from "@/lib/utils";
import { calculateFinalRent } from "@/lib/billing";

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

export function PendingPaymentsTable({ records, customers, unloadingRecords, title = "Pending Dues Register" }: { records: StorageRecord[], customers: Customer[], unloadingRecords: UnloadingRecord[], title?: string }) {

    const pendingSummaries = useMemo(() => {
        if (!records || !unloadingRecords || !customers) return [];
        
        const summaryMap: Record<string, {
            totalBilled: number,
            amountPaid: number,
            totalHamaliLiability: number,
            lastDate: number
        }> = {};
        
        const customerMap = new Map(customers.map(c => [c.id, c.name]));
        const today = new Date();

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

        // 1. Process All Storage Records (including estimated accrued rent)
        records.forEach(r => {
            const s = getSummary(r.customerId);
            
            // Fixed Liabilities: Inflow Hamali + Khata + Rent from ALREADY processed outflows
            const inflowHamali = r.hamaliPayable || 0; 
            const alreadyBilledRent = r.totalRentBilled || 0;
            const khata = r.khataAmount || 0;
            
            // Accrued Liability: Rent on bags CURRENTLY in stock
            let accruedRent = 0;
            if (r.bagsStored > 0 && !r.storageEndDate) {
                const { rent } = calculateFinalRent({ ...r, storageStartDate: toDate(r.storageStartDate) }, today, r.bagsStored);
                accruedRent = rent;
            }

            const totalLiabilities = inflowHamali + alreadyBilledRent + khata + accruedRent;
            const totalPaid = (r.payments || []).reduce((acc, p) => acc + p.amount, 0);

            s.totalBilled += totalLiabilities;
            s.amountPaid += totalPaid;
            s.totalHamaliLiability += inflowHamali;
            
            const rDate = toDate(r.storageStartDate).getTime();
            if (rDate > s.lastDate) s.lastDate = rDate;
        });

        // 2. Process Unloading Records (Bags not yet moved to Godown)
        unloadingRecords.forEach(r => {
            const s = getSummary(r.customerId);
            const remainingBags = Math.max(0, (r.bagsUnloaded || 0) - (r.bagsSentToDrying || 0));
            if (remainingBags <= 0) return;

            const remainingHamaliLiability = remainingBags * (r.hamaliPerBag || 0);
            const totalPaidOnUnloading = (r.payments || []).reduce((acc, p) => acc + p.amount, 0);
            
            s.totalBilled += remainingHamaliLiability;
            s.amountPaid += totalPaidOnUnloading;
            s.totalHamaliLiability += remainingHamaliLiability;

            const uDate = toDate(r.unloadingDate).getTime();
            if (uDate > s.lastDate) s.lastDate = uDate;
        });

        return Object.entries(summaryMap).map(([customerId, data]) => {
            const balanceDue = data.totalBilled - data.amountPaid;
            // Logical split: First clear hamali, then rent
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
        .filter(s => s.balanceDue > 0.5) // Filter out negligible balances
        .sort((a, b) => b.lastActivityDate.getTime() - a.lastActivityDate.getTime());

    }, [records, unloadingRecords, customers]);

    return (
        <div className="space-y-4">
            <div className="table-scroll-container printable-area">
                <PendingDuesReportTable
                    summaries={pendingSummaries}
                    title={title}
                />
            </div>
        </div>
  );
}