'use client';
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/shared/page-header";
import { AddExpenseDialog } from "@/components/expenses/add-expense-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Scale, Banknote } from "lucide-react";
import { formatCurrency, toDate } from "@/lib/utils";
import { useMemo } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Expense, StorageRecord, UnloadingRecord, WarehouseInfo, Borrowing } from "@/lib/definitions";
import { format } from "date-fns";
import { ExpenseActionsMenu } from "@/components/expenses/expense-actions-menu";
import { useCollection } from "@/firebase/firestore/use-collection";
import { useFirestore, useDateFilter } from "@/firebase/provider";
import { collection, doc } from "firebase/firestore";
import { useMemoFirebase } from "@/hooks/use-memo-firebase";
import { useDoc } from "@/firebase/firestore/use-doc";
import { ManageInvestmentDialog } from "@/components/expenses/manage-investment-dialog";
import { AddBorrowingDialog } from "@/components/borrowings/add-borrowing-dialog";

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
        <CardTitle>Transaction History</CardTitle>
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
  if (borrowings.length === 0) {
    return null;
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>Active Borrowings</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Lender</TableHead>
              <TableHead>Date Taken</TableHead>
              <TableHead>Interest</TableHead>
              <TableHead className="text-right">Principal</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {borrowings.map((borrowing) => (
              <TableRow key={borrowing.id}>
                <TableCell className="font-medium">{borrowing.lenderName}</TableCell>
                <TableCell>{format(toDate(borrowing.dateTaken), 'dd MMM yyyy')}</TableCell>
                <TableCell>{borrowing.interestRate}% {borrowing.interestType}</TableCell>
                <TableCell className="text-right font-mono">{formatCurrency(borrowing.principal)}</TableCell>
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
  const { dateRange } = useDateFilter();
  
  const warehouseInfoRef = useMemoFirebase(
    () => (firestore ? doc(firestore, 'settings', 'main') : null),
    [firestore]
  );
  const { data: warehouseInfo, loading: loadingWarehouseInfo } = useDoc<WarehouseInfo>(warehouseInfoRef);

  const recordsQuery = useMemoFirebase(
    () => (firestore ? collection(firestore, 'storageRecords') : null),
    [firestore]
  );
  const { data: allRecords, loading: loadingRecords } = useCollection<StorageRecord>(recordsQuery);

  const expensesQuery = useMemoFirebase(
    () => (firestore ? collection(firestore, 'expenses') : null),
    [firestore]
  );
  const { data: allExpenses, loading: loadingExpenses } = useCollection<Expense>(expensesQuery);
  
  const unloadingRecordsQuery = useMemoFirebase(
    () => (firestore ? collection(firestore, 'unloadingRecords') : null),
    [firestore]
  );
  const { data: allUnloadingRecords, loading: loadingUnloading } = useCollection<UnloadingRecord>(unloadingRecordsQuery);

  const borrowingsQuery = useMemoFirebase(
    () => (firestore ? collection(firestore, 'borrowings') : null),
    [firestore]
  );
  const { data: borrowings, loading: loadingBorrowings } = useCollection<Borrowing>(borrowingsQuery);


  const { periodIncome, periodExpenses, periodBalance, filteredExpenses, interestOnCapital } = useMemo(() => {
    if (!allRecords || !allExpenses || !allUnloadingRecords) {
        return { periodIncome: 0, periodExpenses: 0, periodBalance: 0, filteredExpenses: [], interestOnCapital: 0 };
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

    if (dateRange?.from && capital > 0 && interestRate > 0) {
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

    const income = filteredStoragePayments.reduce((acc, p) => acc + p.amount, 0) +
                   filteredUnloadingPayments.reduce((acc, p) => acc + p.amount, 0);
    
    const localFilteredExpenses = allExpenses.filter(e => inRange(toDate(e.date)));
    const expensesFromDb = localFilteredExpenses.reduce((total, expense) => total + expense.amount, 0);
    const totalExpenses = expensesFromDb + calculatedInterest;

    return {
      periodIncome: income,
      periodExpenses: totalExpenses,
      periodBalance: income - totalExpenses,
      filteredExpenses: localFilteredExpenses.sort((a,b) => toDate(b.date).getTime() - toDate(a.date).getTime()),
      interestOnCapital: calculatedInterest,
    };
  }, [allRecords, allExpenses, allUnloadingRecords, dateRange, warehouseInfo]);


  if (loadingRecords || loadingExpenses || loadingUnloading || loadingWarehouseInfo || loadingBorrowings) {
    return (
      <AppLayout>
        <PageHeader title="Profit & Loss" description="Track your operational finances and view profit/loss for the selected period." />
        <div>Loading...</div>
      </AppLayout>
    );
  }
  
  return (
    <AppLayout>
      <PageHeader
        title="Profit & Loss"
        description="Track your operational finances and view profit/loss for the selected period."
      >
        <div className="flex items-center gap-2">
            <AddExpenseDialog />
            <ManageInvestmentDialog initialData={warehouseInfo} />
            <AddBorrowingDialog />
        </div>
      </PageHeader>

      <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-4">
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
                <CardTitle>Net Profit / Loss</CardTitle>
                 <Scale className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className={`text-2xl font-bold ${periodBalance >= 0 ? 'text-primary' : ''}`}>{formatCurrency(periodBalance)}</div>
                 <p className="text-xs text-muted-foreground">
                    Your net profit or loss for the selected period.
                </p>
            </CardContent>
        </Card>
      </div>
      <div className="mt-4 space-y-4">
        <BorrowingsTable borrowings={borrowings || []} />
        <ExpensesTable expenses={filteredExpenses} />
      </div>
    </AppLayout>
  );
}
