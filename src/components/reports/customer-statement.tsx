
'use client';

import { useMemo, forwardRef } from 'react';
import type { Customer, StorageRecord, UnloadingRecord } from '@/lib/definitions';
import { formatCurrency, toDate } from '@/lib/utils';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '../ui/table';
import { format } from 'date-fns';

type CustomerStatementProps = {
  customer: Customer;
  records: StorageRecord[];
  unloadingRecords: UnloadingRecord[];
};

export const CustomerStatement = forwardRef<HTMLDivElement, CustomerStatementProps>(({ customer, records, unloadingRecords }, ref) => {

  const { lineItems, summary } = useMemo(() => {
    const events: any[] = [];
    
    (unloadingRecords || []).forEach(unloading => {
        events.push({
            date: toDate(unloading.unloadingDate),
            description: `Unloading Bill`,
            invoiceId: unloading.billNo || unloading.id.substring(0, 5),
            bagsUnloaded: unloading.bagsUnloaded,
            bagsIn: 0,
            bagsOut: 0,
            hamaliBilled: unloading.totalHamali || 0,
            rentBilled: 0,
            credit: 0
        });
    });

    (records || []).forEach(record => {
        // Inflow
        events.push({
            date: toDate(record.storageStartDate),
            description: record.inflowType === 'Direct' ? 'Direct Inflow' : 'Inflow from Plot',
            invoiceId: record.id,
            bagsUnloaded: 0,
            bagsIn: record.bagsIn || 0,
            bagsOut: 0,
            hamaliBilled: record.hamaliPayable || 0,
            rentBilled: 0,
            credit: 0
        });

        // Outflows from the new model
        (record.outflows || []).forEach(outflow => {
            events.push({
                date: toDate(outflow.date),
                description: `Outflow`,
                invoiceId: record.id,
                bagsUnloaded: 0,
                bagsIn: 0,
                bagsOut: outflow.bagsWithdrawn,
                hamaliBilled: 0,
                rentBilled: outflow.rentBilled || 0,
                credit: 0,
            });
        });

        // Payments
        (record.payments || []).forEach(payment => {
            events.push({
                date: toDate(payment.date),
                description: `Payment Received (${payment.type || 'other'})`,
                invoiceId: record.id,
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
    let totalBagsUnloaded = 0;
    let totalBagsIn = 0;
    let totalBagsOut = 0;
    let totalHamaliBilled = 0;
    let totalRentBilled = 0;
    let totalCredit = 0;

    const lineItems = sortedEvents.map(event => {
        const debit = (event.hamaliBilled || 0) + (event.rentBilled || 0);
        runningBalance += debit - (event.credit || 0);
        totalBagsUnloaded += event.bagsUnloaded || 0;
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

    const summary = {
        totalBagsUnloaded,
        totalBagsIn,
        totalBagsOut,
        balanceStock: totalBagsIn - totalBagsOut,
        totalHamali: totalHamaliBilled,
        totalRent: totalRentBilled,
        totalBilled: totalHamaliBilled + totalRentBilled,
        totalPaid: totalCredit,
        balanceDue: runningBalance
    };

    return { lineItems, summary };

  }, [records, unloadingRecords]);
  
  const generatedDate = useMemo(() => format(new Date(), 'dd/MM/yyyy'), []);
  const generatedTimestamp = useMemo(() => format(new Date(), 'dd/MM/yyyy HH:mm:ss'), []);

  if (lineItems.length === 0) {
    return (
        <div ref={ref} className="text-center text-muted-foreground py-16">
            <p>No transactions found for this customer.</p>
        </div>
    );
  }

  return (
    <div ref={ref} className="bg-white p-8 printable-area text-black font-sans text-xs">
        {/* Header */}
        <header className="flex justify-between items-start mb-8">
            <div className="flex flex-col">
                <h1 className="text-2xl font-bold">SRI LAKSHMI WAREHOUSE</h1>
                <p>Accounting Software</p>
            </div>
            <div className="text-right">
                <p>PO BOX 123</p>
                <p>OWK, KURNOOL, ANDHRA PRADESH</p>
                <p>accounts@slwarehouse.com</p>
                <p>www.slwarehouse.com</p>
                <p>Phone: 9160606633</p>
            </div>
        </header>

        <h2 className="text-xl font-bold mb-6">Statement of Account</h2>
        
        {/* Customer Info */}
        <div className="flex justify-between items-start mb-6">
             <div className="w-1/2">
                <p className="font-bold">{customer.name}</p>
                <p>{customer.address}</p>
                <p>{customer.village}</p>
            </div>
            <div className="w-1/2 text-right">
                <div className="flex justify-end">
                    <span className="font-bold w-20 text-left">Account</span>
                    <span>{customer.id.substring(0, 10)}</span>
                </div>
                 <div className="flex justify-end">
                    <span className="font-bold w-20 text-left">Date</span>
                    <span>{generatedDate}</span>
                </div>
            </div>
        </div>

        {/* New Summary Box */}
        <div className="grid grid-cols-2 gap-x-8 mb-6 p-4 border rounded-lg">
            {/* Stock Summary */}
            <div className="space-y-1">
                <div className="flex justify-between"><span className="font-bold">Total Bags Unloaded:</span><span>{summary.totalBagsUnloaded}</span></div>
                <div className="flex justify-between"><span className="font-bold">Total Bags Stored (In):</span><span>{summary.totalBagsIn}</span></div>
                <div className="flex justify-between"><span className="font-bold">Total Bags Out:</span><span>{summary.totalBagsOut}</span></div>
                <div className="flex justify-between border-t pt-1 mt-1"><span className="font-bold">Balance Stock:</span><span>{summary.balanceStock}</span></div>
            </div>
            {/* Financial Summary */}
            <div className="space-y-1">
                <div className="flex justify-between"><span className="font-bold">Total Hamali:</span><span>{formatCurrency(summary.totalHamali)}</span></div>
                <div className="flex justify-between"><span className="font-bold">Total Rent:</span><span>{formatCurrency(summary.totalRent)}</span></div>
                <div className="flex justify-between"><span className="font-bold">Total Paid:</span><span>({formatCurrency(summary.totalPaid)})</span></div>
                <div className="flex justify-between border-t pt-1 mt-1"><span className="font-bold">Balance Due:</span><span className="font-bold">{formatCurrency(summary.balanceDue)}</span></div>
            </div>
        </div>


        {/* Transaction History */}
        <div>
            <Table className="w-full">
                <TableHeader>
                    <TableRow className="border-b-2 border-black">
                        <TableHead className="text-black font-bold">Date</TableHead>
                        <TableHead className="text-black font-bold">Description</TableHead>
                        <TableHead className="text-black font-bold">Invoice No</TableHead>
                        <TableHead className="text-right text-black font-bold">Unloaded</TableHead>
                        <TableHead className="text-right text-black font-bold">Stored</TableHead>
                        <TableHead className="text-right text-black font-bold">Out</TableHead>
                        <TableHead className="text-right text-black font-bold">Hamali</TableHead>
                        <TableHead className="text-right text-black font-bold">Rent</TableHead>
                        <TableHead className="text-right text-black font-bold">Credit</TableHead>
                        <TableHead className="text-right text-black font-bold">Balance</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {lineItems.map((item, index) => (
                        <TableRow key={index} className="border-0">
                            <TableCell className="py-1">{format(item.date, 'dd/MM/yyyy')}</TableCell>
                            <TableCell className="py-1">{item.description}</TableCell>
                            <TableCell className="py-1">{item.invoiceId}</TableCell>
                            <TableCell className="text-right py-1">{item.bagsUnloaded || ''}</TableCell>
                            <TableCell className="text-right py-1">{item.bagsIn || ''}</TableCell>
                            <TableCell className="text-right py-1">{item.bagsOut || ''}</TableCell>
                            <TableCell className="text-right py-1">{item.hamaliBilled > 0 ? formatCurrency(item.hamaliBilled) : ''}</TableCell>
                            <TableCell className="text-right py-1">{item.rentBilled > 0 ? formatCurrency(item.rentBilled) : ''}</TableCell>
                            <TableCell className="text-right py-1">{item.credit > 0 ? formatCurrency(item.credit) : ''}</TableCell>
                            <TableCell className="text-right py-1">{formatCurrency(item.balance)}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
                 <TableFooter>
                    <TableRow className="border-t-2 border-black">
                        <TableCell colSpan={3} className="text-right font-bold">Totals:</TableCell>
                        <TableCell className="text-right font-bold">{summary.totalBagsUnloaded}</TableCell>
                        <TableCell className="text-right font-bold">{summary.totalBagsIn}</TableCell>
                        <TableCell className="text-right font-bold">{summary.totalBagsOut}</TableCell>
                        <TableCell className="text-right font-bold">{formatCurrency(summary.totalHamali)}</TableCell>
                        <TableCell className="text-right font-bold">{formatCurrency(summary.totalRent)}</TableCell>
                        <TableCell className="text-right font-bold">{formatCurrency(summary.totalPaid)}</TableCell>
                        <TableCell className="text-right font-bold">{formatCurrency(summary.balanceDue)}</TableCell>
                    </TableRow>
                 </TableFooter>
            </Table>
        </div>
        
        {/* Footer */}
        <div className="border-t-2 border-black pt-4 mt-8">
            <div className="flex justify-between items-end">
                <div className="text-left w-1/2">
                    <p className="font-bold">Please pay direct into our bank account</p>
                    <p>SL WAREHOUSE XX-XXXX-XXXXXX-XX</p>
                </div>
                <div className="text-right w-1/2 max-w-sm">
                    <div className="flex justify-between"><span className="font-bold">Customer</span><span>{customer.name}</span></div>
                    <div className="flex justify-between"><span className="font-bold">Account</span><span>{customer.id.substring(0, 10)}</span></div>
                    <div className="flex justify-between"><span className="font-bold">Date</span><span>{generatedDate}</span></div>
                    <div className="flex justify-between mt-2"><span className="font-bold">Total Due</span><span>{formatCurrency(summary.balanceDue)}</span></div>
                    <div className="flex justify-between items-center mt-1"><span className="font-bold">Amount Paid</span><span className="inline-block border-b border-black w-24 h-4 ml-2"></span></div>
                </div>
            </div>

            <div className="flex justify-between items-center mt-8 text-xs">
                <span>{generatedTimestamp}</span>
                <span>Page 1 of 1</span>
            </div>
        </div>

    </div>
  );
});

CustomerStatement.displayName = 'CustomerStatement';
