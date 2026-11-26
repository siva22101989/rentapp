
'use client';
import { useMemo } from "react";
import type { Customer, StorageRecord, UnloadingRecord, CustomerPayment, Expense } from "@/lib/definitions";
import { PendingDuesReportTable } from "../reports/pending-dues-report-table";
import { toDate, formatCurrency } from "@/lib/utils";
import { Card, CardContent } from "../ui/card";

export type CustomerPendingSummary = {
    customerId: string;
    customerName: string;
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
    expenses = [],
    title = "Pending Dues Register" 
}: { 
    records: StorageRecord[], 
    customers: Customer[], 
    unloadingRecords: UnloadingRecord[], 
    customerPayments?: CustomerPayment[], 
    expenses?: Expense[],
    title?: string 
}) {

    const { pendingSummaries, globalWorkerBalance } = useMemo(() => {
        if (!records || !unloadingRecords || !customers) return { pendingSummaries: [], globalWorkerBalance: 0 };
        
        const summaryMap: Record<string, {
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
                    customerHamaliBilled: 0,
                    customerHamaliPaid: 0,
                    rentBilled: 0,
                    rentPaid: 0,
                    lastDate: 0
                };
            }
            return summaryMap[id];
        };

        // --- GLOBAL WORKER MATH ---
        let totalWorkerEarned = 0;
        let totalWorkerPaid = 0;

        // 1. Process Storage Records
        records.forEach(r => {
            const s = getSummary(r.customerId);
            
            // Global Worker Side (Liability)
            totalWorkerEarned += Number(r.workerHamaliPayable ?? r.hamaliPayable) || 0;
            
            // Customer Side (Receivables)
            s.customerHamaliBilled += Number(r.hamaliPayable) || 0;
            s.rentBilled += (Number(r.totalRentBilled) || 0) + (Number(r.khataAmount) || 0);
            
            (r.payments || []).forEach(p => {
                const amt = Number(p.amount) || 0;
                if (p.type === 'hamali' || p.type === 'unloading') {
                    s.customerHamaliPaid += amt;
                } else if (p.type === 'discount') {
                   // Discounts usually reduce Rent balance unless specified
                   s.rentPaid += amt;
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
            
            // Global Worker Side (Liability)
            const workerBase = Number(r.workerHamaliPayable ?? r.totalHamali) || 0;
            totalWorkerEarned += (workerBase * proportion);
            
            // Customer Side (Receivables)
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

        // 4. Process Hamali Paid (Expenses - Distributions to Workers)
        (expenses || []).forEach(e => {
            if (e.category === 'Hamali Paid') {
                totalWorkerPaid += Number(e.amount) || 0;
            }
        });

        const summaries = Object.entries(summaryMap).map(([customerId, data]) => {
            const hPending = Math.max(0, data.customerHamaliBilled - data.customerHamaliPaid);
            const rPending = Math.max(0, data.rentBilled - data.rentPaid);

            return {
                customerId,
                customerName: customerMap.get(customerId) || 'Unknown',
                customerHamaliPending: hPending,
                rentPending: rPending,
                totalBalance: hPending + rPending,
                lastActivityDate: new Date(data.lastDate)
            } as CustomerPendingSummary;
        });

        return {
            pendingSummaries: summaries
                .filter(s => s.totalBalance > 0.01)
                .sort((a, b) => b.lastActivityDate.getTime() - a.lastActivityDate.getTime()),
            globalWorkerBalance: totalWorkerEarned - totalWorkerPaid
        };

    }, [records, unloadingRecords, customers, customerPayments, expenses]);

    return (
        <div className="space-y-6">
            {/* Global Hamali Balance Summary (Top Side) */}
            <div className="flex justify-center">
                <Card className={`w-full max-w-sm border-2 shadow-sm transition-colors ${
                    globalWorkerBalance >= 0 ? 'bg-orange-50 border-orange-200' : 'bg-green-50 border-green-200'
                }`}>
                    <CardContent className="p-4 text-center">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-1">
                            Net Hamali Workers Balance
                        </p>
                        <p className={`text-2xl font-black ${globalWorkerBalance >= 0 ? 'text-orange-700' : 'text-green-700'}`}>
                            {formatCurrency(globalWorkerBalance)}
                        </p>
                        <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-tighter">
                            {globalWorkerBalance >= 0 ? 'Warehouse Liability (Owed)' : 'Current Hamali Advance'}
                        </p>
                    </CardContent>
                </Card>
            </div>

            <div className="table-scroll-container overflow-x-auto">
                <PendingDuesReportTable
                    summaries={pendingSummaries}
                    globalWorkerBalance={globalWorkerBalance}
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
