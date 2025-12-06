'use client';
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/shared/page-header";
import { AddExpenseDialog } from "@/components/expenses/add-expense-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Scale } from "lucide-react";
import { formatCurrency, toDate } from "@/lib/utils";
import { useMemo } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Expense, StorageRecord } from "@/lib/definitions";
import { format } from "date-fns";
import { ExpenseActionsMenu } from "@/components/expenses/expense-actions-menu";
import { useCollection } from "@/firebase/firestore/use-collection";
import { collection } from "firebase/firestore";
import { useFirestore } from "@/firebase";

function ExpensesTable({ expenses }: { expenses: Expense[] }) {
  if (expenses.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          No expenses have been recorded yet.
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
              <TableHead>Date</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {expenses.map((expense) => (
              <TableRow key={expense.id}>
                <TableCell>{format(toDate(expense.date), 'dd MMM yyyy')}</TableCell>
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
  const { data: allRecords, loading: recordsLoading } = useCollection<StorageRecord>(
    firestore ? collection(firestore, 'storageRecords') : null
  );
  const { data: allExpenses, loading: expensesLoading } = useCollection<Expense>(
    firestore ? collection(firestore, 'expenses') : null
  );

  const { totalIncome, totalExpenses, totalBalance } = useMemo(() => {
    if (!allRecords || !allExpenses) return { totalIncome: 0, totalExpenses: 0, totalBalance: 0 };
    
    const income = allRecords.reduce((total, record) => {
      const rentPayments = (record.payments || [])
        .filter(p => p.type === 'rent' || p.type === 'other') // considering other as potential income
        .reduce((acc, p) => acc + p.amount, 0);
      return total + rentPayments;
    }, 0);

    const expenses = allExpenses.reduce((total, expense) => total + expense.amount, 0);

    return {
      totalIncome: income,
      totalExpenses: expenses,
      totalBalance: income - expenses,
    };
  }, [allRecords, allExpenses]);


  if (recordsLoading || expensesLoading) {
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
        description="Track your warehouse operational finances."
      >
        <AddExpenseDialog />
      </PageHeader>

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Income</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground text-green-500" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold text-green-600">{formatCurrency(totalIncome)}</div>
                <p className="text-xs text-muted-foreground">
                    Total amount received from all payments.
                </p>
            </CardContent>
        </Card>
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
                 <TrendingDown className="h-4 w-4 text-muted-foreground text-red-500" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold text-destructive">{formatCurrency(totalExpenses)}</div>
                 <p className="text-xs text-muted-foreground">
                    Sum of all recorded operational expenses.
                </p>
            </CardContent>
        </Card>
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Balance</CardTitle>
                 <Scale className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className={`text-2xl font-bold ${totalBalance >= 0 ? 'text-primary' : 'text-destructive'}`}>{formatCurrency(totalBalance)}</div>
                 <p className="text-xs text-muted-foreground">
                    Net balance after all income and expenses.
                </p>
            </CardContent>
        </Card>
      </div>
      <div className="mt-8">
        <ExpensesTable expenses={allExpenses || []} />
      </div>
    </AppLayout>
  );
}
