
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
    
    // --- GATHER ALL TRANSACTIONS ---
    (unloadingRecords || []).forEach(unloading => {
        if (unloading.totalHamali > 0) {
            events.push({
                date: toDate(unloading.unloadingDate),
                description: `Unloading Charges`,
                invoiceId: unloading.billNo || unloading.id.substring(0, 5),
                lotNo: '',
                bagsReceived: 0,
                bagsDelivered: 0,
                debit: unloading.totalHamali || 0,
                credit: 0
            });
        }
        (unloading.payments || []).forEach(payment => {
            events.push({
                date: toDate(payment.date),
                description: `Payment Received`,
                invoiceId: unloading.billNo || unloading.id.substring(0, 5),
                lotNo: '',
                bagsReceived: 0,
                bagsDelivered: 0,
                debit: 0,
                credit: payment.amount || 0,
            });
        });
    });

    (records || []).forEach(record => {
        events.push({
            date: toDate(record.storageStartDate),
            description: `Inflow: ${record.commodityDescription}`,
            invoiceId: record.id,
            lotNo: record.location || '',
            bagsReceived: record.bagsIn || 0,
            bagsDelivered: 0,
            debit: record.hamaliPayable || 0,
            credit: 0
        });

        if (Array.isArray(record.outflows)) {
            record.outflows.forEach((outflow, index) => {
                events.push({
                    date: toDate(outflow.date),
                    description: `Outflow: ${record.commodityDescription}`,
                    invoiceId: `${record.id}-${index + 1}`,
                    lotNo: record.location || '',
                    bagsReceived: 0,
                    bagsDelivered: outflow.bagsWithdrawn,
                    debit: outflow.rentBilled || 0,
                    credit: 0,
                });
                if (outflow.discount && outflow.discount > 0) {
                    events.push({
                        date: toDate(outflow.date),
                        description: `Discount Given`,
                        invoiceId: `${record.id}-${index + 1}`,
                        lotNo: record.location || '',
                        bagsReceived: 0,
                        bagsDelivered: 0,
                        debit: 0,
                        credit: outflow.discount,
                    });
                }
            });
        }

        (record.payments || []).forEach(payment => {
            events.push({
                date: toDate(payment.date),
                description: `Payment Received`,
                invoiceId: record.id,
                lotNo: record.location || '',
                bagsReceived: 0,
                bagsDelivered: 0,
                debit: 0,
                credit: payment.amount || 0,
            });
        });
    });
    
    // --- PROCESS TRANSACTIONS ---
    const sortedEvents = events.sort((a, b) => a.date.getTime() - b.date.getTime());

    let runningBagsBalance = 0;
    let runningAmountBalance = 0;
    let totalBagsReceived = 0;
    let totalBagsDelivered = 0;
    let totalDebit = 0;
    let totalCredit = 0;
    let totalHamali = 0;
    let totalRent = 0;

    const lineItems = sortedEvents.map(event => {
        runningBagsBalance += (event.bagsReceived || 0) - (event.bagsDelivered || 0);
        runningAmountBalance += (event.debit || 0) - (event.credit || 0);
        
        totalBagsReceived += event.bagsReceived || 0;
        totalBagsDelivered += event.bagsDelivered || 0;
        totalDebit += event.debit || 0;
        totalCredit += event.credit || 0;

        if (event.description.toLowerCase().includes('hamali') || event.description.toLowerCase().includes('unloading')) {
            totalHamali += event.debit || 0;
        } else if (event.description.toLowerCase().includes('outflow') || event.description.toLowerCase().includes('rent')) {
            totalRent += event.debit || 0;
        } else if (event.description.toLowerCase().includes('inflow')) {
            totalHamali += event.debit || 0;
        }

        return { ...event, balanceBags: runningBagsBalance, balanceAmount: runningAmountBalance };
    });
    
    const summary = {
        totalBagsIn: totalBagsReceived,
        totalBagsOut: totalBagsDelivered,
        balanceStock: runningBagsBalance,
        totalHamali: totalHamali,
        totalRent: totalRent,
        totalDebit: totalDebit,
        totalCredit: totalCredit,
        balanceDue: runningAmountBalance
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
    <div ref={ref} className="bg-white p-4 sm:p-6 printable-area text-foreground font-sans text-sm">
        <header className="text-center mb-4">
            <h1 className="text-xl font-bold text-primary">{warehouseInfo?.name || 'SRI LAKSHMI WAREHOUSE'}</h1>
            <p className="text-xs text-muted-foreground">{warehouseInfo?.addressLine1}, {warehouseInfo?.addressLine2}</p>
            <p className="text-xs text-muted-foreground">Phone: {warehouseInfo?.phone}</p>
        </header>

        <h2 className="text-lg font-semibold mb-4 text-center underline">STATEMENT OF ACCOUNT</h2>
        
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

        <div className="grid grid-cols-2 gap-x-4 mb-4 p-4 border rounded-lg bg-secondary/30">
            <div>
                <h3 className="font-bold text-sm mb-2 underline">STOCK DETAILS</h3>
                <div className="space-y-1 text-xs">
                    <div className="flex justify-between"><span className="text-muted-foreground">Total Bags Received:</span><span className="font-medium">{summary.totalBagsIn}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Total Bags Delivered:</span><span className="font-medium">{summary.totalBagsOut}</span></div>
                    <div className="flex justify-between font-bold"><span className="text-foreground">Balance Stock:</span><span>{summary.balanceStock}</span></div>
                </div>
            </div>
            <div>
                <h3 className="font-bold text-sm mb-2 underline">FINANCIAL DETAILS</h3>
                <div className="space-y-1 text-xs">
                    <div className="flex justify-between"><span className="text-muted-foreground">Total Hamali Charges:</span><span className="font-medium">{formatCurrency(summary.totalHamali)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Total Godown Rent:</span><span className="font-medium">{formatCurrency(summary.totalRent)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Total Amount Paid:</span><span className="font-medium">{formatCurrency(summary.totalCredit)}</span></div>
                    <div className="flex justify-between font-bold"><span className="text-foreground">Balance Amount Due:</span><span className="text-destructive">{formatCurrency(summary.balanceDue)}</span></div>
                </div>
            </div>
        </div>

        <div>
            <Table className="w-full text-xs">
                <TableHeader>
                    <TableRow className="border-b-2 border-border">
                        <TableHead className="h-auto p-1.5 font-semibold text-muted-foreground">Date</TableHead>
                        <TableHead className="h-auto p-1.5 font-semibold text-muted-foreground">Description</TableHead>
                        <TableHead className="h-auto p-1.5 font-semibold text-muted-foreground">Bill/DO No.</TableHead>
                        <TableHead className="h-auto p-1.5 font-semibold text-muted-foreground">Lot No.</TableHead>
                        <TableHead className="h-auto p-1.5 text-right font-semibold text-muted-foreground">Bags Rcvd</TableHead>
                        <TableHead className="h-auto p-1.5 text-right font-semibold text-muted-foreground">Bags Dlvrd</TableHead>
                        <TableHead className="h-auto p-1.5 text-right font-semibold text-muted-foreground">Balance Bags</TableHead>
                        <TableHead className="h-auto p-1.5 text-right font-semibold text-muted-foreground">Debit</TableHead>
                        <TableHead className="h-auto p-1.5 text-right font-semibold text-muted-foreground">Credit</TableHead>
                        <TableHead className="h-auto p-1.5 text-right font-semibold text-muted-foreground">Balance Amt</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {lineItems.map((item, index) => (
                        <TableRow key={index} className="border-b border-border/50">
                            <TableCell className="p-1.5">{format(item.date, 'dd/MM/yy')}</TableCell>
                            <TableCell className="p-1.5">{item.description}</TableCell>
                            <TableCell className="p-1.5">{item.invoiceId}</TableCell>
                            <TableCell className="p-1.5">{item.lotNo}</TableCell>
                            <TableCell className="p-1.5 text-right font-mono">{item.bagsReceived || ''}</TableCell>
                            <TableCell className="p-1.5 text-right font-mono">{item.bagsDelivered || ''}</TableCell>
                            <TableCell className="p-1.5 text-right font-mono font-semibold">{item.balanceBags}</TableCell>
                            <TableCell className="p-1.5 text-right font-mono text-destructive">{item.debit > 0 ? formatCurrency(item.debit) : ''}</TableCell>
                            <TableCell className="p-1.5 text-right font-mono text-green-600">{item.credit > 0 ? formatCurrency(item.credit) : ''}</TableCell>
                            <TableCell className="p-1.5 text-right font-mono font-semibold">{formatCurrency(item.balanceAmount)}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
                 <TableFooter>
                    <TableRow className="border-t-2 border-foreground font-bold">
                        <TableCell colSpan={4} className="p-1.5 text-right">Totals:</TableCell>
                        <TableCell className="p-1.5 text-right font-mono">{summary.totalBagsIn}</TableCell>
                        <TableCell className="p-1.5 text-right font-mono">{summary.totalBagsOut}</TableCell>
                        <TableCell className="p-1.5 text-right font-mono">{summary.balanceStock}</TableCell>
                        <TableCell className="p-1.5 text-right font-mono text-destructive">{formatCurrency(summary.totalDebit)}</TableCell>
                        <TableCell className="p-1.5 text-right font-mono text-green-600">{formatCurrency(summary.totalCredit)}</TableCell>
                        <TableCell className="p-1.5 text-right font-mono">{formatCurrency(summary.balanceDue)}</TableCell>
                    </TableRow>
                 </TableFooter>
            </Table>
        </div>
        
        <div className="flex justify-between items-end mt-8 pt-8">
            <div className="text-xs text-muted-foreground">
                <p>E. & O. E.</p>
                <p>This is a computer generated statement and does not require a signature.</p>
            </div>
            <div className="text-center">
                <div className="mt-12 border-t border-gray-400 pt-1 px-8">For {warehouseInfo?.name || 'SRI LAKSHMI WAREHOUSE'}</div>
            </div>
        </div>
    </div>
  );
});

CustomerStatement.displayName = 'CustomerStatement';
