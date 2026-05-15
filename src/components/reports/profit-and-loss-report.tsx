'use client';
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, toDate } from "@/lib/utils";
import { useMemo } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import type { Expense, StorageRecord, UnloadingRecord, WarehouseInfo, Borrowing, Lending, OtherIncome } from "@/lib/definitions";
import { format } from "date-fns";
import { useDateFilter } from "@/firebase/provider";

type ProfitAndLossReportProps = {
    allRecords: StorageRecord[];
    allExpenses: Expense[];
    allUnloadingRecords: UnloadingRecord[];
    otherIncomes: OtherIncome[];
    warehouseInfo: WarehouseInfo | null;
    borrowings: Borrowing[];
    lendings: Lending[];
}

export function ProfitAndLossReport({ allRecords, allExpenses, allUnloadingRecords, otherIncomes, warehouseInfo }: ProfitAndLossReportProps) {
  const { dateRange, financialYear } = useDateFilter();
  const generatedDate = useMemo(() => format(new Date(), 'dd MMM yyyy, hh:mm a'), []);

  const { periodIncome, periodExpenses, periodBalance, filteredExpenses, filteredIncomes, interestOnCapital } = useMemo(() => {
    if (!allRecords || !allExpenses || !allUnloadingRecords || !otherIncomes) {
        return { periodIncome: 0, periodExpenses: 0, periodBalance: 0, filteredExpenses: [], filteredIncomes: [], interestOnCapital: 0 };
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
    const filteredStoragePayments = allRecords.flatMap(r => r.payments || []).filter(p => inRange(toDate(p.date)));
    const filteredUnloadingPayments = allUnloadingRecords.flatMap(r => r.payments || []).filter(p => inRange(toDate(p.date)));
    const localFilteredOtherIncomes = otherIncomes.filter(i => inRange(toDate(i.date)));
    const incomeFromRecords = filteredStoragePayments.reduce((acc, p) => acc + p.amount, 0) + filteredUnloadingPayments.reduce((acc, p) => acc + p.amount, 0);
    const incomeFromOther = localFilteredOtherIncomes.reduce((acc, i) => acc + i.amount, 0);
    const income = incomeFromRecords + incomeFromOther;
    const localFilteredExpenses = allExpenses.filter(e => inRange(toDate(e.date)));
    const expensesFromDb = localFilteredExpenses.reduce((total, expense) => total + expense.amount, 0);
    const totalExpenses = expensesFromDb + calculatedInterest;
    return {
      periodIncome: income,
      periodExpenses: totalExpenses,
      periodBalance: income - totalExpenses,
      filteredExpenses: localFilteredExpenses.sort((a,b) => toDate(b.date).getTime() - toDate(a.date).getTime()),
      filteredIncomes: localFilteredOtherIncomes.sort((a,b) => toDate(b.date).getTime() - toDate(a.date).getTime()),
      interestOnCapital: calculatedInterest,
    };
  }, [allRecords, allExpenses, allUnloadingRecords, otherIncomes, dateRange, warehouseInfo, financialYear]);

  return (
    <Card>
        <CardContent className="pt-6">
            <div className="p-4 space-y-6">
                <div className="text-center">
                    <h2 className="text-xl font-bold uppercase tracking-wide">SRI LAKSHMI WAREHOUSE</h2>
                    <h3 className="text-lg font-semibold underline uppercase">Profit & Loss Statement</h3>
                    <p className="text-sm text-muted-foreground">
                        Period: {dateRange?.from ? format(dateRange.from, 'dd MMM yyyy') : 'All Time'} to {dateRange?.to ? format(dateRange.to, 'dd MMM yyyy') : 'Today'}
                    </p>
                </div>
                
                <Table className="text-sm">
                    <TableHeader>
                        <TableRow>
                            <TableHead className="font-bold text-black">Particulars</TableHead>
                            <TableHead className="text-right font-bold text-black">Amount</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        <TableRow className="bg-muted/50 font-bold"><TableCell colSpan={2} className="uppercase text-xs tracking-wider">Income Sources</TableCell></TableRow>
                        {filteredIncomes.map((income) => (
                            <TableRow key={`inc-${income.id}`}><TableCell className="pl-6">{income.description}</TableCell><TableCell className="text-right font-mono text-green-600">{formatCurrency(income.amount)}</TableCell></TableRow>
                        ))}
                        <TableRow className="bg-slate-50 font-bold"><TableCell className="text-right uppercase text-xs">Total Operational Income</TableCell><TableCell className="text-right font-mono text-green-700">{formatCurrency(periodIncome)}</TableCell></TableRow>
                        
                        <TableRow className="bg-muted/50 font-bold"><TableCell colSpan={2} className="uppercase text-xs tracking-wider mt-4">Expense Categories</TableCell></TableRow>
                        {filteredExpenses.map((expense) => (
                            <TableRow key={`exp-${expense.id}`}><TableCell className="pl-6">{expense.description}</TableCell><TableCell className="text-right font-mono text-destructive">({formatCurrency(expense.amount)})</TableCell></TableRow>
                        ))}
                        {interestOnCapital > 0 && (
                            <TableRow><TableCell className="pl-6 italic">Interest on Capital (Notional)</TableCell><TableCell className="text-right font-mono text-destructive">({formatCurrency(interestOnCapital)})</TableCell></TableRow>
                        )}
                        <TableRow className="bg-slate-50 font-bold"><TableCell className="text-right uppercase text-xs">Total Operational Expenses</TableCell><TableCell className="text-right font-mono text-destructive">{formatCurrency(periodExpenses)}</TableCell></TableRow>
                    </TableBody>
                    <TableFooter>
                        <TableRow className="text-lg bg-primary/10 border-t-2 border-primary">
                            <TableCell className="font-bold uppercase tracking-tight">{periodBalance >= 0 ? 'Net Profit' : 'Net Loss'}</TableCell>
                            <TableCell className={`text-right font-bold font-mono ${periodBalance >= 0 ? 'text-primary' : 'text-destructive'}`}>{formatCurrency(periodBalance)}</TableCell>
                        </TableRow>
                    </TableFooter>
                </Table>

                <div className="mt-16 pt-8 flex flex-col items-end text-center space-y-2">
                    <div className="w-72 border-t border-slate-400 pt-4">
                        <p className="text-[#1e293b] font-bold text-sm uppercase tracking-wider">AUTHORIZED MANAGER SIGNATURE</p>
                        <p className="text-primary font-bold text-xs uppercase mt-1">SRI LAKSHMI WAREHOUSE</p>
                    </div>
                    <p className="text-[10px] text-slate-400">Report validity verified on {generatedDate}</p>
                    <p className="text-[10px] text-slate-400 italic">This is a computer generated statement.</p>
                </div>
            </div>
        </CardContent>
    </Card>
  );
}
