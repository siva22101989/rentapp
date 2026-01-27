'use client';

import { useMemo, forwardRef } from 'react';
import type { Customer, StorageRecord } from '@/lib/definitions';
import { formatCurrency, toDate } from '@/lib/utils';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '../ui/table';
import { format } from 'date-fns';
import { Separator } from '../ui/separator';

type CustomerStatementProps = {
  customer: Customer;
  records: StorageRecord[];
};

export const CustomerStatement = forwardRef<HTMLDivElement, CustomerStatementProps>(({ customer, records }, ref) => {

  const summary = useMemo(() => {
    let totalBilled = 0;
    let totalPaid = 0;

    for (const record of records) {
        const billed = (record.hamaliPayable || 0) + (record.totalRentBilled || 0);
        const paid = (record.payments || []).reduce((pSum, payment) => pSum + payment.amount, 0);
        totalBilled += billed;
        totalPaid += paid;
    }

    const balanceDue = totalBilled - totalPaid;

    return { totalBilled, totalPaid, balanceDue };
  }, [records]);

  const recordsWithBalance = records.map(record => {
    const hamali = record.hamaliPayable || 0;
    const rent = record.totalRentBilled || 0;
    const totalBilled = hamali + rent;
    const amountPaid = (record.payments || []).reduce((acc, p) => acc + p.amount, 0);
    const balanceDue = totalBilled - amountPaid;
    return { ...record, totalBilled, amountPaid, balanceDue };
  }).sort((a, b) => toDate(a.storageStartDate).getTime() - toDate(b.storageStartDate).getTime());
  
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

        {/* Transaction History */}
        <div>
            <Table className="w-full">
                <TableHeader>
                    <TableRow className="border-b-2 border-black">
                        <TableHead className="text-black font-bold">Date</TableHead>
                        <TableHead className="text-black font-bold">Invoice No</TableHead>
                        <TableHead className="text-right text-black font-bold">Original Amount</TableHead>
                        <TableHead className="text-right text-black font-bold">Already Paid</TableHead>
                        <TableHead className="text-right text-black font-bold">Still Due</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {recordsWithBalance.map(record => (
                        <TableRow key={record.id} className="border-0">
                            <TableCell className="py-1">{format(toDate(record.storageStartDate), 'dd/MM/yyyy')}</TableCell>
                            <TableCell className="py-1">{record.id}</TableCell>
                            <TableCell className="text-right py-1">{formatCurrency(record.totalBilled)}</TableCell>
                            <TableCell className="text-right py-1">{formatCurrency(record.amountPaid)}</TableCell>
                            <TableCell className="text-right py-1">{formatCurrency(record.balanceDue)}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>

        <Separator className="my-4 border-b-2 border-black" />

        {/* Aging Summary - Simplified */}
        <div className="flex justify-end mb-8">
            <div className="w-1/3">
                 <div className="flex justify-between font-bold">
                    <span>Total Due</span>
                    <span>{formatCurrency(summary.balanceDue)}</span>
                 </div>
            </div>
        </div>
        
        {/* Footer */}
        <div className="border-t-2 border-black pt-4">
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
