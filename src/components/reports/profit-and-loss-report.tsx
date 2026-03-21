
'use client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { formatCurrency, toDate } from "@/lib/utils";
import { useMemo, useRef, useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import type { Expense, StorageRecord, UnloadingRecord, WarehouseInfo, Borrowing, Lending, OtherIncome } from "@/lib/definitions";
import { format, differenceInCalendarMonths, differenceInCalendarYears } from "date-fns";
import { useDateFilter } from "@/firebase/provider";
import { Button } from "../ui/button";
import { Download, Loader2, Printer } from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

function BorrowingsTable({ borrowings }: { borrowings: Borrowing[] }) {
  const activeBorrowings = useMemo(() => (borrowings || []).filter(b => b.status !== 'Paid Off'), [borrowings]);

  if (activeBorrowings.length === 0) {
    return null;
  }
  
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
                  <TableCell className="text-right font-mono text-red-600">{formatCurrency(borrowing.principalDue)}</TableCell>
                  <TableCell className="text-right font-mono text-red-600">{formatCurrency(borrowing.interestDue)}</TableCell>
                  <TableCell className="text-right font-mono font-bold text-red-600">{formatCurrency(borrowing.totalDue)}</TableCell>
                </TableRow>
            ))}
          </TableBody>
           <TableFooter>
                <TableRow>
                    <TableCell colSpan={4} className="text-right font-bold">Totals</TableCell>
                    <TableCell className="text-right font-mono font-bold text-red-600">{formatCurrency(totals.principalDue)}</TableCell>
                    <TableCell className="text-right font-mono font-bold text-red-600">{formatCurrency(totals.interestDue)}</TableCell>
                    <TableCell className="text-right font-mono font-bold text-red-600">{formatCurrency(totals.totalDue)}</TableCell>
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
        const canvas = await html2canvas(element, { 
            scale: 2, 
            useCORS: true,
            windowWidth: element.scrollWidth,
            windowHeight: element.scrollHeight 
        });
        const imgData = canvas.toDataURL('image/png');
        const imgWidth = canvas.width;
        const imgHeight = canvas.height;

        const pdf = new jsPDF({
            orientation: 'p',
            unit: 'px',
            format: 'a4'
        });

        const pdfWidth = pdf.internal.pageSize.getWidth();
        
        const ratio = pdfWidth / imgWidth;
        const canvasHeight = imgHeight * ratio;

        let position = 0;
        let heightLeft = canvasHeight;

        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, canvasHeight);
        heightLeft -= pdf.internal.pageSize.getHeight();

        while (heightLeft > 0) {
            position = position - pdf.internal.pageSize.getHeight();
            pdf.addPage();
            pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, canvasHeight);
            heightLeft -= pdf.internal.pageSize.getHeight();
        }

        pdf.save(`profit-loss-report-${Date.now()}.pdf`);
    } catch (error) {
        console.error('Error generating PDF:', error);
    } finally {
        setIsGenerating(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <Card>
        <CardHeader className="flex-row items-center justify-between print-hide">
            <div className="flex-1">
                <CardTitle>Profit & Loss Statement</CardTitle>
                <CardDescription>A P&L statement for the selected financial period.</CardDescription>
            </div>
             <div className="flex items-center gap-2">
                <Button variant="outline" onClick={handlePrint}>
                    <Printer className="mr-2 h-4 w-4" /> Print
                </Button>
                <Button onClick={handleDownloadPdf} disabled={isGenerating}>
                    {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                    Download PDF
                </Button>
            </div>
        </CardHeader>
        <CardContent>
            <div ref={reportRef} className="p-4 space-y-6 bg-white text-black printable-area">
                <div className="text-center">
                    <h2 className="text-xl font-bold">{warehouseInfo?.name || "Srilakshmi Warehouse"}</h2>
                    <h3 className="text-lg font-semibold">Profit & Loss Statement</h3>
                    <p className="text-sm text-gray-500">
                        For the period: {dateRange?.from ? format(dateRange.from, 'dd MMM yyyy') : 'Start of time'} to {dateRange?.to ? format(dateRange.to, 'dd MMM yyyy') : 'Today'}
                    </p>
                </div>
                
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="text-black">Particulars</TableHead>
                            <TableHead className="text-right text-black">Amount</TableHead>
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
                                <TableCell className="text-right font-mono text-red-600">({formatCurrency(expense.amount)})</TableCell>
                            </TableRow>
                        ))}
                        {interestOnCapital > 0 && (
                            <TableRow key="exp-capital">
                                <TableCell className="pl-6">Interest on Capital (Notional)</TableCell>
                                <TableCell className="text-right font-mono text-red-600">({formatCurrency(interestOnCapital)})</TableCell>
                            </TableRow>
                        )}
                        <TableRow>
                            <TableCell colSpan={2} className="h-4" />
                        </TableRow>
                        <TableRow className="border-y bg-gray-50">
                            <TableCell className="font-semibold text-right">Total Expenses</TableCell>
                            <TableCell className="text-right font-mono font-semibold text-red-600">({formatCurrency(periodExpenses)})</TableCell>
                        </TableRow>
                    </TableBody>
                    <TableFooter>
                        <TableRow className="text-lg bg-gray-200 hover:bg-gray-200">
                            <TableCell className="font-bold">{periodBalance >= 0 ? 'Net Profit' : 'Net Loss'}</TableCell>
                            <TableCell className={`text-right font-bold font-mono ${periodBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {formatCurrency(periodBalance)}
                            </TableCell>
                        </TableRow>
                    </TableFooter>
                </Table>

                <div className="space-y-4 pt-8 print-no-break">
                    <BorrowingsTable borrowings={borrowings || []} />
                    <LendingsTable lendings={lendings || []} />
                </div>
            </div>
        </CardContent>
    </Card>
  );
}

    
