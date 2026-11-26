'use client';
import { useMemo } from "react";
import type { Customer, StorageRecord, UnloadingRecord, CustomerPayment } from "@/lib/definitions";
import { PendingDuesReportTable } from "../reports/pending-dues-report-table";
import { toDate } from "@/lib/utils";

export type CustomerPendingSummary = {
    customerId: string;
    customerName: string;
    workerHamaliEarned: number;     // Sum of Worker Rates (What we owe staff)
    customerHamaliPending: number;  // Sum of Customer Rates - Payments (What cust owes us for labor)
    rentPending: number;            // Sum of Rent + Khata - Payments (What cust owes us for storage)
    totalBalance: number;           // Net Customer Receivable (Hamali + Rent)
    lastActivityDate: Date;
};

export function PendingPaymentsTable({ 
    records, 
    customers, 
    unloadingRecords, 
    customerPayments = [], 
    title = "Pending Dues Register" 
}: { 
    records: StorageRecord[], 
    customers: Customer[], 
    unloadingRecords: UnloadingRecord[], 
    customerPayments?: CustomerPayment[], 
    title?: string 
}) {

    const pendingSummaries = useMemo(() => {
        if (!records || !unloadingRecords || !customers) return [];
        
        const summaryMap: Record<string, {
            workerHamaliEarned: number,
            customerHamaliBilled: number,
            customerHamaliPaid: number,
            rentBilled: number,
            rentPaid: number,
            lastDate: number
        }> = {};
        
        const customerMap = new Map(customers.map(c => [c.id, c.name]));

        const getSummary = (id: string) => {
            if (!summaryMap[id]) {
                summaryMap[id] = {
                    workerHamaliEarned: 0,
                    customerHamaliBilled: 0,
                    customerHamaliPaid: 0,
                    rentBilled: 0,
                    rentPaid: 0,
                    lastDate: 0
                };
            }
            return summaryMap[id];
        };

        // 1. Process Storage Records
        records.forEach(r => {
            const s = getSummary(r.customerId);
            
            // Worker Side
            s.workerHamaliEarned += Number(r.workerHamaliPayable ?? r.hamaliPayable) || 0;
            
            // Customer Side (Receivables)
            s.customerHamaliBilled += Number(r.hamaliPayable) || 0;
            s.rentBilled += (Number(r.totalRentBilled) || 0) + (Number(r.khataAmount) || 0);
            
            (r.payments || []).forEach(p => {
                const amt = Number(p.amount) || 0;
                if (p.type === 'hamali' || p.type === 'unloading') {
                    s.customerHamaliPaid += amt;
                } else {
                    s.rentPaid += amt;
                }
            });

            const rDate = toDate(r.storageStartDate).getTime();
            if (rDate > s.lastDate) s.lastDate = rDate;
        });

        // 2. Process Unloading Records
        unloadingRecords.forEach(r => {
            const s = getSummary(r.customerId);
            const remainingBags = Math.max(0, (Number(r.bagsUnloaded) || 0) - (Number(r.bagsSentToDrying) || 0));
            const proportion = Number(r.bagsUnloaded) > 0 ? remainingBags / Number(r.bagsUnloaded) : 0;
            
            // Worker Side
            const workerBase = Number(r.workerHamaliPayable ?? r.totalHamali) || 0;
            s.workerHamaliEarned += (workerBase * proportion);
            
            // Customer Side
            s.customerHamaliBilled += remainingBags * (Number(r.hamaliPerBag) || 0);
            
            (r.payments || []).forEach(p => {
                s.customerHamaliPaid += (Number(p.amount) || 0);
            });

            const uDate = toDate(r.unloadingDate).getTime();
            if (uDate > s.lastDate) s.lastDate = uDate;
        });

        // 3. Process Bulk Account Ledger
        (customerPayments || []).forEach(cp => {
            const s = getSummary(cp.customerId);
            const amt = Number(cp.amount) || 0;
            if (cp.type === 'hamali') s.customerHamaliPaid += amt;
            else s.rentPaid += amt;
            
            const pDate = toDate(cp.date).getTime();
            if (pDate > s.lastDate) s.lastDate = pDate;
        });

        return Object.entries(summaryMap).map(([customerId, data]) => {
            const hPending = Math.max(0, data.customerHamaliBilled - data.customerHamaliPaid);
            const rPending = Math.max(0, data.rentBilled - data.rentPaid);

            return {
                customerId,
                customerName: customerMap.get(customerId) || 'Unknown',
                workerHamaliEarned: data.workerHamaliEarned,
                customerHamaliPending: hPending,
                rentPending: rPending,
                totalBalance: hPending + rPending,
                lastActivityDate: new Date(data.lastDate)
            } as CustomerPendingSummary;
        })
        .filter(s => s.totalBalance > 0.01) // STRICT "Pending Balance Only" Filter - Hide zero balances
        .sort((a, b) => b.lastActivityDate.getTime() - a.lastActivityDate.getTime());

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