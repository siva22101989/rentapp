
'use client';
import { useMemo } from "react";
import type { Customer, StorageRecord, UnloadingRecord, CustomerPayment, Expense } from "@/lib/definitions";
import { PendingDuesReportTable } from "../reports/pending-dues-report-table";
import { toDate, formatCurrency } from "@/lib/utils";
import { Card, CardContent } from "../ui/card";

export type CustomerPendingSummary = {
    customerId: string;
    customerName: string;
    customerHamaliPending: number;  // What customer owes US (at Customer Rate)
    rentPending: number;            // What customer owes US for Rent/Khata
    totalBalance: number;           // Net Receivable from Customer
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

        // --- GLOBAL WORKER MATH (The "Staff Ledger" Totals) ---
        let totalWorkerEarned = 0;
        let totalWorkerPaid = 0;

        // 1. Process Storage Records
        records.forEach(r => {
            const s = getSummary(r.customerId);
            
            // Global Worker Side (Staff Payable +)
            // Match Hamali Ledger logic: worker rate if exists, otherwise fallback to customer rate
            const workerEarning = (r.workerHamaliPayable !== undefined && r.workerHamaliPayable !== null) 
                ? Number(r.workerHamaliPayable) 
                : (Number(r.hamaliPayable) || 0);
            
            totalWorkerEarned += workerEarning;
            
            // Customer Side (Receivables - What they owe the Godown)
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
            const totalBags = Number(r.bagsUnloaded) || 1;
            const proportion = remainingBags / totalBags;
            
            // Global Worker Side (Staff Payable +)
            const workerBase = (r.workerHamaliPayable !== undefined && r.workerHamaliPayable !== null)
                ? Number(r.workerHamaliPayable)
                : (Number(r.totalHamali) || 0);
            
            totalWorkerEarned += (workerBase * proportion);
            
            // Customer Side (Receivables)
            s.customerHamaliBilled += remainingBags * (Number(r.hamaliPerBag) || 0);
            
            (r.payments || []).forEach(p => {
                s.customerHamaliPaid += (Number(p.amount) || 0);
            });

            const uDate = toDate(r.unloadingDate).getTime();
            if (uDate > s.lastDate) s.lastDate = uDate;
        });

        // 3. Process Bulk Account Ledger (Global Payments from Customers)
        (customerPayments || []).forEach(cp => {
            const s = getSummary(cp.customerId);
            const amt = Number(cp.amount) || 0;
            if (cp.type === 'hamali') s.customerHamaliPaid += amt;
            else s.rentPaid += amt;
            
            const pDate = toDate(cp.date).getTime();
            if (pDate > s.lastDate) s.lastDate = pDate;
        });

        // 4. Process Cash Distributed (Expenses - Payments made to workers)
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
            {/* Global Hamali Workers Balance Summary (Top Side) */}
            <div className="flex justify-center">
                <Card className={`w-full max-w-sm border-2 shadow-sm transition-all duration-300 ${
                    globalWorkerBalance >= -0.01 ? 'bg-orange-50 border-orange-200' : 'bg-green-50 border-green-200'
                }`}>
                    <CardContent className="p-5 text-center">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-1">
                            Net Hamali Workers Balance
                        </p>
                        <p className={`text-3xl font-black ${globalWorkerBalance >= -0.01 ? 'text-orange-700' : 'text-green-700'}`}>
                            {formatCurrency(globalWorkerBalance)}
                        </p>
                        <p className="text-[9px] font-black text-slate-400 mt-2 uppercase tracking-tighter">
                            {globalWorkerBalance >= -0.01 ? 'Total Warehouse Liability (Payable)' : 'Current Total Hamali Advance'}
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
