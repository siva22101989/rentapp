
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
            hLiability: number,
            hPaid: number,
            rLiability: number,
            rPaid: number,
            lastDate: number
        }> = {};
        
        const customerMap = new Map(customers.map(c => [c.id, c.name]));
        const today = new Date();

        const getSummary = (id: string) => {
            if (!summaryMap[id]) {
                summaryMap[id] = {
                    hLiability: 0,
                    hPaid: 0,
                    rLiability: 0,
                    rPaid: 0,
                    lastDate: 0
                };
            }
            return summaryMap[id];
        };

        // 1. Process Storage Records
        records.forEach(r => {
            const s = getSummary(r.customerId);
            
            const inflowHamali = r.hamaliPayable || 0; 
            const hamaliPaid = (r.payments || []).filter(p => p.type === 'hamali' || p.type === 'unloading').reduce((acc, p) => acc + p.amount, 0);
            
            let accruedRent = 0;
            if (r.bagsStored > 0 && !r.storageEndDate) {
                const { rent } = calculateFinalRent({ ...r, storageStartDate: toDate(r.storageStartDate) }, today, r.bagsStored);
                accruedRent = rent;
            }
            const rentLiability = (r.totalRentBilled || 0) + (r.khataAmount || 0) + accruedRent;
            const rentPaid = (r.payments || []).filter(p => p.type === 'rent' || p.type === 'other' || !p.type || p.type === 'discount').reduce((acc, p) => acc + p.amount, 0);

            s.hLiability += inflowHamali;
            s.hPaid += hamaliPaid;
            s.rLiability += rentLiability;
            s.rPaid += rentPaid;
            
            const rDate = toDate(r.storageStartDate).getTime();
            if (rDate > s.lastDate) s.lastDate = rDate;
        });

        // 2. Process Unloading Records
        unloadingRecords.forEach(r => {
            const s = getSummary(r.customerId);
            const remainingBags = Math.max(0, (r.bagsUnloaded || 0) - (r.bagsSentToDrying || 0));
            const hLiability = remainingBags * (r.hamaliPerBag || 0);
            const hPaid = (r.payments || []).reduce((acc, p) => acc + p.amount, 0);
            
            s.hLiability += hLiability;
            s.hPaid += hPaid;

            const uDate = toDate(r.unloadingDate).getTime();
            if (uDate > s.lastDate) s.lastDate = uDate;
        });

        return Object.entries(summaryMap).map(([customerId, data]) => {
            const hamaliPending = Math.max(0, data.hLiability - data.hPaid);
            const rentPending = Math.max(0, data.rLiability - data.rPaid);
            const balanceDue = hamaliPending + rentPending;

            return {
                customerId,
                customerName: customerMap.get(customerId) || 'Unknown',
                totalBilled: data.hLiability + data.rLiability,
                amountPaid: data.hPaid + data.rPaid,
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
