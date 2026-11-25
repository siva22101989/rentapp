'use client';
import { useMemo } from "react";
import type { Customer, StorageRecord, UnloadingRecord, CustomerPayment } from "@/lib/definitions";
import { PendingDuesReportTable } from "../reports/pending-dues-report-table";
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

export function PendingPaymentsTable({ records, customers, unloadingRecords, customerPayments = [], title = "Pending Dues Register" }: { records: StorageRecord[], customers: Customer[], unloadingRecords: UnloadingRecord[], customerPayments?: CustomerPayment[], title?: string }) {

    const pendingSummaries = useMemo(() => {
        if (!records || !unloadingRecords || !customers) return [];
        
        const summaryMap: Record<string, {
            hLiability: number,
            rLiability: number,
            hPaid: number,
            rPaid: number,
            lastDate: number
        }> = {};
        
        const customerMap = new Map(customers.map(c => [c.id, c.name]));

        const getSummary = (id: string) => {
            if (!summaryMap[id]) {
                summaryMap[id] = {
                    hLiability: 0,
                    rLiability: 0,
                    hPaid: 0,
                    rPaid: 0,
                    lastDate: 0
                };
            }
            return summaryMap[id];
        };

        // 1. Process Storage Records
        records.forEach(r => {
            const s = getSummary(r.customerId);
            s.hLiability += Number(r.hamaliPayable) || 0; 
            s.rLiability += (Number(r.totalRentBilled) || 0) + (Number(r.khataAmount) || 0);
            
            (r.payments || []).forEach(p => {
                const amt = Number(p.amount) || 0;
                if (p.type === 'hamali' || p.type === 'unloading') {
                    s.hPaid += amt;
                } else {
                    // Include 'rent', 'discount', 'other' etc into Rent column pool
                    s.rPaid += amt;
                }
            });

            const rDate = toDate(r.storageStartDate).getTime();
            if (rDate > s.lastDate) s.lastDate = rDate;
        });

        // 2. Process Unloading Records
        unloadingRecords.forEach(r => {
            const s = getSummary(r.customerId);
            const remainingBags = Math.max(0, (Number(r.bagsUnloaded) || 0) - (Number(r.bagsSentToDrying) || 0));
            const hLiability = remainingBags * (Number(r.hamaliPerBag) || 0);
            s.hLiability += hLiability;
            
            (r.payments || []).forEach(p => {
                const amt = Number(p.amount) || 0;
                // Unloading payments are primarily Hamali
                if (p.type === 'discount') s.hPaid += amt;
                else s.hPaid += amt;
            });

            const uDate = toDate(r.unloadingDate).getTime();
            if (uDate > s.lastDate) s.lastDate = uDate;
        });

        // 3. Process Bulk Account Ledger Payments
        (customerPayments || []).forEach(cp => {
            const s = getSummary(cp.customerId);
            const amt = Number(cp.amount) || 0;
            if (cp.type === 'hamali') s.hPaid += amt;
            else s.rPaid += amt;
            
            const pDate = toDate(cp.date).getTime();
            if (pDate > s.lastDate) s.lastDate = pDate;
        });

        return Object.entries(summaryMap).map(([customerId, data]) => {
            const totalLiability = data.hLiability + data.rLiability;
            const totalPaid = data.hPaid + data.rPaid;
            const balanceDue = Math.max(0, totalLiability - totalPaid);

            const hamaliPending = Math.max(0, data.hLiability - data.hPaid);
            const rentPending = Math.max(0, data.rLiability - data.rPaid);

            return {
                customerId,
                customerName: customerMap.get(customerId) || 'Unknown',
                totalBilled: totalLiability,
                amountPaid: totalPaid,
                balanceDue,
                hamaliPending,
                rentPending,
                lastActivityDate: new Date(data.lastDate)
            } as CustomerPendingSummary;
        })
        .filter(s => s.balanceDue > 0.5) 
        .sort((a, b) => b.balanceDue - a.balanceDue); // Sort by highest dues

    }, [records, unloadingRecords, customers, customerPayments]);

    return (
        <div className="space-y-4">
            <div className="table-scroll-container overflow-x-auto">
                <PendingDuesReportTable
                    summaries={pendingSummaries}
                    title={title}
                    customers={customers}
                    storageRecords={records}
                    unloadingRecords={unloadingRecords}
                    customerPayments={customerPayments}
                />
            </div>
        </div>
  );
}