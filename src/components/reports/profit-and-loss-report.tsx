
'use client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { formatCurrency, toDate } from "@/lib/utils";
import { useMemo } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import type { Expense, StorageRecord, UnloadingRecord, WarehouseInfo, Borrowing, Lending, OtherIncome } from "@/lib/definitions";
import { format, differenceInCalendarMonths } from "date-fns";
import { useDateFilter } from "@/firebase/provider";

function BorrowingsTable({ borrowings }: { borrowings: Borrowing[] }) {
  const activeBorrowings = useMemo(() => (borrowings || []).filter(b => b.status !== 'Paid Off'), [borrowings]);

  const { borrowingsWithInterest, totals } = useMemo(() => {
    const calculatedBorrowings = activeBorrowings.map(borrowing => {
        let principal = borrowing.principal;
        let accruedInterest = 0;
        let lastDate = toDate(borrowing.dateTaken);
        const monthlyRate = borrowing.interestRate / 100;

        const allPayments = [...(borrowing.payments || []).map(p => ({...p, date: toDate(p.date)}))].sort((a,b) => a.date.getTime() - b.date.getTime());

        for (const payment of allPayments) {
            const dateOfPayment = payment.date;
            
            const months = differenceInCalendarMonths(dateOfPayment, lastDate);
            if (months > 0) {
                accruedInterest += principal * monthlyRate * months;
            }
            
            let paymentAmount = payment.amount;
            const interestPayment = Math.min(paymentAmount, accruedInterest);
            accruedInterest -= interestPayment;
            paymentAmount -= interestPayment;

            if (paymentAmount > 0) {
                principal -= paymentAmount;
            }

            lastDate = dateOfPayment;
        }

        const today = new Date();
        const finalMonths = differenceInCalendarMonths(today, lastDate);
        if (finalMonths > 0) {
            accruedInterest += principal * monthlyRate * finalMonths;
        }

        const totalMonths = differenceInCalendarMonths(today, toDate(borrowing.dateTaken));
        
        return {
            ...borrowing,
            principalDue: principal,
            interestDue: Math.max(0, accruedInterest),
            totalDue: principal + Math.max(0, accruedInterest),
            monthsPassed: totalMonths,
        };
    });

     const totals = calculatedBorrowings.reduce((acc, curr) => {
        acc.principalDue += curr.principalDue;
        acc.interestDue += curr.interestDue;
        acc.totalDue += curr.totalDue;
        return acc;
    }, { principalDue: 0, interestDue: 0, totalDue: 0 });

    return { borrowingsWithInterest: calculatedBorrowings, totals };
  }, [activeBorrowings]);

  if (borrowingsWithInterest.length === 0) return null;
  
  return (
    <Card>
      <CardHeader><CardTitle>Context: Active Borrowings</CardTitle></CardHeader>
      <CardContent>
        <Table>
          <TableHeader><TableRow>
            <TableHead>Lender</TableHead>
            <TableHead>Date Taken</TableHead>
            <TableHead>Months</TableHead>
            <TableHead>Monthly Rate</TableHead>
            <TableHead className="text-right">Principal Due</TableHead>
            <TableHead className="text-right">Interest Due</TableHead>
            <TableHead className="text-right">Total Due</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {borrowingsWithInterest.map((borrowing) => (
                <TableRow key={borrowing.id}>
                  <TableCell className="font-medium">{borrowing.lenderName}</TableCell>
                  <TableCell>{format(toDate(borrowing.dateTaken), 'dd MMM yyyy')}</TableCell>
                  <TableCell className="text-center">{borrowing.monthsPassed}</TableCell>
                  <TableCell>{borrowing.interestRate}%</TableCell>
                  <TableCell className="text-right font-mono text-destructive">{formatCurrency(borrowing.principalDue)}</TableCell>
                  <TableCell className="text-right font-mono text-destructive">{formatCurrency(borrowing.interestDue)}</TableCell>
                  <TableCell className="text-right font-mono font-bold text-destructive">{formatCurrency(borrowing.totalDue)}</TableCell>
                </TableRow>
            ))}
          </TableBody>
           <TableFooter>
                <TableRow>
                    <TableCell colSpan={4} className="text-right font-bold">Totals</TableCell>
                    <TableCell className="text-right font-mono font-bold text-destructive">{formatCurrency(totals.principalDue)}</TableCell>
                    <TableCell className="text-right font-mono font-bold text-destructive">{formatCurrency(totals.interestDue)}</TableCell>
                    <TableCell className="text-right font-mono font-bold text-destructive">{formatCurrency(totals.totalDue)}</TableCell>
                </TableRow>
            </TableFooter>
        </Table>
      </CardContent>
    </Card>
  )
}

function LendingsTable({ lendings }: { lendings: Lending[] }) {
  const activeLendings = useMemo(() => (lendings || []).filter(l => l.status !== 'Paid Off'), [lendings]);
  
  if (activeLendings.length === 0) return null;
  
  const { lendingsWithInterest, totals } = useMemo(() => {
    const calculatedLendings = activeLendings.map(lending => {
        let principal = lending.principal;
        let accruedInterest = 0;
        let lastDate = toDate(lending.dateGiven);
        const monthlyRate = lending.interestRate / 100;

        const allPayments = [...(lending.payments || []).map(p => ({...p, date: toDate(p.date)}))].sort((a,b) => a.date.getTime() - b.date.getTime());

        for (const payment of allPayments) {
            const dateOfPayment = payment.date;
            
            const months = differenceInCalendarMonths(dateOfPayment, lastDate);
            if (months > 0) {
                accruedInterest += principal * monthlyRate * months;
            }
            
            let paymentAmount = payment.amount;
            const interestPayment = Math.min(paymentAmount, accruedInterest);
            accruedInterest -= interestPayment;
            paymentAmount -= interestPayment;

            if (paymentAmount > 0) {
                principal -= paymentAmount;
            }

            lastDate = dateOfPayment;
        }

        const today = new Date();
        const finalMonths = differenceInCalendarMonths(today, lastDate);
        if (finalMonths > 0) {
            accruedInterest += principal * monthlyRate * finalMonths;
        }

        const totalMonths = differenceInCalendarMonths(today, toDate(lending.dateGiven));
        
        return {
            ...lending,
            principalDue: principal,
            interestDue: Math.max(0, accruedInterest),
            totalDue: principal + Math.max(0, accruedInterest),
            monthsPassed: totalMonths,
        };
    });

     const totals = calculatedLendings.reduce((acc, curr) => {
        acc.principalDue += curr.principalDue;
        acc.interestDue += curr.interestDue;
        acc.totalDue += curr.totalDue;
        return acc;
    }, { principalDue: 0, interestDue: 0, totalDue: 0 });

    return { lendingsWithInterest: calculatedLendings, totals };
  }, [activeLendings]);

  if (lendingsWithInterest.length === 0) return null;
  
  return (
    <Card>
      <CardHeader><CardTitle>Context: Active Lendings</CardTitle></CardHeader>
      <CardContent>
        <Table>
          <TableHeader><TableRow>
            <TableHead>Borrower</TableHead>
            <TableHead>Date Given</TableHead>
            <TableHead>Months</TableHead>
            <TableHead>Monthly Rate</TableHead>
            <TableHead className="text-right">Principal Due</TableHead>
            <TableHead className="text-right">Interest Due</TableHead>
            <TableHead className="text-right">Total Due</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {lendingsWithInterest.map((lending) => (
                <TableRow key={lending.id}>
                  <TableCell className="font-medium">{lending.borrowerName}</TableCell>
                  <TableCell>{format(toDate(lending.dateGiven), 'dd MMM yyyy')}</TableCell>
                  <TableCell className="text-center">{lending.monthsPassed}</TableCell>
                  <TableCell>{lending.interestRate}%</TableCell>
                  <TableCell className="text-right font-mono text-green-600">{formatCurrency(lending.principalDue)}</TableCell>
                  <TableCell className="text-right font-mono text-green-600">{formatCurrency(lending.interestDue)}</TableCell>
                  <TableCell className="text-right font-mono font-bold text-green-600">{formatCurrency(lending.totalDue)}</TableCell>
                </TableRow>
            ))}
          </TableBody>
           <TableFooter>
                <TableRow>
                    <TableCell colSpan={4} className="text-right font-bold">Totals</TableCell>
                    <TableCell className="text-right font-mono font-bold text-green-600">{formatCurrency(totals.principalDue)}</TableCell>
                    <TableCell className="text-right font-mono font-bold text-green-600">{formatCurrency(totals.interestDue)}</TableCell>
                    <TableCell className="text-right font-mono font-bold text-green-600">{formatCurrency(totals.totalDue)}</TableCell>
                </TableRow>
            </TableFooter>
        </Table>
      </CardContent>
    </Card>
  )
}

type ProfitAndLossReportProps = {
    allRecords: StorageRecord[];
    allExpenses: Expense[];
    allUnloadingRecords: UnloadingRecord[];
    otherIncomes: OtherIncome[];
    warehouseInfo: WarehouseInfo | null;
    borrowings: Borrowing[];
    lendings: Lending[];
}

export function ProfitAndLossReport({ allRecords, allExpenses, allUnloadingRecords, otherIncomes, warehouseInfo, borrowings, lendings }: ProfitAndLossReportProps) {
  const { dateRange, financialYear } = useDateFilter();

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
        <CardHeader className="print-hide">
            <div className="flex-1">
                <CardTitle>Profit & Loss Statement</CardTitle>
                <CardDescription>A P&L statement for the selected financial period.</CardDescription>
            </div>
        </CardHeader>
        <CardContent>
            <div className="p-4 space-y-6">
                <div className="text-center">
                    <h2 className="text-xl font-bold">{warehouseInfo?.name || "GrainDost"}</h2>
                    <h3 className="text-lg font-semibold">Profit & Loss Statement</h3>
                    <p className="text-sm text-gray-500">
                        For the period: {dateRange?.from ? format(dateRange.from, 'dd MMM yyyy') : 'Start of time'} to {dateRange?.to ? format(dateRange.to, 'dd MMM yyyy') : 'Today'}
                    </p>
                </div>
                
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Particulars</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        <TableRow className="bg-gray-100 hover:bg-gray-100">
                            <TableCell colSpan={2} className="font-bold">Income</TableCell>
                        </TableRow>
                        {filteredIncomes.map((income) => (
                            <TableRow key={`inc-${income.id}`}>
                                <TableCell className="pl-6">{income.description}</TableCell>
                                <TableCell className="text-right font-mono">{formatCurrency(income.amount)}</TableCell>
                            </TableRow>
                        ))}
                        <TableRow>
                            <TableCell colSpan={2} className="h-4" />
                        </TableRow>
                        <TableRow className="border-y bg-gray-50">
                            <TableCell className="font-semibold text-right">Total Income</TableCell>
                            <TableCell className="text-right font-mono font-semibold">{formatCurrency(periodIncome)}</TableCell>
                        </TableRow>
                        <TableRow>
                            <TableCell colSpan={2} className="h-8" />
                        </TableRow>

                        <TableRow className="bg-gray-100 hover:bg-gray-100">
                            <TableCell colSpan={2} className="font-bold">Expenses</TableCell>
                        </TableRow>
                        {filteredExpenses.map((expense) => (
                            <TableRow key={`exp-${expense.id}`}>
                                <TableCell className="pl-6">{expense.description}</TableCell>
                                <TableCell className="text-right font-mono text-destructive">({formatCurrency(expense.amount)})</TableCell>
                            </TableRow>
                        ))}
                        {interestOnCapital > 0 && (
                            <TableRow key="exp-capital">
                                <TableCell className="pl-6">Interest on Capital (Notional)</TableCell>
                                <TableCell className="text-right font-mono text-destructive">({formatCurrency(interestOnCapital)})</TableCell>
                            </TableRow>
                        )}
                        <TableRow>
                            <TableCell colSpan={2} className="h-4" />
                        </TableRow>
                        <TableRow className="border-y bg-gray-50">
                            <TableCell className="font-semibold text-right">Total Expenses</TableCell>
                            <TableCell className="text-right font-mono font-semibold text-destructive">({formatCurrency(periodExpenses)})</TableCell>
                        </TableRow>
                    </TableBody>
                    <TableFooter>
                        <TableRow className="text-lg bg-gray-200 hover:bg-gray-200">
                            <TableCell className="font-bold">{periodBalance >= 0 ? 'Net Profit' : 'Net Loss'}</TableCell>
                            <TableCell className={`text-right font-bold font-mono ${periodBalance >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                                {formatCurrency(periodBalance)}
                            </TableCell>
                        </TableRow>
                    </TableFooter>
                </Table>

                <div className="space-y-4 pt-8">
                    <BorrowingsTable borrowings={borrowings || []} />
                    <LendingsTable lendings={lendings || []} />
                </div>
            </div>
        </CardContent>
    </Card>
  );
}
