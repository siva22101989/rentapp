'use client';
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, toDate } from "@/lib/utils";
import { useMemo } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import type { Expense, StorageRecord, UnloadingRecord, WarehouseInfo, Borrowing, Lending, OtherIncome, CustomerPayment } from "@/lib/definitions";
import { format, differenceInDays } from "date-fns";
import { useDateFilter } from "@/firebase/provider";
import { calculateFinalRent } from "@/lib/billing";

function calculateLoanBalances(loan: Borrowing | Lending) {
    const principal = Number(loan.principal) || 0;
    const monthlyRate = (Number(loan.interestRate) || 0) / 100;
    const startDate = toDate((loan as Borrowing).dateTaken || (loan as Lending).dateGiven);
    const today = new Date();

    const allPayments = [...(loan.payments || []).map(p => ({...p, date: toDate(p.date)}))].sort((a,b) => a.date.getTime() - b.date.getTime());

    let currentPrincipal = principal;
    let totalAccruedInterest = 0;
    let lastDate = startDate;

    for (const payment of allPayments) {
        const days = differenceInDays(payment.date, lastDate);
        if (days > 0) {
            totalAccruedInterest += (currentPrincipal * (monthlyRate / 30) * days);
        }
        
        let payAmt = Number(payment.amount) || 0;
        const interestClear = Math.min(payAmt, totalAccruedInterest);
        totalAccruedInterest -= interestClear;
        payAmt -= interestClear;
        
        if (payAmt > 0) {
            currentPrincipal -= payAmt;
        }
        lastDate = payment.date;
    }

    const finalDays = differenceInDays(today, lastDate);
    if (finalDays > 0) {
        totalAccruedInterest += (currentPrincipal * (monthlyRate / 30) * finalDays);
    }

    return {
        principalDue: Math.max(0, currentPrincipal),
        interestDue: Math.max(0, totalAccruedInterest)
    };
}

type ProfitAndLossReportProps = {
    allRecords: StorageRecord[];
    allExpenses: Expense[];
    allUnloadingRecords: UnloadingRecord[];
    otherIncomes: OtherIncome[];
    warehouseInfo: WarehouseInfo | null;
    borrowings: Borrowing[];
    lendings: Lending[];
    customerPayments?: CustomerPayment[];
}

export function ProfitAndLossReport({ allRecords, allExpenses, allUnloadingRecords, otherIncomes, warehouseInfo, borrowings, lendings, customerPayments = [] }: ProfitAndLossReportProps) {
  const { dateRange, financialYear } = useDateFilter();
  const generatedDate = useMemo(() => format(new Date(), 'dd MMM yyyy, hh:mm a'), []);

  const { periodIncome, periodExpenses, periodBalance, filteredExpenses, filteredIncomes, interestOnCapital, totalBorrowed, totalLent, estimatedRent, activeBags, totalDiscountLoss } = useMemo(() => {
    if (!allRecords || !allExpenses || !allUnloadingRecords || !otherIncomes || !borrowings || !lendings) {
        return { periodIncome: 0, periodExpenses: 0, periodBalance: 0, filteredExpenses: [], filteredIncomes: [], interestOnCapital: 0, totalBorrowed: 0, totalLent: 0, estimatedRent: 0, activeBags: 0, totalDiscountLoss: 0 };
    }
    const inRange = (date: Date) => {
        if (financialYear === 'all-time') return true;
        if (!dateRange) return false;
        if (dateRange.from && date < dateRange.from) return false;
        if (dateRange.to) {
            const to = new Date(dateRange.to);
            to.setHours(23, 59, 59, 999);
            if (date > to) return false;
        }
        return true;
    };

    let calculatedInterest = 0;
    const capital = Number(warehouseInfo?.capitalInvestment) || 0;
    const interestRate = Number(warehouseInfo?.annualInterestRate) || 0;
    if (financialYear !== 'all-time' && dateRange?.from && capital > 0 && interestRate > 0) {
        const from = dateRange.from;
        const to = dateRange.to ? new Date(dateRange.to) : new Date();
        to.setHours(23, 59, 59, 999);
        const diffDays = Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
        calculatedInterest = (capital * (interestRate / 100) / 365) * diffDays;
    }

    const incomeFromRecords = allRecords.flatMap(r => r.payments || []).filter(p => inRange(toDate(p.date)) && p.type !== 'discount').reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
    const incomeFromUnloading = allUnloadingRecords.flatMap(r => r.payments || []).filter(p => inRange(toDate(p.date)) && p.type !== 'discount').reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
    const incomeFromBulk = customerPayments.filter(p => inRange(toDate(p.date)) && !p.isDiscount).reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
    const incomeFromOther = otherIncomes.filter(i => inRange(toDate(i.date))).reduce((acc, i) => acc + (Number(i.amount) || 0), 0);
    const totalCashIncome = incomeFromRecords + incomeFromUnloading + incomeFromBulk + incomeFromOther;

    const discountFromRecords = allRecords.flatMap(r => r.payments || []).filter(p => inRange(toDate(p.date)) && p.type === 'discount').reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
    const discountFromUnloading = allUnloadingRecords.flatMap(r => r.payments || []).filter(p => inRange(toDate(p.date)) && p.type === 'discount').reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
    const discountFromBulk = customerPayments.filter(p => inRange(toDate(p.date)) && p.isDiscount).reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
    const discountFromOutflows = allRecords.flatMap(r => r.outflows || []).filter(o => inRange(toDate(o.date))).reduce((acc, o) => acc + (Number(o.discount) || 0), 0);
    const totalLossFromDiscounts = discountFromRecords + discountFromUnloading + discountFromBulk + discountFromOutflows;

    const localFilteredExpenses = allExpenses.filter(e => inRange(toDate(e.date)));
    const totalExpenses = localFilteredExpenses.reduce((total, expense) => total + expense.amount, 0) + calculatedInterest + totalLossFromDiscounts;

    const borrowed = borrowings.filter(b => b.status !== 'Paid Off').reduce((acc, b) => {
        const { principalDue } = calculateLoanBalances(b);
        return acc + principalDue;
    }, 0);

    const lent = lendings.filter(l => l.status !== 'Paid Off').reduce((acc, l) => {
        const { principalDue } = calculateLoanBalances(l);
        return acc + principalDue;
    }, 0);

    const activeRecords = allRecords.filter(r => !r.storageEndDate && r.bagsStored > 0);
    const today = new Date();
    const rentEstimate = activeRecords.reduce((total, record) => {
        const { rent } = calculateFinalRent({ ...record, storageStartDate: toDate(record.storageStartDate) } as any, today, record.bagsStored);
        return total + rent;
    }, 0);

    return {
      periodIncome: totalCashIncome,
      periodExpenses: totalExpenses,
      totalDiscountLoss: totalLossFromDiscounts,
      periodBalance: totalCashIncome - totalExpenses,
      filteredExpenses: localFilteredExpenses.sort((a,b) => toDate(b.date).getTime() - toDate(a.date).getTime()),
      filteredIncomes: otherIncomes.filter(i => inRange(toDate(i.date))).sort((a,b) => toDate(b.date).getTime() - toDate(a.date).getTime()),
      interestOnCapital: calculatedInterest,
      totalBorrowed: borrowed,
      totalLent: lent,
      estimatedRent: rentEstimate,
      activeBags: activeRecords.reduce((acc, r) => acc + r.bagsStored, 0)
    };
  }, [allRecords, allExpenses, allUnloadingRecords, otherIncomes, customerPayments, dateRange, warehouseInfo, borrowings, lendings, financialYear]);

  return (
    <Card className="border-2 border-black shadow-none rounded-xl overflow-hidden printable-area">
        <CardContent className="p-8">
            <div className="space-y-10">
                <div className="text-center border-b-2 border-black pb-6">
                    <h1 className="text-2xl font-black uppercase tracking-tight leading-none text-primary text-center">{warehouseInfo?.name || "SRI LAKSHMI WAREHOUSE"}</h1>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.3em] mt-2 text-center">{warehouseInfo?.addressLine1} {warehouseInfo?.addressLine2}</p>
                    <h2 className="text-lg font-black underline uppercase mt-6 tracking-[0.2em] text-center">Profit & Loss Audit Statement</h2>
                    <p className="text-xs font-bold text-slate-800 uppercase mt-2 text-center">
                        Audit Cycle: {dateRange?.from ? format(dateRange.from, 'dd MMM yyyy') : 'All Time'} to {dateRange?.to ? format(dateRange.to, 'dd MMM yyyy') : 'Current'}
                    </p>
                </div>
                
                <div className="border-y-2 border-black">
                    <Table className="text-[13px] border-collapse">
                        <TableHeader>
                            <TableRow className="bg-slate-50 border-b-2 border-black h-12">
                                <TableHead className="font-black text-black uppercase text-[10px] text-center">Ledger Classification & Particulars</TableHead>
                                <TableHead className="text-center font-black text-black uppercase text-[10px] w-48 text-center">Amount (INR)</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            <TableRow className="bg-muted/30 font-black h-8"><TableCell colSpan={2} className="uppercase text-[9px] tracking-[0.2em] py-1 text-primary text-center">I. Operational Revenue (Cash Receipts)</TableCell></TableRow>
                            {filteredIncomes.map((income) => (
                                <TableRow key={`inc-${income.id}`} className="border-b border-slate-100 h-8">
                                    <TableCell className="pl-6 font-medium text-center uppercase text-[12px]">{income.description}</TableCell>
                                    <TableCell className="text-right font-mono text-green-600 font-bold text-center">{formatCurrency(income.amount)}</TableCell>
                                </TableRow>
                            ))}
                            <TableRow className="bg-green-50/50 font-black border-y border-green-200 h-10">
                                <TableCell className="text-right uppercase text-[10px] tracking-tight pr-6">Total Realized Cash Inflow</TableCell>
                                <TableCell className="text-right font-mono text-green-700 text-base text-center">{formatCurrency(periodIncome)}</TableCell>
                            </TableRow>
                            
                            <TableRow className="bg-muted/30 font-black h-8"><TableCell colSpan={2} className="uppercase text-[9px] tracking-[0.2em] py-1 text-destructive mt-6 text-center">II. Operational Debits & Realized Losses</TableCell></TableRow>
                            {filteredExpenses.map((expense) => (
                                <TableRow key={`exp-${expense.id}`} className="border-b border-slate-100 h-8">
                                    <TableCell className="pl-6 font-medium text-center text-[12px]">{expense.category}: {expense.description}</TableCell>
                                    <TableCell className="text-right font-mono text-destructive text-center">({formatCurrency(expense.amount)})</TableCell>
                                </TableRow>
                            ))}
                            {interestOnCapital > 0 && (
                                <TableRow className="border-b border-slate-100 h-8 italic">
                                    <TableCell className="pl-6 font-medium text-slate-500 text-center text-[12px]">Internal Interest on Invested Capital</TableCell>
                                    <TableCell className="text-right font-mono text-slate-400 text-center">({formatCurrency(interestOnCapital)})</TableCell>
                                </TableRow>
                            )}
                            {totalDiscountLoss > 0 && (
                                <TableRow className="bg-red-50/50 border-b border-red-200 h-8">
                                    <TableCell className="pl-6 font-black text-red-600 uppercase text-[11px] text-center">Customer Discounts & Waivers (Revenue Loss)</TableCell>
                                    <TableCell className="text-right font-mono text-red-700 font-black text-center">({formatCurrency(totalDiscountLoss)})</TableCell>
                                </TableRow>
                            )}
                            <TableRow className="bg-red-50/50 font-black border-y border-red-200 h-10">
                                <TableCell className="text-right uppercase text-[10px] tracking-tight pr-6">Total Periodic Expenditure & Provision</TableCell>
                                <TableCell className="text-right font-mono text-destructive text-base text-center">{formatCurrency(periodExpenses)}</TableCell>
                            </TableRow>
                        </TableBody>
                        <TableFooter>
                            <TableRow className="text-xl bg-slate-50 text-black border-t-2 border-black h-16">
                                <TableCell className="font-black uppercase tracking-[0.2em] text-center">{periodBalance >= 0 ? 'Net Operating Profit' : 'Net Cumulative Loss'}</TableCell>
                                <TableCell className={`text-right font-mono font-black text-2xl underline underline-offset-8 text-center`}>{formatCurrency(periodBalance)}</TableCell>
                            </TableRow>
                        </TableFooter>
                    </Table>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-16 pt-6">
                    <div className="space-y-4">
                        <h3 className="text-[10px] font-black uppercase tracking-[0.3em] border-b-2 border-black pb-1 text-center">Unrealized Asset Valuation</h3>
                        <div className="space-y-2">
                            <p className="text-slate-400 font-bold uppercase text-[9px] text-center">Accrued Godown Rent Receivable</p>
                            <p className="text-2xl font-black text-blue-700 font-mono text-center">{formatCurrency(estimatedRent)}</p>
                            <p className="text-[10px] text-slate-400 italic leading-tight text-center">Estimated value of {activeBags} bags currently in physical stock.</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h3 className="text-[10px] font-black uppercase tracking-[0.3em] border-b-2 border-black pb-1 text-center">Balance Sheet Liquidity</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <p className="text-slate-400 font-bold uppercase text-[9px] text-center">Lent Principal</p>
                                <p className="text-lg font-black text-emerald-600 font-mono text-center">{formatCurrency(totalLent)}</p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-slate-400 font-bold uppercase text-[9px] text-center">Borrowed Principal</p>
                                <p className="text-lg font-black text-destructive font-mono text-center">{formatCurrency(totalBorrowed)}</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mt-32 flex flex-col items-end text-center space-y-2">
                    <div className="w-80 border-t-2 border-black pt-4">
                        <p className="text-slate-900 font-black text-[13px] uppercase tracking-widest text-center">Authorized Auditor Signature</p>
                        <p className="text-primary font-bold text-[10px] uppercase mt-1 text-center">Financial Management Division</p>
                    </div>
                    <div className="text-[9px] text-slate-400 italic pt-12 space-y-1">
                        <p>Report ID: PNL-AUDIT-{format(new Date(), 'yyyyMMdd')}</p>
                        <p>Generated on {generatedDate} • Verified computer-generated record.</p>
                    </div>
                </div>
            </div>
        </CardContent>
    </Card>
  );
}
