'use client';

import { useMemo, forwardRef } from 'react';
import type { Customer, StorageRecord } from '@/lib/definitions';
import { formatCurrency, toDate } from '@/lib/utils';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '../ui/table';
import { format } from 'date-fns';

type CustomerStatementProps = {
  customer: Customer;
  records: StorageRecord[];
};

export const CustomerStatement = forwardRef<HTMLDivElement, CustomerStatementProps>(({ customer, records }, ref) => {

  const { lineItems, summary } = useMemo(() => {
    const events: any[] = [];
    
    records.forEach(record => {
        // Inflow
        events.push({
            date: toDate(record.storageStartDate),
            description: `Inflow: ${record.commodityDescription}`,
            invoiceId: record.id,
            bagsIn: record.bagsIn || 0,
            bagsOut: 0,
            debit: record.hamaliPayable || 0,
            credit: 0
        });

        // Outflows from the new model
        const recordOutflows = record.outflows || [];
        recordOutflows.forEach(outflow => {
            events.push({
                date: toDate(outflow.date),
                description: `Outflow`,
                invoiceId: record.id,
                bagsIn: 0,
                bagsOut: outflow.bagsWithdrawn,
                debit: outflow.rentBilled || 0,
                credit: 0,
            });
        });

        // Legacy Outflow (for records without the new outflows array)
        if (recordOutflows.length === 0 && (record.bagsOut || 0) > 0 && record.storageEndDate) {
            events.push({
                date: toDate(record.storageEndDate),
                description: `Outflow (Completed Record)`,
                invoiceId: record.id,
                bagsIn: 0,
                bagsOut: record.bagsOut,
                debit: record.totalRentBilled || 0,
                credit: 0,
            });
        }

        // Payments
        (record.payments || []).forEach(payment => {
            events.push({
                date: toDate(payment.date),
                description: `Payment Received (${payment.type || 'other'})`,
                invoiceId: record.id,
                bagsIn: 0,
                bagsOut: 0,
                debit: 0,
                credit: payment.amount || 0,
            });
        });
    });

    const sortedEvents = events.sort((a, b) => a.date.getTime() - b.date.getTime());

    let runningBalance = 0;
    let totalBagsIn = 0;
    let totalBagsOut = 0;
    let totalDebit = 0;
    let totalCredit = 0;

    const lineItems = sortedEvents.map(event => {
        runningBalance += event.debit - event.credit;
        totalBagsIn += event.bagsIn;
        totalBagsOut += event.bagsOut;
        totalDebit += event.debit;
        totalCredit += event.credit;
        return {
            ...event,
            balance: runningBalance
        };
    });

    const summary = {
        totalBagsIn,
        totalBagsOut,
        balanceStock: totalBagsIn - totalBagsOut,
        totalBilled: totalDebit,
        totalPaid: totalCredit,
        balanceDue: runningBalance
    };

    return { lineItems, summary };

  }, [records]);
  
  const generatedDate = useMemo(() => format(new Date(), 'dd/MM/yyyy'), []);
  const generatedTimestamp = useMemo(() => format(new Date(), 'dd/MM/yyyy HH:mm:ss'), []);

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
        <div className="grid grid-cols-4 gap-x-4 gap-y-2 mb-6 p-4 border rounded-lg">
            <div className="font-bold">Total Bags In:</div>
            <div>{summary.totalBagsIn}</div>
            <div className="font-bold">Total Billed:</div>
            <div className="text-right">{formatCurrency(summary.totalBilled)}</div>

            <div className="font-bold">Total Bags Out:</div>
            <div>{summary.totalBagsOut}</div>
            <div className="font-bold">Total Paid:</div>
            <div className="text-right">{formatCurrency(summary.totalPaid)}</div>

            <div className="font-bold">Balance Stock:</div>
            <div>{summary.balanceStock}</div>
            <div className="font-bold border-t pt-2">Balance Due:</div>
            <div className="text-right font-bold border-t pt-2">{formatCurrency(summary.balanceDue)}</div>
        </div>

        {/* Transaction History */}
        <div>
            <Table className="w-full">
                <TableHeader>
                    <TableRow className="border-b-2 border-black">
                        <TableHead className="text-black font-bold">Date</TableHead>
                        <TableHead className="text-black font-bold">Description</TableHead>
                        <TableHead className="text-black font-bold">Invoice No</TableHead>
                        <TableHead className="text-right text-black font-bold">Bags In</TableHead>
                        <TableHead className="text-right text-black font-bold">Bags Out</TableHead>
                        <TableHead className="text-right text-black font-bold">Debit</TableHead>
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
                            <TableCell className="text-right py-1">{item.bagsIn || ''}</TableCell>
                            <TableCell className="text-right py-1">{item.bagsOut || ''}</TableCell>
                            <TableCell className="text-right py-1">{item.debit > 0 ? formatCurrency(item.debit) : ''}</TableCell>
                            <TableCell className="text-right py-1">{item.credit > 0 ? formatCurrency(item.credit) : ''}</TableCell>
                            <TableCell className="text-right py-1">{formatCurrency(item.balance)}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
                 <TableFooter>
                    <TableRow className="border-t-2 border-black">
                        <TableCell colSpan={5} className="text-right font-bold">Totals:</TableCell>
                        <TableCell className="text-right font-bold">{formatCurrency(summary.totalBilled)}</TableCell>
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
