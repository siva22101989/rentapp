
'use client';
import { AppLayout } from "@/components/layout/app-layout";
import { AddExpenseDialog } from "@/components/expenses/add-expense-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Scale, Banknote, IndianRupee, Landmark, HandCoins } from "lucide-react";
import { formatCurrency, toDate } from "@/lib/utils";
import { useMemo } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Expense, StorageRecord, WarehouseInfo, Borrowing, Lending, OtherIncome, Commodity, UnloadingRecord } from "@/lib/definitions";
import { format, differenceInCalendarMonths } from "date-fns";
import { ExpenseActionsMenu } from "@/components/expenses/expense-actions-menu";
import { useCollection, useFirestore, useDateFilter, useDoc, useAppUser } from "@/firebase";
import { collection, doc, query, where } from "firebase/firestore";
import { useMemoFirebase } from "@/hooks/use-memo-firebase";
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
                <TableHead className="hidden sm:table-cell uppercase text-[10px] font-bold">Date</TableHead>
                <TableHead className="uppercase text-[10px] font-bold">Ref No</TableHead>
                <TableHead className="uppercase text-[10px] font-bold">Category</TableHead>
                <TableHead className="uppercase text-[10px] font-bold">Description</TableHead>
                <TableHead className="text-right uppercase text-[10px] font-bold">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {incomes.map((income) => (
                <TableRow key={income.id} className="h-8 text-[13px]">
                  <TableCell className="hidden sm:table-cell">{format(toDate(income.date), 'dd/MM/yy')}</TableCell>
                  <TableCell className="font-mono">{income.refNo || '-'}</TableCell>
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
  const appUser = useAppUser();
  const canEdit = appUser?.role === 'owner';

  if (expenses.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Expense History</CardTitle>
        </CardHeader>
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
              <TableHead className="hidden sm:table-cell uppercase text-[10px] font-bold">Date</TableHead>
              <TableHead className="uppercase text-[10px] font-bold">Ref No</TableHead>
              <TableHead className="uppercase text-[10px] font-bold">Category</TableHead>
              <TableHead className="uppercase text-[10px] font-bold">Description</TableHead>
              <TableHead className="text-right uppercase text-[10px] font-bold">Amount</TableHead>
              {canEdit && <TableHead className="w-[50px]"></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {expenses.map((expense) => (
              <TableRow key={expense.id} className="h-8 text-[13px]">
                <TableCell className="hidden sm:table-cell">{format(toDate(expense.date), 'dd/MM/yy')}</TableCell>
                <TableCell className="font-mono">{expense.refNo || '-'}</TableCell>
                <TableCell>{expense.category}</TableCell>
                <TableCell className="font-medium">{expense.description}</TableCell>
                <TableCell className="text-right font-mono">{formatCurrency(expense.amount)}</TableCell>
                {canEdit && (
                  <TableCell>
                    <ExpenseActionsMenu expense={expense} />
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function BorrowingsTable({ borrowings }: { borrowings: Borrowing[] }) {
    const appUser = useAppUser();
    const canEdit = appUser?.role === 'owner';
    const activeBorrowings = borrowings.filter(b => b.status !== 'Paid Off');
  
    if (activeBorrowings.length === 0) return null;
  
    return (
      <Card>
        <CardHeader><CardTitle>Active Borrowings (Loans Taken)</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="uppercase text-[10px] font-bold">Lender</TableHead>
                <TableHead className="uppercase text-[10px] font-bold">Date Taken</TableHead>
                <TableHead className="text-right uppercase text-[10px] font-bold">Interest %</TableHead>
                <TableHead className="text-right uppercase text-[10px] font-bold">Principal</TableHead>
                {canEdit && <TableHead className="w-[50px]"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {activeBorrowings.map((b) => (
                <TableRow key={b.id} className="h-8 text-[13px]">
                  <TableCell className="font-medium">{b.lenderName}</TableCell>
                  <TableCell>{format(toDate(b.dateTaken), 'dd/MM/yy')}</TableCell>
                  <TableCell className="text-right">{b.interestRate}%</TableCell>
                  <TableCell className="text-right font-mono text-destructive">{formatCurrency(b.principal)}</TableCell>
                  {canEdit && <TableCell><BorrowingActionsMenu borrowing={b} /></TableCell>}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    );
}

function LendingsTable({ lendings }: { lendings: Lending[] }) {
    const appUser = useAppUser();
    const canEdit = appUser?.role === 'owner';
    const activeLendings = lendings.filter(l => l.status !== 'Paid Off');
  
    if (activeLendings.length === 0) return null;
  
    return (
      <Card>
        <CardHeader><CardTitle>Active Lendings (Loans Given)</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="uppercase text-[10px] font-bold">Borrower</TableHead>
                <TableHead className="uppercase text-[10px] font-bold">Date Given</TableHead>
                <TableHead className="text-right uppercase text-[10px] font-bold">Interest %</TableHead>
                <TableHead className="text-right uppercase text-[10px] font-bold">Principal</TableHead>
                {canEdit && <TableHead className="w-[50px]"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {activeLendings.map((l) => (
                <TableRow key={l.id} className="h-8 text-[13px]">
                  <TableCell className="font-medium">{l.borrowerName}</TableCell>
                  <TableCell>{format(toDate(l.dateGiven), 'dd/MM/yy')}</TableCell>
                  <TableCell className="text-right">{l.interestRate}%</TableCell>
                  <TableCell className="text-right font-mono text-green-600">{formatCurrency(l.principal)}</TableCell>
                  {canEdit && <TableCell><LendingActionsMenu lending={l} /></TableCell>}
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
  const appUser = useAppUser();
  const { dateRange, financialYear } = useDateFilter();
  const canEdit = appUser?.role === 'owner';
  
  const warehouseInfoRef = useMemoFirebase(
    () => (firestore && appUser?.warehouseId ? doc(firestore, 'warehouses', appUser.warehouseId) : null),
    [firestore, appUser]
  );
  const { data: warehouseInfo, loading: loadingWarehouseInfo } = useDoc<WarehouseInfo>(warehouseInfoRef);

  const recordsQuery = useMemoFirebase(() => (firestore && appUser?.warehouseId ? query(collection(firestore, 'storageRecords'), where('warehouseId', '==', appUser.warehouseId)) : null), [firestore, appUser]);
  const { data: allRecords, loading: loadingRecords } = useCollection<StorageRecord>(recordsQuery);

  const commoditiesQuery = useMemoFirebase(() => (firestore && appUser?.warehouseId ? query(collection(firestore, 'commodities'), where('warehouseId', '==', appUser.warehouseId)) : null), [firestore, appUser]);
  const { data: allCommodities, loading: loadingCommodities } = useCollection<Commodity>(commoditiesQuery);

  const expensesQuery = useMemoFirebase(() => (firestore && appUser?.warehouseId ? query(collection(firestore, 'expenses'), where('warehouseId', '==', appUser.warehouseId)) : null), [firestore, appUser]);
  const { data: allExpenses, loading: loadingExpenses } = useCollection<Expense>(expensesQuery);
  
  const unloadingRecordsQuery = useMemoFirebase(() => (firestore && appUser?.warehouseId ? query(collection(firestore, 'unloadingRecords'), where('warehouseId', '==', appUser.warehouseId)) : null), [firestore, appUser]);
  const { data: allUnloadingRecords, loading: loadingUnloading } = useCollection<UnloadingRecord>(unloadingRecordsQuery);

  const borrowingsQuery = useMemoFirebase(() => (firestore && appUser?.warehouseId ? query(collection(firestore, 'borrowings'), where('warehouseId', '==', appUser.warehouseId)) : null), [firestore, appUser]);
  const { data: borrowings, loading: loadingBorrowings } = useCollection<Borrowing>(borrowingsQuery);
  
  const lendingsQuery = useMemoFirebase(() => (firestore && appUser?.warehouseId ? query(collection(firestore, 'lendings'), where('warehouseId', '==', appUser.warehouseId)) : null), [firestore, appUser]);
  const { data: lendings, loading: loadingLendings } = useCollection<Lending>(lendingsQuery);
  
  const otherIncomesQuery = useMemoFirebase(() => (firestore && appUser?.warehouseId ? query(collection(firestore, 'otherIncomes'), where('warehouseId', '==', appUser.warehouseId)) : null), [firestore, appUser]);
  const { data: otherIncomes, loading: loadingOtherIncomes } = useCollection<OtherIncome>(otherIncomesQuery);

  const { 
    periodIncome, 
    periodExpenses, 
    periodBalance, 
    filteredExpenses, 
    filteredIncomes, 
    interestOnCapital, 
    estimatedRent, 
    activeBags, 
    nextExpenseRefNo, 
    nextIncomeRefNo,
    totalBorrowed,
    totalLent 
  } = useMemo(() => {
    if (!allRecords || !allExpenses || !allUnloadingRecords || !otherIncomes || !allCommodities || !borrowings || !lendings) {
        return { periodIncome: 0, periodExpenses: 0, periodBalance: 0, filteredExpenses: [], filteredIncomes: [], interestOnCapital: 0, estimatedRent: 0, activeBags: 0, nextExpenseRefNo: '1001', nextIncomeRefNo: '1001', totalBorrowed: 0, totalLent: 0 };
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

    const incomeFromRecords = filteredStoragePayments.reduce((acc, p) => acc + p.amount, 0) +
                   filteredUnloadingPayments.reduce((acc, p) => acc + p.amount, 0);
    const incomeFromOther = localFilteredOtherIncomes.reduce((acc, i) => acc + i.amount, 0);
    const income = incomeFromRecords + incomeFromOther;

    const localFilteredExpenses = allExpenses.filter(e => inRange(toDate(e.date)));
    const expensesFromDb = localFilteredExpenses.reduce((total, expense) => total + expense.amount, 0);
    const totalExpenses = expensesFromDb + calculatedInterest;

    const activeRecords = allRecords.filter(r => !r.storageEndDate && r.bagsStored > 0);
    const today = new Date();
    const rentEstimate = activeRecords.reduce((total, record) => {
      const commodity = allCommodities.find(c => c.name.trim().toLowerCase() === record.commodityDescription.trim().toLowerCase());
      const recordWithRates: StorageRecord = {
          ...record,
          billingType: record.billingType || commodity?.billingType || 'slab',
          monthlyRate: record.monthlyRate ?? commodity?.monthlyRate ?? 0,
          minBillingMonths: record.minBillingMonths ?? commodity?.minBillingMonths ?? 0,
          insuranceRate: record.insuranceRate ?? commodity?.insuranceRate ?? 0,
          rate6Months: record.rate6Months ?? commodity?.rate6Months ?? 0,
          rate1Year: record.rate1Year ?? commodity?.rate1Year ?? 0,
      };

      const { rent: currentStockRent } = calculateFinalRent({ ...recordWithRates, storageStartDate: toDate(recordWithRates.storageStartDate) }, today, record.bagsStored);
      const billedRentOnOutflows = (record.outflows || []).reduce((acc, o) => acc + (o.rentBilled || 0), 0);
      const totalLiabilities = currentStockRent + billedRentOnOutflows + (record.hamaliPayable || 0) + (record.khataAmount || 0);
      const totalPaymentsReceived = (record.payments || []).reduce((acc, p) => acc + p.amount, 0);

      const recordDue = Math.max(0, totalLiabilities - totalPaymentsReceived);
      return total + recordDue;
    }, 0);
    
    const totalActiveBags = activeRecords.reduce((acc, record) => acc + record.bagsStored, 0);

    const getMaxRef = (list: any[]) => {
      const max = list.reduce((max, item) => {
        const val = parseInt(item.refNo?.replace(/[^0-9]/g, '') || '0', 10);
        return isNaN(val) ? max : Math.max(max, val);
      }, 0);
      return String(Math.max(1001, max + 1));
    };

    const borrowedPrincipal = borrowings.filter(b => b.status !== 'Paid Off').reduce((acc, b) => acc + b.principal, 0);
    const lentPrincipal = lendings.filter(l => l.status !== 'Paid Off').reduce((acc, l) => acc + l.principal, 0);

    return {
      periodIncome: income,
      periodExpenses: totalExpenses,
      periodBalance: income - totalExpenses,
      filteredExpenses: localFilteredExpenses.sort((a,b) => toDate(b.date).getTime() - toDate(a.date).getTime()),
      filteredIncomes: localFilteredOtherIncomes.sort((a,b) => toDate(b.date).getTime() - toDate(a.date).getTime()),
      interestOnCapital: calculatedInterest,
      estimatedRent: rentEstimate,
      activeBags: totalActiveBags,
      nextExpenseRefNo: getMaxRef(allExpenses),
      nextIncomeRefNo: getMaxRef(otherIncomes),
      totalBorrowed: borrowedPrincipal,
      totalLent: lentPrincipal
    };
  }, [allRecords, allExpenses, allUnloadingRecords, otherIncomes, dateRange, warehouseInfo, financialYear, allCommodities, borrowings, lendings]);

  if (loadingRecords || loadingExpenses || loadingUnloading || loadingWarehouseInfo || loadingBorrowings || loadingLendings || loadingOtherIncomes || loadingCommodities) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center p-12">Loading financials...</div>
      </AppLayout>
    );
  }
  
  return (
    <AppLayout>
      <div className="mb-4">
        <div className="space-y-0.5">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight font-headline">Profit & Loss</h1>
          <p className="text-sm text-muted-foreground">
            Track your operational finances and view profit/loss for the selected period.
          </p>
        </div>
        {canEdit && (
            <div className="flex items-center gap-2 flex-wrap mt-4">
                <AddIncomeDialog lendings={lendings || []} nextRefNo={nextIncomeRefNo} />
                <AddExpenseDialog borrowings={borrowings || []} nextRefNo={nextExpenseRefNo} />
                <Separator orientation="vertical" className="h-6" />
                <AddLendingDialog />
                <AddBorrowingDialog />
                <Separator orientation="vertical" className="h-6" />
                <ManageInvestmentDialog initialData={warehouseInfo} />
            </div>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
        <Card className="stylish-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Income</CardTitle>
                <TrendingUp className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold text-green-600">{formatCurrency(periodIncome)}</div>
            </CardContent>
        </Card>
        <Card className="stylish-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
                 <TrendingDown className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold text-destructive">{formatCurrency(periodExpenses)}</div>
            </CardContent>
        </Card>
        <Card className="stylish-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Net Profit / Loss</CardTitle>
                 <Scale className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className={`text-2xl font-bold ${periodBalance >= 0 ? 'text-primary' : 'text-destructive'}`}>{formatCurrency(periodBalance)}</div>
            </CardContent>
        </Card>
         <Card className="stylish-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Outstanding Balance</CardTitle>
                <IndianRupee className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold text-blue-600">{formatCurrency(estimatedRent)}</div>
                <p className="text-[10px] text-muted-foreground">Owed on {activeBags} active bags.</p>
            </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3 mb-8">
         <Card className="stylish-card border-l-4 border-orange-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Interest on Capital</CardTitle>
                <Banknote className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
                <div className="text-xl font-bold text-orange-600">{formatCurrency(interestOnCapital)}</div>
                <p className="text-[10px] text-muted-foreground">Cost for the selected period.</p>
            </CardContent>
        </Card>
        <Card className="stylish-card border-l-4 border-destructive">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Borrowed Principal</CardTitle>
                <Landmark className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
                <div className="text-xl font-bold text-destructive">{formatCurrency(totalBorrowed)}</div>
                <p className="text-[10px] text-muted-foreground">Active loan liabilities.</p>
            </CardContent>
        </Card>
        <Card className="stylish-card border-l-4 border-emerald-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Lent Principal</CardTitle>
                <HandCoins className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
                <div className="text-xl font-bold text-emerald-600">{formatCurrency(totalLent)}</div>
                <p className="text-[10px] text-muted-foreground">Active funds receivable.</p>
            </CardContent>
        </Card>
      </div>

      <div className="space-y-8">
        <BorrowingsTable borrowings={borrowings || []} />
        <LendingsTable lendings={lendings || []} />
        <IncomesTable incomes={filteredIncomes} />
        <ExpensesTable expenses={filteredExpenses} />
      </div>
    </AppLayout>
  );
}
