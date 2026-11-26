
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

    const { pendingSummaries, globalWorkerBalance, totalWorkerEarned, totalWorkerPaid } = useMemo(() => {
        if (!records || !unloadingRecords || !customers) return { pendingSummaries: [], globalWorkerBalance: 0, totalWorkerEarned: 0, totalWorkerPaid: 0 };
        
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

        // --- GLOBAL WORKER MATH (Reconciled with Staff Ledger) ---
        let totalEarned = 0;
        let totalPaid = 0;

        // 1. Process Storage Records
        records.forEach(r => {
            const s = getSummary(r.customerId);
            
            // Worker Earning (Liability +)
            const workerEarning = (r.workerHamaliPayable !== undefined && r.workerHamaliPayable !== null) 
                ? Number(r.workerHamaliPayable) 
                : (Number(r.hamaliPayable) || 0);
            
            totalEarned += workerEarning;
            
            // Customer Receivables
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

            // Factor in Patti Discounts as Rent payments
            (r.outflows || []).forEach(o => {
                s.rentPaid += (Number(o.discount) || 0);
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
            
            const workerBase = (r.workerHamaliPayable !== undefined && r.workerHamaliPayable !== null)
                ? Number(r.workerHamaliPayable)
                : (Number(r.totalHamali) || 0);
            
            totalEarned += (workerBase * proportion);
            
            // Customer Side
            s.customerHamaliBilled += remainingBags * (Number(r.hamaliPerBag) || 0);
            
            (r.payments || []).forEach(p => {
                s.customerHamaliPaid += (Number(p.amount) || 0);
            });

            const uDate = toDate(r.unloadingDate).getTime();
            if (uDate > s.lastDate) s.lastDate = uDate;
        });

        // 3. Process Bulk Account Payments
        (customerPayments || []).forEach(cp => {
            const s = getSummary(cp.customerId);
            const amt = Number(cp.amount) || 0;
            if (cp.type === 'hamali') s.customerHamaliPaid += amt;
            else s.rentPaid += amt;
            
            const pDate = toDate(cp.date).getTime();
            if (pDate > s.lastDate) s.lastDate = pDate;
        });

        // 4. Process Cash Distributed (Vouchers)
        (expenses || []).forEach(e => {
            if (e.category === 'Hamali Paid') {
                totalPaid += Number(e.amount) || 0;
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
                .filter(s => Math.abs(s.totalBalance) > 0.01)
                .sort((a, b) => b.lastActivityDate.getTime() - a.lastActivityDate.getTime()),
            globalWorkerBalance: totalEarned - totalPaid,
            totalWorkerEarned: totalEarned,
            totalWorkerPaid: totalPaid
        };

    }, [records, unloadingRecords, customers, customerPayments, expenses]);

    return (
        <div className="space-y-6">
            {/* Global Hamali Workers Audit Card (Top Center) */}
            <div className="flex justify-center">
                <Card className={`w-full max-w-sm border-2 shadow-lg transition-all duration-300 ${
                    globalWorkerBalance >= -0.01 ? 'bg-orange-50 border-orange-200' : 'bg-green-50 border-green-200'
                }`}>
                    <CardContent className="p-6 text-center space-y-4">
                        <div className="space-y-1">
                            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">
                                Net Hamali Workers Balance
                            </p>
                            <p className={`text-4xl font-black ${globalWorkerBalance >= -0.01 ? 'text-orange-700' : 'text-green-700'}`}>
                                {formatCurrency(globalWorkerBalance)}
                            </p>
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">
                                {globalWorkerBalance >= -0.01 ? 'Total Warehouse Liability' : 'Net Staff Advance'}
                            </p>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-200">
                            <div className="text-center">
                                <p className="text-[9px] font-black uppercase text-slate-400">Staff Payable (+)</p>
                                <p className="text-sm font-bold text-slate-700">{formatCurrency(totalWorkerEarned)}</p>
                            </div>
                            <div className="text-center">
                                <p className="text-[9px] font-black uppercase text-slate-400">Cash Distributed (-)</p>
                                <p className="text-sm font-bold text-green-700">{formatCurrency(totalWorkerPaid)}</p>
                            </div>
                        </div>
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
