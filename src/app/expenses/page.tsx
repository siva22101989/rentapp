'use client';
import { AppLayout } from "@/components/layout/app-layout";
import { AddExpenseDialog } from "@/components/expenses/add-expense-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Scale, Banknote, IndianRupee, Landmark, HandCoins, MinusCircle } from "lucide-react";
import { formatCurrency, toDate } from "@/lib/utils";
import { useMemo } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Expense, StorageRecord, WarehouseInfo, Borrowing, Lending, OtherIncome, Commodity, UnloadingRecord, CustomerPayment } from "@/lib/definitions";
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
    let principal = Number(loan.principal) || 0;
    let accruedInterest = 0;
    const startDate = toDate((loan as Borrowing).dateTaken || (loan as Lending).dateGiven);
    let lastDate = startDate;
    const monthlyRate = (Number(loan.interestRate) || 0) / 100;

    const allPayments = [...(loan.payments || []).map(p => ({...p, date: toDate(p.date)}))].sort((a,b) => a.date.getTime() - b.date.getTime());

    for (const payment of allPayments) {
        const dateOfPayment = payment.date;
        const months = differenceInCalendarMonths(dateOfPayment, lastDate);
        
        if (months > 0) {
            accruedInterest += principal * monthlyRate * months;
        }
        
        let paymentAmount = Number(payment.amount) || 0;
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
        <CardHeader><CardTitle className="text-center">Income History</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="hidden sm:table-cell uppercase text-[10px] font-bold text-center">Date</TableHead>
                <TableHead className="uppercase text-[10px] font-bold text-center">Bill No</TableHead>
                <TableHead className="uppercase text-[10px] font-bold text-center">Category</TableHead>
                <TableHead className="uppercase text-[10px] font-bold text-center">Description</TableHead>
                <TableHead className="text-center uppercase text-[10px] font-bold">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {incomes.map((income) => (
                <TableRow key={income.id} className="h-8 text-[13px]">
                  <TableCell className="hidden sm:table-cell text-center">{format(toDate(income.date), 'dd/MM/yy')}</TableCell>
                  <TableCell className="font-mono text-center">{income.refNo || '-'}</TableCell>
                  <TableCell className="text-center">{income.category}</TableCell>
                  <TableCell className="font-medium text-center">{income.description}</TableCell>
                  <TableCell className="text-right font-mono text-green-600">{formatCurrency(Number(income.amount) || 0)}</TableCell>
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
      <CardHeader><CardTitle className="text-center">Expense History</CardTitle></CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="hidden sm:table-cell uppercase text-[10px] font-bold text-center">Date</TableHead>
              <TableHead className="uppercase text-[10px] font-bold text-center">Bill No</TableHead>
              <TableHead className="uppercase text-[10px] font-bold text-center">Category</TableHead>
              <TableHead className="uppercase text-[10px] font-bold text-center">Description</TableHead>
              <TableHead className="text-center uppercase text-[10px] font-bold">Amount</TableHead>
              {canEdit && <TableHead className="w-[50px]"></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {expenses.map((expense) => (
              <TableRow key={expense.id} className="h-8 text-[13px]">
                <TableCell className="hidden sm:table-cell text-center">{format(toDate(expense.date), 'dd/MM/yy')}</TableCell>
                <TableCell className="font-mono text-center">{expense.refNo || '-'}</TableCell>
                <TableCell className="text-center">{expense.category}</TableCell>
                <TableCell className="font-medium text-center">{expense.description}</TableCell>
                <TableCell className="text-right font-mono">{formatCurrency(Number(expense.amount) || 0)}</TableCell>
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
        <CardHeader><CardTitle className="text-center">Active Borrowings (Loans Taken)</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="uppercase text-[10px] font-bold text-center">Date Taken</TableHead>
                <TableHead className="uppercase text-[10px] font-bold text-center">Lender</TableHead>
                <TableHead className="text-center uppercase text-[10px] font-bold">Principal Due</TableHead>
                <TableHead className="text-center uppercase text-[10px] font-bold">Interest Due</TableHead>
                <TableHead className="text-center uppercase text-[10px] font-bold">Total Amount</TableHead>
                {canEdit && <TableHead className="w-[50px]"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {activeBorrowings.map((b) => {
                const { principalDue, interestDue } = calculateLoanBalances(b);
                return (
                <TableRow key={b.id} className="h-8 text-[13px]">
                  <TableCell className="text-center">{format(toDate(b.dateTaken), 'dd/MM/yy')}</TableCell>
                  <TableCell className="font-medium text-center">{b.lenderName}</TableCell>
                  <TableCell className="text-right font-mono text-destructive">{formatCurrency(principalDue)}</TableCell>
                  <TableCell className="text-right font-mono text-destructive">{formatCurrency(interestDue)}</TableCell>
                  <TableCell className="text-right font-mono text-destructive font-bold">{formatCurrency(principalDue + interestDue)}</TableCell>
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
        <CardHeader><CardTitle className="text-center">Active Lendings (Loans Given)</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="uppercase text-[10px] font-bold text-center">Date Given</TableHead>
                <TableHead className="uppercase text-[10px] font-bold text-center">Borrower</TableHead>
                <TableHead className="text-center uppercase text-[10px] font-bold">Principal Due</TableHead>
                <TableHead className="text-center uppercase text-[10px] font-bold">Interest Due</TableHead>
                <TableHead className="text-center uppercase text-[10px] font-bold">Total Amount</TableHead>
                {canEdit && <TableHead className="w-[50px]"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {activeLendings.map((l) => {
                const { principalDue, interestDue } = calculateLoanBalances(l);
                return (
                <TableRow key={l.id} className="h-8 text-[13px]">
                  <TableCell className="text-center">{format(toDate(l.dateGiven), 'dd/MM/yy')}</TableCell>
                  <TableCell className="font-medium text-center">{l.borrowerName}</TableCell>
                  <TableCell className="text-right font-mono text-green-600">{formatCurrency(principalDue)}</TableCell>
                  <TableCell className="text-right font-mono text-green-600">{formatCurrency(interestDue)}</TableCell>
                  <TableCell className="text-right font-mono text-green-600 font-bold">{formatCurrency(principalDue + interestDue)}</TableCell>
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
  const { data: customerPayments } = useCollection<CustomerPayment>(useMemoFirebase(() => (firestore && appUser?.warehouseId ? query(collection(firestore, 'customerPayments'), where('warehouseId', '==', appUser.warehouseId)) : null), [firestore, appUser]));

  const stats = useMemo(() => {
    if (!allRecords || !allExpenses || !allUnloadingRecords || !otherIncomes || !allCommodities || !borrowings || !lendings || !customerPayments) return null;
    
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
        const to = dateRange.to ? new Date(dateRange.to) : new Date();
        to.setHours(23, 59, 59, 999);
        const diffDays = Math.ceil((to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24));
        calculatedInterest = (capital * (interestRate / 100) / 365) * diffDays;
    }

    // 1. Calculate Gross Income (Actual Cash Receipts)
    const incomeFromRecords = allRecords.flatMap(r => r.payments || []).filter(p => inRange(toDate(p.date)) && p.type !== 'discount').reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
    const incomeFromUnloading = allUnloadingRecords.flatMap(r => r.payments || []).filter(p => inRange(toDate(p.date)) && p.type !== 'discount').reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
    const incomeFromBulk = customerPayments.filter(p => inRange(toDate(p.date)) && !p.isDiscount).reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
    const incomeFromOther = otherIncomes.filter(i => inRange(toDate(i.date))).reduce((acc, i) => acc + (Number(i.amount) || 0), 0);
    
    const totalCashIncome = incomeFromRecords + incomeFromUnloading + incomeFromBulk + incomeFromOther;

    // 2. Calculate Loss from Discounts / Waivers (Including Outflow Patti Discounts)
    const discountFromRecords = allRecords.flatMap(r => r.payments || []).filter(p => inRange(toDate(p.date)) && p.type === 'discount').reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
    const discountFromUnloading = allUnloadingRecords.flatMap(r => r.payments || []).filter(p => inRange(toDate(p.date)) && p.type === 'discount').reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
    const discountFromBulk = customerPayments.filter(p => inRange(toDate(p.date)) && p.isDiscount).reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
    const discountFromOutflows = allRecords.flatMap(r => r.outflows || []).filter(o => inRange(toDate(o.date))).reduce((acc, o) => acc + (Number(o.discount) || 0), 0);
    
    const totalDiscountLoss = discountFromRecords + discountFromUnloading + discountFromBulk + discountFromOutflows;

    // 3. Total Operational Expenses
    const localFilteredExpenses = allExpenses.filter(e => inRange(toDate(e.date)));
    const totalOperatingExpenses = localFilteredExpenses.reduce((t, e) => t + (Number(e.amount) || 0), 0) + calculatedInterest;
    
    const grandTotalExpenses = totalOperatingExpenses + totalDiscountLoss;

    const activeRecords = allRecords.filter(r => !r.storageEndDate && (Number(r.bagsStored) || 0) > 0);
    const today = new Date();
    
    const estimatedRent = activeRecords.reduce((total, record) => {
      const normalizedDesc = (record.commodityDescription || '').trim().toLowerCase();
      const commodity = allCommodities.find(c => (c.name || '').trim().toLowerCase() === normalizedDesc);
      
      const recordWithRates: StorageRecord = { ...record, billingType: record.billingType || commodity?.billingType || 'slab', monthlyRate: record.monthlyRate ?? commodity?.monthlyRate ?? 0, minBillingMonths: record.minBillingMonths ?? commodity?.minBillingMonths ?? 0, insuranceRate: record.insuranceRate ?? commodity?.insuranceRate ?? 0, rate6Months: record.rate6Months ?? commodity?.rate6Months ?? 0, rate1Year: record.rate1Year ?? commodity?.rate1Year ?? 0 };
      const { rent: currentStockRent } = calculateFinalRent({ ...recordWithRates, storageStartDate: toDate(recordWithRates.storageStartDate) }, today, Number(record.bagsStored) || 0);
      const totalLiabilities = currentStockRent + (record.outflows || []).reduce((acc, o) => acc + (Number(o.rentBilled) || 0), 0) + (Number(record.hamaliPayable) || 0) + (Number(record.khataAmount) || 0);
      return total + Math.max(0, totalLiabilities - (record.payments || []).reduce((acc, p) => acc + (Number(p.amount) || 0), 0));
    }, 0);

    const getMaxRef = (list: any[]) => String(Math.max(1001, list.reduce((max, item) => Math.max(max, parseInt(item.refNo?.replace(/\D/g, '') || '0', 10)), 0) + 1));
    
    // Calculate REAL principal dues for summary cards
    const currentTotalBorrowed = borrowings.filter(b => b.status !== 'Paid Off').reduce((acc, b) => {
        const { principalDue } = calculateLoanBalances(b);
        return acc + principalDue;
    }, 0);

    const currentTotalLent = lendings.filter(l => l.status !== 'Paid Off').reduce((acc, l) => {
        const { principalDue } = calculateLoanBalances(l);
        return acc + principalDue;
    }, 0);

    return { 
        periodIncome: totalCashIncome, 
        periodExpenses: grandTotalExpenses, 
        operatingExpenses: totalOperatingExpenses,
        discountLoss: totalDiscountLoss,
        periodBalance: totalCashIncome - grandTotalExpenses, 
        filteredExpenses: localFilteredExpenses.sort((a,b) => toDate(b.date).getTime() - toDate(a.date).getTime()), 
        filteredIncomes: otherIncomes.filter(i => inRange(toDate(i.date))).sort((a,b) => toDate(b.date).getTime() - toDate(a.date).getTime()), 
        interestOnCapital: calculatedInterest, 
        estimatedRent, 
        activeBags: activeRecords.reduce((acc, record) => acc + (Number(record.bagsStored) || 0), 0), 
        nextExpenseRefNo: getMaxRef(allExpenses), 
        nextIncomeRefNo: getMaxRef(otherIncomes), 
        totalBorrowed: currentTotalBorrowed, 
        totalLent: currentTotalLent 
    };
  }, [allRecords, allExpenses, allUnloadingRecords, otherIncomes, customerPayments, dateRange, warehouseInfo, financialYear, allCommodities, borrowings, lendings]);

  if (!stats) return <AppLayout><div className="flex items-center justify-center p-12 text-muted-foreground font-bold animate-pulse">Synchronizing financials...</div></AppLayout>;
  
  return (
    <AppLayout>
      <div className="mb-4">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight font-headline text-slate-900">Profit & Loss</h1>
        <p className="text-sm text-muted-foreground">Comprehensive financial audit including operational losses and waivers.</p>
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
        <Card className="stylish-card"><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Total Expenses & Loss</CardTitle><TrendingDown className="h-4 w-4 text-red-500" /></CardHeader><CardContent><div className="text-2xl font-bold text-destructive">{formatCurrency(stats.periodExpenses)}</div></CardContent></Card>
        <Card className="stylish-card"><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Net Profit / Loss</CardTitle><Scale className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className={`text-2xl font-bold ${stats.periodBalance >= 0 ? 'text-primary' : 'text-destructive'}`}>{formatCurrency(stats.periodBalance)}</div></CardContent></Card>
        <Card className="stylish-card"><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Godown Rent Receivable</CardTitle><IndianRupee className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold text-blue-600">{formatCurrency(stats.estimatedRent)}</div><p className="text-[10px] text-muted-foreground">Accrued rent on {stats.activeBags} balance bags.</p></CardContent></Card>
      </div>

      <div className="grid gap-4 md:grid-cols-4 mb-8">
         <Card className="stylish-card border-l-4 border-orange-500"><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-xs font-bold uppercase text-slate-500">Interest on Capital</CardTitle><Banknote className="h-3 w-3 text-orange-500" /></CardHeader><CardContent><div className="text-lg font-black text-orange-600">{formatCurrency(stats.interestOnCapital)}</div></CardContent></Card>
         <Card className="stylish-card border-l-4 border-red-400 bg-red-50/10"><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-xs font-bold uppercase text-red-600">Discounts (Loss Account)</CardTitle><MinusCircle className="h-3 w-3 text-red-400" /></CardHeader><CardContent><div className="text-lg font-black text-red-600">{formatCurrency(stats.discountLoss)}</div></CardContent></Card>
        <Card className="stylish-card border-l-4 border-destructive"><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-xs font-bold uppercase text-slate-500">Borrowed Principal</CardTitle><Landmark className="h-3 w-3 text-destructive" /></CardHeader><CardContent><div className="text-lg font-black text-destructive">{formatCurrency(stats.totalBorrowed)}</div></CardContent></Card>
        <Card className="stylish-card border-l-4 border-emerald-500"><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-xs font-bold uppercase text-slate-500">Lent Principal</CardTitle><HandCoins className="h-3 w-3 text-emerald-500" /></CardHeader><CardContent><div className="text-lg font-black text-emerald-600">{formatCurrency(stats.totalLent)}</div></CardContent></Card>
      </div>

      <div className="space-y-8">
        <BorrowingsTable borrowings={borrowings || []} /><LendingsTable lendings={lendings || []} />
        <IncomesTable incomes={stats.filteredIncomes} /><ExpensesTable expenses={stats.filteredExpenses} />
      </div>
    </AppLayout>
  );
}
