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

function calculateLoanBalances(loan: Borrowing | Lending) {
    let principal = loan.principal;
    let accruedInterest = 0;
    const startDate = toDate(loan.dateTaken || (loan as Lending).dateGiven);
    let lastDate = startDate;
    const monthlyRate = loan.interestRate / 100;

    const allPayments = [...(loan.payments || []).map(p => ({...p, date: toDate(p.date)}))].sort((a,b) => a.date.getTime() - b.date.getTime());

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

    return {
        principalDue: Math.max(0, principal),
        interestDue: Math.max(0, accruedInterest)
    };
}

function IncomesTable({ incomes }: { incomes: OtherIncome[] }) {
    if (incomes.length === 0) return null;
    return (
      <Card>
        <CardHeader><CardTitle>Income History</CardTitle></CardHeader>
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
  if (expenses.length === 0) return null;
  return (
    <Card>
      <CardHeader><CardTitle>Expense History</CardTitle></CardHeader>
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
                {canEdit && <TableCell><ExpenseActionsMenu expense={expense} /></TableCell>}
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
                <TableHead className="text-right uppercase text-[10px] font-bold">Interest Due</TableHead>
                <TableHead className="text-right uppercase text-[10px] font-bold">Principal Due</TableHead>
                {canEdit && <TableHead className="w-[50px]"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {activeBorrowings.map((b) => {
                const { principalDue, interestDue } = calculateLoanBalances(b);
                return (
                <TableRow key={b.id} className="h-8 text-[13px]">
                  <TableCell className="font-medium">{b.lenderName}</TableCell>
                  <TableCell>{format(toDate(b.dateTaken), 'dd/MM/yy')}</TableCell>
                  <TableCell className="text-right">{b.interestRate}%</TableCell>
                  <TableCell className="text-right font-mono text-destructive">{formatCurrency(interestDue)}</TableCell>
                  <TableCell className="text-right font-mono text-destructive font-bold">{formatCurrency(principalDue)}</TableCell>
                  {canEdit && <TableCell><BorrowingActionsMenu borrowing={b} /></TableCell>}
                </TableRow>
              )})}
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
                <TableHead className="text-right uppercase text-[10px] font-bold">Interest Due</TableHead>
                <TableHead className="text-right uppercase text-[10px] font-bold">Principal Due</TableHead>
                {canEdit && <TableHead className="w-[50px]"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {activeLendings.map((l) => {
                const { principalDue, interestDue } = calculateLoanBalances(l);
                return (
                <TableRow key={l.id} className="h-8 text-[13px]">
                  <TableCell className="font-medium">{l.borrowerName}</TableCell>
                  <TableCell>{format(toDate(l.dateGiven), 'dd/MM/yy')}</TableCell>
                  <TableCell className="text-right">{l.interestRate}%</TableCell>
                  <TableCell className="text-right font-mono text-green-600">{formatCurrency(interestDue)}</TableCell>
                  <TableCell className="text-right font-mono text-green-600 font-bold">{formatCurrency(principalDue)}</TableCell>
                  {canEdit && <TableCell><LendingActionsMenu lending={l} /></TableCell>}
                </TableRow>
              )})}
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
  
  const warehouseInfoRef = useMemoFirebase(() => (firestore && appUser?.warehouseId ? doc(firestore, 'warehouses', appUser.warehouseId) : null), [firestore, appUser]);
  const { data: warehouseInfo } = useDoc<WarehouseInfo>(warehouseInfoRef);
  const { data: allRecords } = useCollection<StorageRecord>(useMemoFirebase(() => (firestore && appUser?.warehouseId ? query(collection(firestore, 'storageRecords'), where('warehouseId', '==', appUser.warehouseId)) : null), [firestore, appUser]));
  const { data: allCommodities } = useCollection<Commodity>(useMemoFirebase(() => (firestore && appUser?.warehouseId ? query(collection(firestore, 'commodities'), where('warehouseId', '==', appUser.warehouseId)) : null), [firestore, appUser]));
  const { data: allExpenses } = useCollection<Expense>(useMemoFirebase(() => (firestore && appUser?.warehouseId ? query(collection(firestore, 'expenses'), where('warehouseId', '==', appUser.warehouseId)) : null), [firestore, appUser]));
  const { data: allUnloadingRecords } = useCollection<UnloadingRecord>(useMemoFirebase(() => (firestore && appUser?.warehouseId ? query(collection(firestore, 'unloadingRecords'), where('warehouseId', '==', appUser.warehouseId)) : null), [firestore, appUser]));
  const { data: borrowings } = useCollection<Borrowing>(useMemoFirebase(() => (firestore && appUser?.warehouseId ? query(collection(firestore, 'borrowings'), where('warehouseId', '==', appUser.warehouseId)) : null), [firestore, appUser]));
  const { data: lendings } = useCollection<Lending>(useMemoFirebase(() => (firestore && appUser?.warehouseId ? query(collection(firestore, 'lendings'), where('warehouseId', '==', appUser.warehouseId)) : null), [firestore, appUser]));
  const { data: otherIncomes } = useCollection<OtherIncome>(useMemoFirebase(() => (firestore && appUser?.warehouseId ? query(collection(firestore, 'otherIncomes'), where('warehouseId', '==', appUser.warehouseId)) : null), [firestore, appUser]));

  const stats = useMemo(() => {
    if (!allRecords || !allExpenses || !allUnloadingRecords || !otherIncomes || !allCommodities || !borrowings || !lendings) return null;
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
        const to = dateRange.to ? new Date(dateRange.to) : new Date();
        to.setHours(23, 59, 59, 999);
        const diffDays = Math.ceil((to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24));
        calculatedInterest = (capital * (interestRate / 100) / 365) * diffDays;
    }
    const incomeFromRecords = allRecords.flatMap(r => r.payments || []).filter(p => inRange(toDate(p.date))).reduce((acc, p) => acc + p.amount, 0) +
                              allUnloadingRecords.flatMap(r => r.payments || []).filter(p => inRange(toDate(p.date))).reduce((acc, p) => acc + p.amount, 0);
    const incomeFromOther = otherIncomes.filter(i => inRange(toDate(i.date))).reduce((acc, i) => acc + i.amount, 0);
    const periodIncome = incomeFromRecords + incomeFromOther;
    const localFilteredExpenses = allExpenses.filter(e => inRange(toDate(e.date)));
    const periodExpenses = localFilteredExpenses.reduce((t, e) => t + e.amount, 0) + calculatedInterest;
    const activeRecords = allRecords.filter(r => !r.storageEndDate && r.bagsStored > 0);
    const today = new Date();
    const estimatedRent = activeRecords.reduce((total, record) => {
      const commodity = allCommodities.find(c => c.name.trim().toLowerCase() === record.commodityDescription.trim().toLowerCase());
      const recordWithRates: StorageRecord = { ...record, billingType: record.billingType || commodity?.billingType || 'slab', monthlyRate: record.monthlyRate ?? commodity?.monthlyRate ?? 0, minBillingMonths: record.minBillingMonths ?? commodity?.minBillingMonths ?? 0, insuranceRate: record.insuranceRate ?? commodity?.insuranceRate ?? 0, rate6Months: record.rate6Months ?? commodity?.rate6Months ?? 0, rate1Year: record.rate1Year ?? commodity?.rate1Year ?? 0 };
      const { rent: currentStockRent } = calculateFinalRent({ ...recordWithRates, storageStartDate: toDate(recordWithRates.storageStartDate) }, today, record.bagsStored);
      const totalLiabilities = currentStockRent + (record.outflows || []).reduce((acc, o) => acc + (o.rentBilled || 0), 0) + (record.hamaliPayable || 0) + (record.khataAmount || 0);
      return total + Math.max(0, totalLiabilities - (record.payments || []).reduce((acc, p) => acc + p.amount, 0));
    }, 0);
    const getMaxRef = (list: any[]) => String(Math.max(1001, list.reduce((max, item) => Math.max(max, parseInt(item.refNo?.replace(/\D/g, '') || '0', 10)), 0) + 1));
    return { periodIncome, periodExpenses, periodBalance: periodIncome - periodExpenses, filteredExpenses: localFilteredExpenses.sort((a,b) => toDate(b.date).getTime() - toDate(a.date).getTime()), filteredIncomes: otherIncomes.filter(i => inRange(toDate(i.date))).sort((a,b) => toDate(b.date).getTime() - toDate(a.date).getTime()), interestOnCapital: calculatedInterest, estimatedRent, activeBags: activeRecords.reduce((acc, record) => acc + record.bagsStored, 0), nextExpenseRefNo: getMaxRef(allExpenses), nextIncomeRefNo: getMaxRef(otherIncomes), totalBorrowed: borrowings.filter(b => b.status !== 'Paid Off').reduce((acc, b) => acc + b.principal, 0), totalLent: lendings.filter(l => l.status !== 'Paid Off').reduce((acc, l) => acc + l.principal, 0) };
  }, [allRecords, allExpenses, allUnloadingRecords, otherIncomes, dateRange, warehouseInfo, financialYear, allCommodities, borrowings, lendings]);

  if (!stats) return <AppLayout><div className="flex items-center justify-center p-12">Loading financials...</div></AppLayout>;
  
  return (
    <AppLayout>
      <div className="mb-4">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight font-headline">Profit & Loss</h1>
        <p className="text-sm text-muted-foreground">Track operations and loans for the selected period.</p>
        {canEdit && (
            <div className="flex items-center gap-2 flex-wrap mt-4">
                <AddIncomeDialog lendings={lendings || []} nextRefNo={stats.nextIncomeRefNo} />
                <AddExpenseDialog borrowings={borrowings || []} nextRefNo={stats.nextExpenseRefNo} />
                <Separator orientation="vertical" className="h-6" />
                <AddLendingDialog /><AddBorrowingDialog />
                <Separator orientation="vertical" className="h-6" /><ManageInvestmentDialog initialData={warehouseInfo} />
            </div>
        )}
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
        <Card className="stylish-card"><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Total Income</CardTitle><TrendingUp className="h-4 w-4 text-green-500" /></CardHeader><CardContent><div className="text-2xl font-bold text-green-600">{formatCurrency(stats.periodIncome)}</div></CardContent></Card>
        <Card className="stylish-card"><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Total Expenses</CardTitle><TrendingDown className="h-4 w-4 text-red-500" /></CardHeader><CardContent><div className="text-2xl font-bold text-destructive">{formatCurrency(stats.periodExpenses)}</div></CardContent></Card>
        <Card className="stylish-card"><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Net Profit / Loss</CardTitle><Scale className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className={`text-2xl font-bold ${stats.periodBalance >= 0 ? 'text-primary' : 'text-destructive'}`}>{formatCurrency(stats.periodBalance)}</div></CardContent></Card>
        <Card className="stylish-card"><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Outstanding Balance</CardTitle><IndianRupee className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold text-blue-600">{formatCurrency(stats.estimatedRent)}</div><p className="text-[10px] text-muted-foreground">Owed on {stats.activeBags} active bags.</p></CardContent></Card>
      </div>
      <div className="grid gap-4 md:grid-cols-3 mb-8">
         <Card className="stylish-card border-l-4 border-orange-500"><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Interest on Capital</CardTitle><Banknote className="h-4 w-4 text-orange-500" /></CardHeader><CardContent><div className="text-xl font-bold text-orange-600">{formatCurrency(stats.interestOnCapital)}</div></CardContent></Card>
        <Card className="stylish-card border-l-4 border-destructive"><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Borrowed Principal</CardTitle><Landmark className="h-4 w-4 text-destructive" /></CardHeader><CardContent><div className="text-xl font-bold text-destructive">{formatCurrency(stats.totalBorrowed)}</div></CardContent></Card>
        <Card className="stylish-card border-l-4 border-emerald-500"><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Lent Principal</CardTitle><HandCoins className="h-4 w-4 text-emerald-500" /></CardHeader><CardContent><div className="text-xl font-bold text-emerald-600">{formatCurrency(stats.totalLent)}</div></CardContent></Card>
      </div>
      <div className="space-y-8">
        <BorrowingsTable borrowings={borrowings || []} /><LendingsTable lendings={lendings || []} />
        <IncomesTable incomes={stats.filteredIncomes} /><ExpensesTable expenses={stats.filteredExpenses} />
      </div>
    </AppLayout>
  );
}