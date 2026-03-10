'use client';

import { useMemo, forwardRef } from 'react';
import type { Customer, StorageRecord, UnloadingRecord, WarehouseInfo } from '@/lib/definitions';
import { formatCurrency, toDate } from '@/lib/utils';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '../ui/table';
import { format } from 'date-fns';

type CustomerStatementProps = {
  customer: Customer;
  records: StorageRecord[];
  unloadingRecords: UnloadingRecord[];
  warehouseInfo: WarehouseInfo | null;
};

export const CustomerStatement = forwardRef<HTMLDivElement, CustomerStatementProps>(({ customer, records, unloadingRecords, warehouseInfo }, ref) => {

  const { lineItems, summary } = useMemo(() => {
    const events: any[] = [];
    
    (unloadingRecords || []).forEach(unloading => {
        events.push({
            date: toDate(unloading.unloadingDate),
            description: `Unloading Bill`,
            invoiceId: unloading.billNo || unloading.id.substring(0, 5),
            lotNo: '', // Unloading records don't have a lot no.
            bagsUnloaded: unloading.bagsUnloaded,
            bagsIn: 0,
            bagsOut: 0,
            hamaliBilled: unloading.totalHamali || 0,
            rentBilled: 0,
            credit: 0
        });

        // Add payments from unloading record
        (unloading.payments || []).forEach(payment => {
            events.push({
                date: toDate(payment.date),
                description: `Payment for Unloading Bill`,
                invoiceId: unloading.billNo || unloading.id.substring(0, 5),
                lotNo: '',
                bagsUnloaded: 0,
                bagsIn: 0,
                bagsOut: 0,
                hamaliBilled: 0,
                rentBilled: 0,
                credit: payment.amount || 0,
            });
        });
    });

    (records || []).forEach(record => {
        // Inflow
        events.push({
            date: toDate(record.storageStartDate),
            description: record.inflowType === 'Direct' ? `Inflow - ${record.commodityDescription}` : `Inflow from Plot - ${record.commodityDescription}`,
            invoiceId: record.id,
            lotNo: record.location || '',
            bagsUnloaded: 0,
            bagsIn: record.bagsIn || 0,
            bagsOut: 0,
            hamaliBilled: record.hamaliPayable || 0,
            rentBilled: 0,
            credit: 0
        });

        // Outflows from the new model
        if (Array.isArray(record.outflows)) {
            record.outflows.forEach((outflow, index) => {
                events.push({
                    date: toDate(outflow.date),
                    description: `Outflow - ${record.commodityDescription}`,
                    invoiceId: `${record.id}-${index + 1}`,
                    lotNo: record.location || '',
                    bagsUnloaded: 0,
                    bagsIn: 0,
                    bagsOut: outflow.bagsWithdrawn,
                    hamaliBilled: 0,
                    rentBilled: outflow.rentBilled || 0,
                    credit: outflow.discount || 0, // Treat discount as a credit
                });
            });
        }

        // Payments
        (record.payments || []).forEach(payment => {
            let paymentDescription = 'Payment Received';
            if (payment.type === 'hamali') {
                paymentDescription = 'Payment for Storage Hamali';
            } else if (payment.type === 'rent') {
                paymentDescription = 'Payment for Rent';
            } else if (payment.type === 'discount') {
                paymentDescription = 'Discount Given';
            }

            events.push({
                date: toDate(payment.date),
                description: paymentDescription,
                invoiceId: record.id,
                lotNo: record.location || '',
                bagsUnloaded: 0,
                bagsIn: 0,
                bagsOut: 0,
                hamaliBilled: 0,
                rentBilled: 0,
                credit: payment.amount || 0,
            });
        });
    });

    const sortedEvents = events.sort((a, b) => a.date.getTime() - b.date.getTime());

    let runningBalance = 0;
    let totalBagsIn = 0;
    let totalBagsOut = 0;
    let totalHamaliBilled = 0;
    let totalRentBilled = 0;
    let totalCredit = 0;

    const lineItems = sortedEvents.map(event => {
        const debit = (event.hamaliBilled || 0) + (event.rentBilled || 0);
        runningBalance += debit - (event.credit || 0);
        totalBagsIn += event.bagsIn || 0;
        totalBagsOut += event.bagsOut || 0;
        totalHamaliBilled += event.hamaliBilled || 0;
        totalRentBilled += event.rentBilled || 0;
        totalCredit += event.credit || 0;
        return {
            ...event,
            balance: runningBalance
        };
    });
    
    const finalBalanceStock = (records || []).reduce((acc, r) => acc + (r.bagsStored || 0), 0);

    const summary = {
        totalBagsIn,
        totalBagsOut,
        balanceStock: finalBalanceStock,
        totalHamali: totalHamaliBilled,
        totalRent: totalRentBilled,
        totalBilled: totalHamaliBilled + totalRentBilled,
        totalPaid: totalCredit,
        balanceDue: runningBalance
    };

    return { lineItems, summary };

  }, [records, unloadingRecords]);
  
  const generatedDate = useMemo(() => format(new Date(), 'dd/MM/yyyy'), []);

  if (lineItems.length === 0) {
    return (
        <div ref={ref} className="text-center text-muted-foreground py-16">
            <p>No transactions found for this customer.</p>
        </div>
    );
  }

  return (
    <div ref={ref} className="bg-white p-6 printable-area text-foreground font-sans text-sm">
        {/* Header */}
        <header className="text-center mb-4">
            <h1 className="text-xl font-bold text-primary">{warehouseInfo?.name || 'SRI LAKSHMI WAREHOUSE'}</h1>
            <p className="text-xs text-muted-foreground">{warehouseInfo?.addressLine1}, {warehouseInfo?.addressLine2}</p>
            <p className="text-xs text-muted-foreground">Phone: {warehouseInfo?.phone}</p>
        </header>

        <h2 className="text-lg font-semibold mb-4 text-center underline">Statement of Account</h2>
        
        {/* Customer Info */}
        <div className="flex justify-between items-start mb-4 text-sm">
             <div>
                <p className="text-muted-foreground">To:</p>
                <p className="font-bold">{customer.name}</p>
                <p>{customer.village}</p>
            </div>
            <div className="text-right">
                 <p><span className="font-semibold">Date:</span> {generatedDate}</p>
            </div>
        </div>

        {/* Summary Box */}
        <div className="grid grid-cols-2 gap-x-4 mb-4 p-4 border rounded-lg bg-secondary/30">
            <div className="space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Total Bags In:</span><span className="font-medium">{summary.totalBagsIn}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Total Bags Out:</span><span className="font-medium">{summary.totalBagsOut}</span></div>
                <div className="flex justify-between font-semibold"><span className="text-foreground">Balance Stock:</span><span>{summary.balanceStock}</span></div>
            </div>
            <div className="space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Total Billed:</span><span className="font-medium">{formatCurrency(summary.totalBilled)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Total Paid:</span><span className="font-medium">{formatCurrency(summary.totalPaid)}</span></div>
                <div className="flex justify-between font-semibold"><span className="text-foreground">Balance Due:</span><span className="text-destructive">{formatCurrency(summary.balanceDue)}</span></div>
            </div>
        </div>

        {/* Transaction History */}
        <div>
            <Table className="w-full text-xs">
                <TableHeader>
                    <TableRow className="border-b-2 border-border">
                        <TableHead className="h-auto p-1.5 font-semibold text-muted-foreground">Date</TableHead>
                        <TableHead className="h-auto p-1.5 font-semibold text-muted-foreground">Description</TableHead>
                        <TableHead className="h-auto p-1.5 font-semibold text-muted-foreground">Bill No</TableHead>
                        <TableHead className="h-auto p-1.5 text-right font-semibold text-muted-foreground">Bags In</TableHead>
                        <TableHead className="h-auto p-1.5 text-right font-semibold text-muted-foreground">Bags Out</TableHead>
                        <TableHead className="h-auto p-1.5 text-right font-semibold text-muted-foreground">Debit</TableHead>
                        <TableHead className="h-auto p-1.5 text-right font-semibold text-muted-foreground">Credit</TableHead>
                        <TableHead className="h-auto p-1.5 text-right font-semibold text-muted-foreground">Balance</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {lineItems.map((item, index) => {
                        const debit = (item.hamaliBilled || 0) + (item.rentBilled || 0);
                        return (
                        <TableRow key={index} className="border-b border-border/50">
                            <TableCell className="p-1.5">{format(item.date, 'dd/MM/yy')}</TableCell>
                            <TableCell className="p-1.5">{item.description}</TableCell>
                            <TableCell className="p-1.5">{item.invoiceId}</TableCell>
                            <TableCell className="p-1.5 text-right font-mono">{item.bagsIn || ''}</TableCell>
                            <TableCell className="p-1.5 text-right font-mono">{item.bagsOut || ''}</TableCell>
                            <TableCell className="p-1.5 text-right font-mono text-destructive">{debit > 0 ? formatCurrency(debit) : ''}</TableCell>
                            <TableCell className="p-1.5 text-right font-mono text-green-600">{item.credit > 0 ? formatCurrency(item.credit) : ''}</TableCell>
                            <TableCell className="p-1.5 text-right font-mono font-semibold">{formatCurrency(item.balance)}</TableCell>
                        </TableRow>
                    )})}
                </TableBody>
                 <TableFooter>
                    <TableRow className="border-t-2 border-foreground font-bold">
                        <TableCell colSpan={3} className="p-1.5 text-right">Totals:</TableCell>
                        <TableCell className="p-1.5 text-right font-mono">{summary.totalBagsIn}</TableCell>
                        <TableCell className="p-1.5 text-right font-mono">{summary.totalBagsOut}</TableCell>
                        <TableCell className="p-1.5 text-right font-mono text-destructive">{formatCurrency(summary.totalBilled)}</TableCell>
                        <TableCell className="p-1.5 text-right font-mono text-green-600">{formatCurrency(summary.totalPaid)}</TableCell>
                        <TableCell className="p-1.5 text-right font-mono">{formatCurrency(summary.balanceDue)}</TableCell>
                    </TableRow>
                 </TableFooter>
            </Table>
        </div>
        
        {/* Footer */}
        <div className="text-center text-xs text-muted-foreground mt-6">
            <p>This is a computer generated report.</p>
        </div>
    </div>
  );
});

CustomerStatement.displayName = 'CustomerStatement';
