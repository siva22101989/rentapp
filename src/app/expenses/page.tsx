'use client';
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/shared/page-header";
import { AddExpenseDialog } from "@/components/expenses/add-expense-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Scale, Calendar as CalendarIcon, X } from "lucide-react";
import { formatCurrency, toDate } from "@/lib/utils";
import { useMemo, useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Expense, StorageRecord, UnloadingRecord } from "@/lib/definitions";
import { format } from "date-fns";
import { ExpenseActionsMenu } from "@/components/expenses/expense-actions-menu";
import { useCollection } from "@/firebase/firestore/use-collection";
import { useFirestore } from "@/firebase/provider";
import { collection } from "firebase/firestore";
import { useMemoFirebase } from "@/hooks/use-memo-firebase";
import { DateRange } from "react-day-picker";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function ExpensesTable({ expenses }: { expenses: Expense[] }) {
  if (expenses.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
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


export default function ExpensesPage() {
  const firestore = useFirestore();
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [financialYear, setFinancialYear] = useState<string>('');

  const financialYears = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth(); // 0-indexed: Jan is 0, Nov is 10
    // If current month is Nov or Dec, the FY starts this year. Otherwise, it started last year.
    const startYear = currentMonth >= 10 ? currentYear : currentYear - 1;
    const years = [];
    for (let i = 0; i < 10; i++) {
        const year = startYear - i;
        years.push(`${year}-${(year + 1).toString().slice(2)}`);
    }
    return years;
  }, []);

  const handleFinancialYearChange = (fy: string) => {
    setFinancialYear(fy);
    if (!fy) {
        setDateRange(undefined);
        return;
    }

    const startYear = parseInt(fy.substring(0, 4), 10);
    const fromDate = new Date(startYear, 10, 1); // November 1st
    const toDate = new Date(startYear + 1, 9, 31); // October 31st
    
    setDateRange({ from: fromDate, to: toDate });
  };

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


  const { periodIncome, periodExpenses, periodBalance, filteredExpenses } = useMemo(() => {
    if (!allRecords || !allExpenses || !allUnloadingRecords) {
        return { periodIncome: 0, periodExpenses: 0, periodBalance: 0, filteredExpenses: [] };
    }

    const inRange = (date: Date) => {
        if (dateRange?.from && date < dateRange.from) return false;
        if (dateRange?.to) {
            const to = new Date(dateRange.to);
            to.setHours(23, 59, 59, 999); // Include the whole "to" day
            if (date > to) return false;
        }
        return true;
    };
    
    const filteredStoragePayments = allRecords.flatMap(r => r.payments || []).filter(p => inRange(toDate(p.date)));
    const filteredUnloadingPayments = allUnloadingRecords.flatMap(r => r.payments || []).filter(p => inRange(toDate(p.date)));

    const income = filteredStoragePayments.reduce((acc, p) => acc + p.amount, 0) +
                   filteredUnloadingPayments.reduce((acc, p) => acc + p.amount, 0);
    
    const localFilteredExpenses = allExpenses.filter(e => inRange(toDate(e.date)));
    const expenses = localFilteredExpenses.reduce((total, expense) => total + expense.amount, 0);

    return {
      periodIncome: income,
      periodExpenses: expenses,
      periodBalance: income - expenses,
      filteredExpenses: localFilteredExpenses.sort((a,b) => toDate(b.date).getTime() - toDate(a.date).getTime()),
    };
  }, [allRecords, allExpenses, allUnloadingRecords, dateRange]);


  if (loadingRecords || loadingExpenses || loadingUnloading) {
    return (
      <AppLayout>
        <PageHeader title="Expenses & Income" description="Track your warehouse operational finances." />
        <div>Loading...</div>
      </AppLayout>
    );
  }
  
  return (
    <AppLayout>
      <PageHeader
        title="Expenses & Income"
        description="Track your warehouse operational finances for the selected period."
      >
        <div className="flex items-center gap-2">
            <Select value={financialYear} onValueChange={handleFinancialYearChange}>
                <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Select FY" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="">All Time</SelectItem>
                    {financialYears.map(fy => (
                        <SelectItem key={fy} value={fy}>
                            FY {fy}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
            <Popover>
            <PopoverTrigger asChild>
                <Button
                id="date"
                variant={"outline"}
                className="w-[260px] justify-start text-left font-normal"
                >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateRange?.from ? (
                    dateRange.to ? (
                    <>
                        {format(dateRange.from, "LLL dd, y")} -{" "}
                        {format(dateRange.to, "LLL dd, y")}
                    </>
                    ) : (
                    format(dateRange.from, "LLL dd, y")
                    )
                ) : (
                    <span>Pick a date range</span>
                )}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                initialFocus
                mode="range"
                defaultMonth={dateRange?.from}
                selected={dateRange}
                onSelect={(range) => { setDateRange(range); setFinancialYear(''); }}
                numberOfMonths={2}
                />
            </PopoverContent>
            </Popover>
            {dateRange && <Button variant="ghost" size="icon" onClick={() => { setDateRange(undefined); setFinancialYear(''); }}><X className="h-4 w-4" /></Button>}
            <AddExpenseDialog />
        </div>
      </PageHeader>

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Income</CardTitle>
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
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
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
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Net Balance</CardTitle>
                 <Scale className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className={`text-2xl font-bold ${periodBalance >= 0 ? 'text-primary' : 'text-destructive'}`}>{formatCurrency(periodBalance)}</div>
                 <p className="text-xs text-muted-foreground">
                    Net balance for the selected period.
                </p>
            </CardContent>
        </Card>
      </div>
      <div className="mt-8">
        <ExpensesTable expenses={filteredExpenses} />
      </div>
    </AppLayout>
  );
}
