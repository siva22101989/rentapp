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
            recordPaid: number,
            lastDate: number
        }> = {};
        
        const customerMap = new Map(customers.map(c => [c.id, c.name]));

        const getSummary = (id: string) => {
            if (!summaryMap[id]) {
                summaryMap[id] = {
                    hLiability: 0,
                    rLiability: 0,
                    recordPaid: 0,
                    lastDate: 0
                };
            }
            return summaryMap[id];
        };

        // 1. Process Storage Records
        records.forEach(r => {
            const s = getSummary(r.customerId);
            const inflowHamali = r.hamaliPayable || 0; 
            const billedRent = r.totalRentBilled || 0;
            const khata = r.khataAmount || 0;
            s.hLiability += inflowHamali;
            s.rLiability += billedRent + khata;
            s.recordPaid += (r.payments || []).reduce((acc, p) => acc + p.amount, 0);
            const rDate = toDate(r.storageStartDate).getTime();
            if (rDate > s.lastDate) s.lastDate = rDate;
        });

        // 2. Process Unloading Records
        unloadingRecords.forEach(r => {
            const s = getSummary(r.customerId);
            const remainingBags = Math.max(0, (r.bagsUnloaded || 0) - (r.bagsSentToDrying || 0));
            const hLiability = remainingBags * (r.hamaliPerBag || 0);
            s.hLiability += hLiability;
            s.recordPaid += (r.payments || []).reduce((acc, p) => acc + p.amount, 0);
            const uDate = toDate(r.unloadingDate).getTime();
            if (uDate > s.lastDate) s.lastDate = uDate;
        });

        return Object.entries(summaryMap).map(([customerId, data]) => {
            // Factor in bulk customer payments that are not tied to bills
            const bulkPaymentsForCust = customerPayments.filter(cp => cp.customerId === customerId);
            const totalBulkPaid = bulkPaymentsForCust.reduce((acc, cp) => acc + (cp.amount || 0), 0);
            
            const totalLiability = data.hLiability + data.rLiability;
            const totalPaid = data.recordPaid + totalBulkPaid;
            const balanceDue = Math.max(0, totalLiability - totalPaid);

            const hamaliPending = Math.max(0, data.hLiability - totalPaid);
            const rentPending = Math.max(0, balanceDue - hamaliPending);

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
        .sort((a, b) => b.lastActivityDate.getTime() - a.lastActivityDate.getTime());

    }, [records, unloadingRecords, customers, customerPayments]);

    return (
        <div className="space-y-4">
            <div className="table-scroll-container overflow-x-auto overflow-y-hidden">
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