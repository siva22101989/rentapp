'use client';
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, toDate } from "@/lib/utils";
import { useMemo } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import type { Expense, StorageRecord, UnloadingRecord, WarehouseInfo, Borrowing, Lending, OtherIncome, CustomerPayment } from "@/lib/definitions";
import { format } from "date-fns";
import { useDateFilter } from "@/firebase/provider";
import { calculateFinalRent } from "@/lib/billing";

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
    const capital = warehouseInfo?.capitalInvestment || 0;
    const interestRate = warehouseInfo?.annualInterestRate || 0;
    if (financialYear !== 'all-time' && dateRange?.from && capital > 0 && interestRate > 0) {
        const from = dateRange.from;
        const to = dateRange.to ? new Date(dateRange.to) : new Date();
        to.setHours(23, 59, 59, 999);
        const diffTime = to.getTime() - from.getTime();
        if (diffTime > 0) {
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
            const dailyRate = (interestRate / 100) / 365;
            calculatedInterest = capital * dailyRate * diffDays;
        }
    }

    // Cash Income Calculation (Actual Receipts)
    const incomeFromRecords = allRecords.flatMap(r => r.payments || []).filter(p => inRange(toDate(p.date)) && p.type !== 'discount').reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
    const incomeFromUnloading = allUnloadingRecords.flatMap(r => r.payments || []).filter(p => inRange(toDate(p.date)) && p.type !== 'discount').reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
    const incomeFromBulk = customerPayments.filter(p => inRange(toDate(p.date)) && !p.isDiscount).reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
    const localFilteredIncomes = otherIncomes.filter(i => inRange(toDate(i.date)));
    const incomeFromOther = localFilteredIncomes.reduce((acc, i) => acc + (Number(i.amount) || 0), 0);
    const totalCashIncome = incomeFromRecords + incomeFromUnloading + incomeFromBulk + incomeFromOther;

    // Loss from Discounts / Waivers (Strictly categorizing as Loss)
    const discountFromRecords = allRecords.flatMap(r => r.payments || []).filter(p => inRange(toDate(p.date)) && p.type === 'discount').reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
    const discountFromUnloading = allUnloadingRecords.flatMap(r => r.payments || []).filter(p => inRange(toDate(p.date)) && p.type === 'discount').reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
    const discountFromBulk = customerPayments.filter(p => inRange(toDate(p.date)) && p.isDiscount).reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
    const discountFromOutflows = allRecords.flatMap(r => r.outflows || []).filter(o => inRange(toDate(o.date))).reduce((acc, o) => acc + (Number(o.discount) || 0), 0);
    
    const totalLossFromDiscounts = discountFromRecords + discountFromUnloading + discountFromBulk + discountFromOutflows;

    // Operating Expenses + Interest + Discounts
    const localFilteredExpenses = allExpenses.filter(e => inRange(toDate(e.date)));
    const totalExpenses = localFilteredExpenses.reduce((total, expense) => total + expense.amount, 0) + calculatedInterest + totalLossFromDiscounts;

    const borrowed = borrowings.filter(b => b.status !== 'Paid Off').reduce((acc, b) => acc + b.principal, 0);
    const lent = lendings.filter(l => l.status !== 'Paid Off').reduce((acc, l) => acc + l.principal, 0);

    const activeRecords = allRecords.filter(r => !r.storageEndDate && r.bagsStored > 0);
    const today = new Date();
    const rentEstimate = activeRecords.reduce((total, record) => {
      const { rent } = calculateFinalRent({ ...record, storageStartDate: toDate(record.storageStartDate) }, today, record.bagsStored);
      return total + rent;
    }, 0);

    return {
      periodIncome: totalCashIncome,
      periodExpenses: totalExpenses,
      totalDiscountLoss: totalLossFromDiscounts,
      periodBalance: totalCashIncome - totalExpenses,
      filteredExpenses: localFilteredExpenses.sort((a,b) => toDate(b.date).getTime() - toDate(a.date).getTime()),
      filteredIncomes: localFilteredIncomes.sort((a,b) => toDate(b.date).getTime() - toDate(a.date).getTime()),
      interestOnCapital: calculatedInterest,
      totalBorrowed: borrowed,
      totalLent: lent,
      estimatedRent: rentEstimate,
      activeBags: activeRecords.reduce((acc, r) => acc + r.bagsStored, 0)
    };
  }, [allRecords, allExpenses, allUnloadingRecords, otherIncomes, customerPayments, dateRange, warehouseInfo, financialYear, borrowings, lendings]);

  return (
    <Card className="border-2 border-black shadow-none">
        <CardContent className="pt-6">
            <div className="p-4 space-y-8">
                <div className="text-center border-b-2 border-black pb-4">
                    <h1 className="text-2xl font-black uppercase tracking-tight leading-none mb-1 text-center">{warehouseInfo?.name || "SRI LAKSHMI WAREHOUSE"}</h1>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest text-center">{warehouseInfo?.addressLine1} {warehouseInfo?.addressLine2}</p>
                    <h2 className="text-lg font-black underline uppercase mt-4 tracking-[0.2em] text-center">Profit & Loss Statement</h2>
                    <p className="text-xs font-bold text-primary uppercase mt-1 text-center">
                        Audit Period: {dateRange?.from ? format(dateRange.from, 'dd MMM yyyy') : 'All Time'} to {dateRange?.to ? format(dateRange.to, 'dd MMM yyyy') : 'Today'}
                    </p>
                </div>
                
                <Table className="text-[13px] border-collapse">
                    <TableHeader>
                        <TableRow className="bg-slate-50 border-y-2 border-black">
                            <TableHead className="font-black text-black uppercase text-[10px] py-3 text-center">Financial Particulars</TableHead>
                            <TableHead className="text-center font-black text-black uppercase text-[10px] py-3 text-center">Amount (INR)</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        <TableRow className="bg-muted/30 font-black"><TableCell colSpan={2} className="uppercase text-[10px] tracking-wider py-1.5 text-primary text-center">Revenue & Cash Inflow</TableCell></TableRow>
                        {filteredIncomes.map((income) => (
                            <TableRow key={`inc-${income.id}`} className="border-b border-slate-100 h-8"><TableCell className="pl-6 font-medium text-center">{income.description}</TableCell><TableCell className="text-right font-mono text-green-600 font-bold">{formatCurrency(income.amount)}</TableCell></TableRow>
                        ))}
                        <TableRow className="bg-green-50/50 font-black border-y border-green-200"><TableCell className="text-right uppercase text-[10px] tracking-tight">Total Realized Cash Income</TableCell><TableCell className="text-right font-mono text-green-700 text-base">{formatCurrency(periodIncome)}</TableCell></TableRow>
                        
                        <TableRow className="bg-muted/30 font-black"><TableCell colSpan={2} className="uppercase text-[10px] tracking-wider py-1.5 text-destructive mt-6 text-center">Operational Debits & Losses</TableCell></TableRow>
                        {filteredExpenses.map((expense) => (
                            <TableRow key={`exp-${expense.id}`} className="border-b border-slate-100 h-8"><TableCell className="pl-6 font-medium text-center">{expense.category}: {expense.description}</TableCell><TableCell className="text-right font-mono text-destructive">({formatCurrency(expense.amount)})</TableCell></TableRow>
                        ))}
                        {interestOnCapital > 0 && (
                            <TableRow className="border-b border-slate-100 h-8"><TableCell className="pl-6 italic font-medium text-center">Interest on Capital Investment (Notional)</TableCell><TableCell className="text-right font-mono text-destructive">({formatCurrency(interestOnCapital)})</TableCell></TableRow>
                        )}
                        {totalDiscountLoss > 0 && (
                            <TableRow className="bg-red-50/50 border-b border-red-200 h-8"><TableCell className="pl-6 font-black text-red-600 uppercase text-[11px] text-center">Discounts & Waivers (Loss Account)</TableCell><TableCell className="text-right font-mono text-red-700 font-black">({formatCurrency(totalDiscountLoss)})</TableCell></TableRow>
                        )}
                        <TableRow className="bg-red-50/50 font-black border-y border-red-200"><TableCell className="text-right uppercase text-[10px] tracking-tight">Total Expenses & Provisions</TableCell><TableCell className="text-right font-mono text-destructive text-base">{formatCurrency(periodExpenses)}</TableCell></TableRow>
                    </TableBody>
                    <TableFooter>
                        <TableRow className="text-xl bg-slate-50 text-black border-t-2 border-black h-14">
                            <TableCell className="font-black uppercase tracking-tighter text-center">{periodBalance >= 0 ? 'Net Adjusted Profit' : 'Net Final Loss'}</TableCell>
                            <TableCell className={`text-right font-mono font-black text-2xl underline underline-offset-8 text-center`}>{formatCurrency(periodBalance)}</TableCell>
                        </TableRow>
                    </TableFooter>
                </Table>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-12 pt-8">
                    <div className="space-y-4">
                        <h3 className="text-[11px] font-black uppercase tracking-[0.2em] border-b-2 border-black pb-1 text-center">Unrealized Asset Valuation</h3>
                        <div className="space-y-1">
                            <p className="text-slate-500 font-bold uppercase text-[9px] text-center">Accrued Rent Receivable</p>
                            <p className="text-2xl font-black text-blue-600 font-mono text-center">{formatCurrency(estimatedRent)}</p>
                            <p className="text-[10px] text-slate-400 italic leading-tight text-center">Valuation based on {activeBags} bags currently stacked in Godown.</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h3 className="text-[11px] font-black uppercase tracking-[0.2em] border-b-2 border-black pb-1 text-center">Capital Liquidity Positions</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <p className="text-slate-500 font-bold uppercase text-[9px] text-center">Lent Principal</p>
                                <p className="text-lg font-black text-emerald-600 font-mono text-center">{formatCurrency(totalLent)}</p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-slate-500 font-bold uppercase text-[9px] text-center">Borrowed Principal</p>
                                <p className="text-lg font-black text-destructive font-mono text-center">{formatCurrency(totalBorrowed)}</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mt-24 flex flex-col items-end text-center space-y-1">
                    <div className="w-80 border-t-2 border-black pt-3">
                        <p className="text-slate-900 font-black text-[13px] uppercase tracking-widest text-center">Authorized Auditor Signature</p>
                        <p className="text-primary font-bold text-[10px] uppercase mt-1 text-center">Financial Operations Audit</p>
                    </div>
                    <div className="text-[9px] text-slate-400 italic pt-12 space-y-0.5">
                        <p>Report digital ID: PNL-AUDIT-{format(new Date(), 'yyyyMMdd')}</p>
                        <p>Generated on {generatedDate} • This is a certified computer-generated document.</p>
                    </div>
                </div>
            </div>
        </CardContent>
    </Card>
  );
}