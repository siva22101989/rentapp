
'use client';
import { AppLayout } from "@/components/layout/app-layout";
import { AddExpenseDialog } from "@/components/expenses/add-expense-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Scale, Banknote, IndianRupee } from "lucide-react";
import { formatCurrency, toDate } from "@/lib/utils";
import { useMemo, useState, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Expense, StorageRecord, UnloadingRecord, WarehouseInfo, Borrowing, Lending, OtherIncome } from "@/lib/definitions";
import { format, differenceInCalendarMonths, differenceInCalendarYears } from "date-fns";
import { ExpenseActionsMenu } from "@/components/expenses/expense-actions-menu";
import { useCollection } from "@/firebase/firestore/use-collection";
import { useFirestore, useDateFilter } from "@/firebase/provider";
import { collection, doc } from "firebase/firestore";
import { useMemoFirebase } from "@/hooks/use-memo-firebase";
import { useDoc } from "@/firebase/firestore/use-doc";
import { ManageInvestmentDialog } from "@/components/expenses/manage-investment-dialog";
import { AddBorrowingDialog } from "@/components/borrowings/add-borrowing-dialog";
import { AddLendingDialog } from "@/components/lendings/add-lending-dialog";
import { AddIncomeDialog } from "@/components/income/add-income-dialog";
import { Separator } from "@/components/ui/separator";
import { calculateFinalRent } from "@/lib/billing";
import { BorrowingActionsMenu } from "@/components/borrowings/borrowing-actions-menu";
import { LendingActionsMenu } from "@/components/lendings/lending-actions-menu";

function IncomesTable({ incomes }: { incomes: OtherIncome[] }) {
    if (incomes.length === 0) {
      return null;
    }
    return (
      <Card>
        <CardHeader>
          <CardTitle>Income History</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="hidden sm:table-cell">Date</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {incomes.map((income) => (
                <TableRow key={income.id}>
                  <TableCell className="hidden sm:table-cell">{format(toDate(income.date), 'dd MMM yyyy')}</TableCell>
                  <TableCell>{income.category}</TableCell>
                  <TableCell className="font-medium">{income.description}</TableCell>
                  <TableCell className="text-right font-mono text-green-600">{formatCurrency(income.amount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    );
}

function ExpensesTable({ expenses }: { expenses: Expense[] }) {
  if (expenses.length === 0) {
    return (
      <Card>
        <CardContent className="p-2 text-center text-muted-foreground">
          No expenses recorded for the selected period.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Expense History</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="hidden sm:table-cell">Date</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {expenses.map((expense) => (
              <TableRow key={expense.id}>
                <TableCell className="hidden sm:table-cell">{format(toDate(expense.date), 'dd MMM yyyy')}</TableCell>
                <TableCell>{expense.category}</TableCell>
                <TableCell className="font-medium">{expense.description}</TableCell>
                <TableCell className="text-right font-mono">{formatCurrency(expense.amount)}</TableCell>
                <TableCell>
                  <ExpenseActionsMenu expense={expense} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function BorrowingsTable({ borrowings }: { borrowings: Borrowing[] }) {
  const activeBorrowings = useMemo(() => (borrowings || []).filter(b => b.status !== 'Paid Off'), [borrowings]);

  if (activeBorrowings.length === 0) {
    return null;
  }
  
  const borrowingsWithInterest = useMemo(() => {
    return activeBorrowings.map(borrowing => {
        let principal = borrowing.principal;
        let accruedInterest = 0;
        let lastDate = toDate(borrowing.dateTaken);

        const allPayments = [...(borrowing.payments || []).map(p => ({...p, date: toDate(p.date)}))].sort((a,b) => a.date.getTime() - b.date.getTime());

        for (const payment of allPayments) {
            const dateOfPayment = payment.date;
            
            if (borrowing.interestType === 'Yearly') {
                const years = differenceInCalendarYears(dateOfPayment, lastDate);
                if (years > 0) {
                    accruedInterest += principal * (borrowing.interestRate / 100) * years;
                }
            } else { // Monthly
                const months = differenceInCalendarMonths(dateOfPayment, lastDate);
                if (months > 0) {
                    accruedInterest += principal * (borrowing.interestRate / 100) * months;
                }
            }
            
            // Unified payment application logic
            let paymentAmount = payment.amount;

            // First, apply payment to any outstanding interest
            const interestPayment = Math.min(paymentAmount, accruedInterest);
            accruedInterest -= interestPayment;
            paymentAmount -= interestPayment;

            // Then, apply any remaining payment to the principal
            if (paymentAmount > 0) {
                principal -= paymentAmount;
            }

            lastDate = dateOfPayment;
        }

        // Calculate final interest from last payment to today
        const today = new Date();
        if (borrowing.interestType === 'Yearly') {
            const finalYears = differenceInCalendarYears(today, lastDate);
            if (finalYears > 0) {
                accruedInterest += principal * (borrowing.interestRate / 100) * finalYears;
            }
        } else { // Monthly
            const finalMonths = differenceInCalendarMonths(today, lastDate);
            if (finalMonths > 0) {
                accruedInterest += principal * (borrowing.interestRate / 100) * finalMonths;
            }
        }
        
        return {
            ...borrowing,
            principalDue: principal,
            interestDue: Math.max(0, accruedInterest),
            totalDue: principal + Math.max(0, accruedInterest),
        };
    });
  }, [activeBorrowings]);
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Active Borrowings (Money Taken)</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Lender</TableHead>
              <TableHead className="hidden sm:table-cell">Principal Due</TableHead>
              <TableHead className="hidden md:table-cell">Interest Due</TableHead>
              <TableHead className="text-right">Total Due</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {borrowingsWithInterest.map((borrowing) => (
                <TableRow key={borrowing.id}>
                  <TableCell className="font-medium">{borrowing.lenderName}</TableCell>
                  <TableCell className="font-mono hidden sm:table-cell text-destructive">{formatCurrency(borrowing.principalDue)}</TableCell>
                  <TableCell className="font-mono hidden md:table-cell text-destructive">{formatCurrency(borrowing.interestDue)}</TableCell>
                  <TableCell className="text-right font-mono text-destructive font-bold">{formatCurrency(borrowing.totalDue)}</TableCell>
                  <TableCell>
                    <BorrowingActionsMenu borrowing={borrowing} />
                  </TableCell>
                </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

function LendingsTable({ lendings }: { lendings: Lending[] }) {
  const activeLendings = useMemo(() => (lendings || []).filter(l => l.status !== 'Paid Off'), [lendings]);
  
  if (activeLendings.length === 0) {
    return null;
  }
  
  const lendingsWithInterest = useMemo(() => {
    return activeLendings.map(lending => {
        let principal = lending.principal;
        let accruedInterest = 0;
        let lastDate = toDate(lending.dateGiven);

        const allPayments = [...(lending.payments || []).map(p => ({...p, date: toDate(p.date)}))].sort((a,b) => a.date.getTime() - b.date.getTime());

        for (const payment of allPayments) {
            const dateOfPayment = payment.date;
            
            if (lending.interestType === 'Yearly') {
                const years = differenceInCalendarYears(dateOfPayment, lastDate);
                if (years > 0) {
                    accruedInterest += principal * (lending.interestRate / 100) * years;
                }
            } else { // Monthly
                const months = differenceInCalendarMonths(dateOfPayment, lastDate);
                if (months > 0) {
                    accruedInterest += principal * (lending.interestRate / 100) * months;
                }
            }
            
            // Unified payment application logic
            let paymentAmount = payment.amount;

            // First, apply payment to any outstanding interest
            const interestPayment = Math.min(paymentAmount, accruedInterest);
            accruedInterest -= interestPayment;
            paymentAmount -= interestPayment;

            // Then, apply any remaining payment to the principal
            if (paymentAmount > 0) {
                principal -= paymentAmount;
            }

            lastDate = dateOfPayment;
        }

        // Calculate final interest from last payment to today
        const today = new Date();
        if (lending.interestType === 'Yearly') {
            const finalYears = differenceInCalendarYears(today, lastDate);
            if (finalYears > 0) {
                accruedInterest += principal * (lending.interestRate / 100) * finalYears;
            }
        } else { // Monthly
            const finalMonths = differenceInCalendarMonths(today, lastDate);
            if (finalMonths > 0) {
                accruedInterest += principal * (lending.interestRate / 100) * finalMonths;
            }
        }
        
        return {
            ...lending,
            principalDue: principal,
            interestDue: Math.max(0, accruedInterest),
            totalDue: principal + Math.max(0, accruedInterest),
        };
    });
  }, [activeLendings]);
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Active Lendings (Money Given)</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Borrower</TableHead>
              <TableHead className="hidden sm:table-cell">Principal Due</TableHead>
              <TableHead className="hidden md:table-cell">Interest Due</TableHead>
              <TableHead className="text-right">Total Due</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lendingsWithInterest.map((lending) => (
                <TableRow key={lending.id}>
                  <TableCell className="font-medium">{lending.borrowerName}</TableCell>
                  <TableCell className="font-mono hidden sm:table-cell text-green-600">{formatCurrency(lending.principalDue)}</TableCell>
                  <TableCell className="font-mono hidden md:table-cell text-green-600">{formatCurrency(lending.interestDue)}</TableCell>
                  <TableCell className="text-right font-mono text-green-600 font-bold">{formatCurrency(lending.totalDue)}</TableCell>
                  <TableCell>
                    <LendingActionsMenu lending={lending} />
                  </TableCell>
                </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}


export default function ExpensesPage() {
  const firestore = useFirestore();
  const { dateRange, financialYear } = useDateFilter();
  
  const warehouseInfoRef = useMemoFirebase(
    () => (firestore ? doc(firestore, 'settings', 'main') : null),
    [firestore]
  );
  const { data: warehouseInfo, loading: loadingWarehouseInfo } = useDoc<WarehouseInfo>(warehouseInfoRef);

  const recordsQuery = useMemoFirebase(() => (firestore ? collection(firestore, 'storageRecords') : null), [firestore]);
  const { data: allRecords, loading: loadingRecords } = useCollection<StorageRecord>(recordsQuery);

  const expensesQuery = useMemoFirebase(() => (firestore ? collection(firestore, 'expenses') : null), [firestore]);
  const { data: allExpenses, loading: loadingExpenses } = useCollection<Expense>(expensesQuery);
  
  const unloadingRecordsQuery = useMemoFirebase(() => (firestore ? collection(firestore, 'unloadingRecords') : null), [firestore]);
  const { data: allUnloadingRecords, loading: loadingUnloading } = useCollection<UnloadingRecord>(unloadingRecordsQuery);

  const borrowingsQuery = useMemoFirebase(() => (firestore ? collection(firestore, 'borrowings') : null), [firestore]);
  const { data: borrowings, loading: loadingBorrowings } = useCollection<Borrowing>(borrowingsQuery);
  
  const lendingsQuery = useMemoFirebase(() => (firestore ? collection(firestore, 'lendings') : null), [firestore]);
  const { data: lendings, loading: loadingLendings } = useCollection<Lending>(lendingsQuery);
  
  const otherIncomesQuery = useMemoFirebase(() => (firestore ? collection(firestore, 'otherIncomes') : null), [firestore]);
  const { data: otherIncomes, loading: loadingOtherIncomes } = useCollection<OtherIncome>(otherIncomesQuery);


  const { periodIncome, periodExpenses, periodBalance, filteredExpenses, filteredIncomes, interestOnCapital, estimatedRent, activeBags } = useMemo(() => {
    if (!allRecords || !allExpenses || !allUnloadingRecords || !otherIncomes) {
        return { periodIncome: 0, periodExpenses: 0, periodBalance: 0, filteredExpenses: [], filteredIncomes: [], interestOnCapital: 0, estimatedRent: 0, activeBags: 0 };
    }

    const inRange = (date: Date) => {
        if (!dateRange) return true; // If no range, include all
        if (dateRange.from && date < dateRange.from) return false;
        if (dateRange.to) {
            const to = new Date(dateRange.to);
            to.setHours(23, 59, 59, 999); // Include the whole "to" day
            if (date > to) return false;
        }
        return true;
    };

    // Calculate interest on capital for the period
    let calculatedInterest = 0;
    const capital = warehouseInfo?.capitalInvestment || 0;
    const interestRate = warehouseInfo?.annualInterestRate || 0;

    if (financialYear !== 'all-time' && dateRange?.from && capital > 0 && interestRate > 0) {
        const from = dateRange.from;
        const to = dateRange.to ? new Date(dateRange.to) : new Date(); // Use today if 'to' is not set
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

    const incomeFromRecords = filteredStoragePayments.reduce((acc, p) => acc + p.amount, 0) +
                   filteredUnloadingPayments.reduce((acc, p) => acc + p.amount, 0);
    const incomeFromOther = localFilteredOtherIncomes.reduce((acc, i) => acc + i.amount, 0);
    const income = incomeFromRecords + incomeFromOther;

    const localFilteredExpenses = allExpenses.filter(e => inRange(toDate(e.date)));
    const expensesFromDb = localFilteredExpenses.reduce((total, expense) => total + expense.amount, 0);
    const totalExpenses = expensesFromDb + calculatedInterest;

    const activeRecords = allRecords.filter(r => !r.storageEndDate && r.bagsStored > 0);
    const rentEstimate = activeRecords.reduce((total, record) => {
      const { rent } = calculateFinalRent(record, new Date(), record.bagsStored);
      return total + rent;
    }, 0);
    
    const totalActiveBags = activeRecords.reduce((acc, record) => acc + record.bagsStored, 0);


    return {
      periodIncome: income,
      periodExpenses: totalExpenses,
      periodBalance: income - totalExpenses,
      filteredExpenses: localFilteredExpenses.sort((a,b) => toDate(b.date).getTime() - toDate(a.date).getTime()),
      filteredIncomes: localFilteredOtherIncomes.sort((a,b) => toDate(b.date).getTime() - toDate(a.date).getTime()),
      interestOnCapital: calculatedInterest,
      estimatedRent: rentEstimate,
      activeBags: totalActiveBags
    };
  }, [allRecords, allExpenses, allUnloadingRecords, otherIncomes, dateRange, warehouseInfo, financialYear]);


  if (loadingRecords || loadingExpenses || loadingUnloading || loadingWarehouseInfo || loadingBorrowings || loadingLendings || loadingOtherIncomes) {
    return (
      <AppLayout>
        <div>Loading...</div>
      </AppLayout>
    );
  }
  
  return (
    <AppLayout>
      <div>
        <div className="space-y-0.5">
          <h1 className="text-xl font-bold tracking-tight font-headline">Profit & Loss</h1>
          <p className="text-sm text-muted-foreground">
            Track your operational finances and view profit/loss for the selected period.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap mt-3">
            <AddIncomeDialog lendings={lendings || []} />
            <AddExpenseDialog borrowings={borrowings || []} />
            <Separator orientation="vertical" className="h-6" />
            <AddLendingDialog />
            <AddBorrowingDialog />
            <Separator orientation="vertical" className="h-6" />
            <ManageInvestmentDialog initialData={warehouseInfo} />
        </div>
      </div>

      <div className="grid gap-2 md:grid-cols-3 lg:grid-cols-5">
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
                <CardTitle>Total Income</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground text-green-500" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold text-green-600">{formatCurrency(periodIncome)}</div>
                <p className="text-xs text-muted-foreground">
                    Income received during the selected period.
                </p>
            </CardContent>
        </Card>
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
                <CardTitle>Total Expenses</CardTitle>
                 <TrendingDown className="h-4 w-4 text-muted-foreground text-red-500" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold text-destructive">{formatCurrency(periodExpenses)}</div>
                 <p className="text-xs text-muted-foreground">
                    Expenses recorded during the selected period.
                </p>
            </CardContent>
        </Card>
         <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
                <CardTitle>Interest on Capital</CardTitle>
                <Banknote className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold text-orange-600">{formatCurrency(interestOnCapital)}</div>
                <p className="text-xs text-muted-foreground">
                    on {formatCurrency(warehouseInfo?.capitalInvestment || 0)} @ {warehouseInfo?.annualInterestRate || 0}% p.a.
                </p>
            </CardContent>
        </Card>
         <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
                <CardTitle>Estimated Rent Due</CardTitle>
                <IndianRupee className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold text-blue-600">{formatCurrency(estimatedRent)}</div>
                <p className="text-xs text-muted-foreground">
                    For {activeBags} active bags as of today.
                </p>
            </CardContent>
        </Card>
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
                <CardTitle>Net Profit / Loss</CardTitle>
                 <Scale className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className={`text-2xl font-bold ${periodBalance >= 0 ? 'text-primary' : 'text-destructive'}`}>{formatCurrency(periodBalance)}</div>
                 <p className="text-xs text-muted-foreground">
                    Your net profit or loss for the selected period.
                </p>
            </CardContent>
        </Card>
      </div>
      <div className="space-y-4">
        <BorrowingsTable borrowings={borrowings || []} />
        <LendingsTable lendings={lendings || []} />
        <Separator />
        <IncomesTable incomes={filteredIncomes} />
        <ExpensesTable expenses={filteredExpenses} />
      </div>
    </AppLayout>
  );
}
