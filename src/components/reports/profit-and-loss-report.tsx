'use client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Scale, Banknote } from "lucide-react";
import { formatCurrency, toDate } from "@/lib/utils";
import { useMemo, useRef, useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Expense, StorageRecord, UnloadingRecord, WarehouseInfo, Borrowing, Lending, OtherIncome } from "@/lib/definitions";
import { format } from "date-fns";
import { ExpenseActionsMenu } from "@/components/expenses/expense-actions-menu";
import { useDateFilter } from "@/firebase/provider";
import { Separator } from "@/components/ui/separator";
import { Button } from "../ui/button";
import { Download, Loader2 } from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

function IncomesTable({ incomes }: { incomes: OtherIncome[] }) {
    if (incomes.length === 0) return null;
    return (
      <Card>
        <CardHeader><CardTitle>Income History</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead className="hidden sm:table-cell">Date</TableHead><TableHead>Category</TableHead><TableHead>Description</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
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
  if (expenses.length === 0) return (
    <Card><CardContent className="p-2 text-center text-muted-foreground">No expenses recorded for the selected period.</CardContent></Card>
  );
  return (
    <Card>
      <CardHeader><CardTitle>Expense History</CardTitle></CardHeader>
      <CardContent>
        <Table>
          <TableHeader><TableRow><TableHead className="hidden sm:table-cell">Date</TableHead><TableHead>Category</TableHead><TableHead>Description</TableHead><TableHead className="text-right">Amount</TableHead><TableHead className="w-[50px]"></TableHead></TableRow></TableHeader>
          <TableBody>
            {expenses.map((expense) => (
              <TableRow key={expense.id}>
                <TableCell className="hidden sm:table-cell">{format(toDate(expense.date), 'dd MMM yyyy')}</TableCell>
                <TableCell>{expense.category}</TableCell>
                <TableCell className="font-medium">{expense.description}</TableCell>
                <TableCell className="text-right font-mono">{formatCurrency(expense.amount)}</TableCell>
                <TableCell><ExpenseActionsMenu expense={expense} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function BorrowingsTable({ borrowings }: { borrowings: Borrowing[] }) {
  if (borrowings.length === 0) return null;
  return (
    <Card>
      <CardHeader><CardTitle>Active Borrowings (Money Taken)</CardTitle></CardHeader>
      <CardContent>
        <Table>
          <TableHeader><TableRow><TableHead>Lender</TableHead><TableHead>Date Taken</TableHead><TableHead>Interest</TableHead><TableHead className="text-right">Yearly Interest</TableHead><TableHead className="text-right">Principal</TableHead></TableRow></TableHeader>
          <TableBody>
            {borrowings.map((borrowing) => {
              const annualInterest = borrowing.interestType === 'Monthly' ? borrowing.principal * (borrowing.interestRate / 100) * 12 : borrowing.principal * (borrowing.interestRate / 100);
              return (
                <TableRow key={borrowing.id}>
                  <TableCell className="font-medium">{borrowing.lenderName}</TableCell>
                  <TableCell>{format(toDate(borrowing.dateTaken), 'dd MMM yyyy')}</TableCell>
                  <TableCell>{borrowing.interestRate}% {borrowing.interestType}</TableCell>
                  <TableCell className="text-right font-mono">{formatCurrency(annualInterest)}</TableCell>
                  <TableCell className="text-right font-mono">{formatCurrency(borrowing.principal)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

function LendingsTable({ lendings }: { lendings: Lending[] }) {
  if (lendings.length === 0) return null;
  return (
    <Card>
      <CardHeader><CardTitle>Active Lendings (Money Given)</CardTitle></CardHeader>
      <CardContent>
        <Table>
          <TableHeader><TableRow><TableHead>Borrower</TableHead><TableHead>Date Given</TableHead><TableHead>Interest</TableHead><TableHead className="text-right">Yearly Interest Income</TableHead><TableHead className="text-right">Principal</TableHead></TableRow></TableHeader>
          <TableBody>
            {lendings.map((lending) => {
              const annualInterest = lending.interestType === 'Monthly' ? lending.principal * (lending.interestRate / 100) * 12 : lending.principal * (lending.interestRate / 100);
              return (
                <TableRow key={lending.id}>
                  <TableCell className="font-medium">{lending.borrowerName}</TableCell>
                  <TableCell>{format(toDate(lending.dateGiven), 'dd MMM yyyy')}</TableCell>
                  <TableCell>{lending.interestRate}% {lending.interestType}</TableCell>
                  <TableCell className="text-right font-mono text-green-600">{formatCurrency(annualInterest)}</TableCell>
                  <TableCell className="text-right font-mono">{formatCurrency(lending.principal)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
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
  const [isGenerating, setIsGenerating] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  const { periodIncome, periodExpenses, periodBalance, filteredExpenses, filteredIncomes, interestOnCapital } = useMemo(() => {
    if (!allRecords || !allExpenses || !allUnloadingRecords || !otherIncomes) {
        return { periodIncome: 0, periodExpenses: 0, periodBalance: 0, filteredExpenses: [], filteredIncomes: [], interestOnCapital: 0 };
    }
    const inRange = (date: Date) => {
        if (!dateRange) return true;
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

  const handleDownloadPdf = async () => {
    const element = reportRef.current;
    if (!element) return;
    setIsGenerating(true);
    try {
        const canvas = await html2canvas(element, { scale: 2, useCORS: true, windowWidth: element.scrollWidth, windowHeight: element.scrollHeight });
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4'); // Portrait
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        
        const imgProps= pdf.getImageProperties(imgData);
        const imgWidth = imgProps.width;
        const imgHeight = imgProps.height;
        
        const ratio = imgWidth / pdfWidth;
        const canvasHeight = imgHeight / ratio;
        
        let position = 0;
        let heightLeft = canvasHeight;

        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, canvasHeight);
        heightLeft -= pdfHeight;

        while (heightLeft > 0) {
            position = position - pdfHeight;
            pdf.addPage();
            pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, canvasHeight);
            heightLeft -= pdfHeight;
        }

        pdf.save(`profit-loss-report-${Date.now()}.pdf`);
    } catch (error) {
        console.error('Error generating PDF:', error);
    } finally {
        setIsGenerating(false);
    }
  };

  return (
    <Card>
        <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Profit & Loss Summary</CardTitle>
            <Button onClick={handleDownloadPdf} disabled={isGenerating}>
                {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                Download PDF
            </Button>
        </CardHeader>
        <CardContent>
            <div ref={reportRef} className="p-4 space-y-4">
                <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1"><CardTitle>Total Income</CardTitle><TrendingUp className="h-4 w-4 text-muted-foreground text-green-500" /></CardHeader>
                        <CardContent><div className="text-2xl font-bold text-green-600">{formatCurrency(periodIncome)}</div><p className="text-xs text-muted-foreground">Income received during the selected period.</p></CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1"><CardTitle>Total Expenses</CardTitle><TrendingDown className="h-4 w-4 text-muted-foreground text-red-500" /></CardHeader>
                        <CardContent><div className="text-2xl font-bold text-destructive">{formatCurrency(periodExpenses)}</div><p className="text-xs text-muted-foreground">Expenses recorded during the selected period.</p></CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1"><CardTitle>Interest on Capital</CardTitle><Banknote className="h-4 w-4 text-muted-foreground" /></CardHeader>
                        <CardContent><div className="text-2xl font-bold text-orange-600">{formatCurrency(interestOnCapital)}</div><p className="text-xs text-muted-foreground">on {formatCurrency(warehouseInfo?.capitalInvestment || 0)} @ {warehouseInfo?.annualInterestRate || 0}% p.a.</p></CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1"><CardTitle>Net Profit / Loss</CardTitle><Scale className="h-4 w-4 text-muted-foreground" /></CardHeader>
                        <CardContent><div className={`text-2xl font-bold ${periodBalance >= 0 ? 'text-primary' : 'text-destructive'}`}>{formatCurrency(periodBalance)}</div><p className="text-xs text-muted-foreground">Your net profit or loss for the selected period.</p></CardContent>
                    </Card>
                </div>
                <div className="space-y-4">
                    <BorrowingsTable borrowings={borrowings || []} />
                    <LendingsTable lendings={lendings || []} />
                    <Separator />
                    <IncomesTable incomes={filteredIncomes} />
                    <ExpensesTable expenses={filteredExpenses} />
                </div>
            </div>
        </CardContent>
    </Card>
  );
}
