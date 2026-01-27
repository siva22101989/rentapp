'use client';

import { useMemo, forwardRef } from 'react';
import type { Customer, StorageRecord } from '@/lib/definitions';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { formatCurrency, toDate } from '@/lib/utils';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '../ui/table';
import { format } from 'date-fns';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';

type CustomerStatementProps = {
  customer: Customer;
  records: StorageRecord[];
};

export const CustomerStatement = forwardRef<HTMLDivElement, CustomerStatementProps>(({ customer, records }, ref) => {

  const summary = useMemo(() => {
    if (!records || records.length === 0) {
      return {
        totalInflow: 0,
        totalOutflow: 0,
        balanceStock: 0,
        totalBilled: 0,
        totalPaid: 0,
        balanceDue: 0,
      };
    }

    const totalInflow = records.reduce((sum, record) => sum + (record.bagsIn || 0), 0);
    const totalOutflow = records.reduce((sum, record) => sum + (record.bagsOut || 0), 0);
    const balanceStock = records.reduce((sum, record) => sum + record.bagsStored, 0);
    
    const totalBilled = records.reduce((sum, record) => {
        return sum + (record.hamaliPayable || 0) + (record.totalRentBilled || 0);
    }, 0);

    const totalPaid = records.reduce((sum, record) => {
        const paymentsSum = (record.payments || []).reduce((pSum, payment) => pSum + payment.amount, 0);
        return sum + paymentsSum;
    }, 0);

    const balanceDue = totalBilled - totalPaid;

    return { totalInflow, totalOutflow, balanceStock, totalBilled, totalPaid, balanceDue };
  }, [records]);

  const recordsWithBalance = records.map(record => {
    const hamali = record.hamaliPayable || 0;
    const rent = record.totalRentBilled || 0;
    const totalBilled = hamali + rent;
    const amountPaid = (record.payments || []).reduce((acc, p) => acc + p.amount, 0);
    const balanceDue = totalBilled - amountPaid;
    return { ...record, totalBilled, amountPaid, balanceDue };
  }).sort((a, b) => toDate(b.storageStartDate).getTime() - toDate(a.storageStartDate).getTime());
  
  const generatedDate = useMemo(() => format(new Date(), 'dd MMM yyyy, hh:mm a'), []);

  return (
    <div ref={ref} className="bg-white p-6 sm:p-8 rounded-lg printable-area border">
        {/* Header */}
        <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-primary">SRI LAKSHMI WAREHOUSE</h1>
            <p className="text-sm text-muted-foreground">Survey No. 165,237/2, Owk - Koilakuntla Road, OWK - 518 122</p>
             <p className="text-sm text-muted-foreground">Mobile: 9160606633, 9703503423</p>
        </div>

        <Separator className="my-6" />

        {/* Customer Info */}
        <div className="grid grid-cols-2 gap-4 mb-8 text-sm">
            <div>
                <h3 className="font-semibold mb-2 text-muted-foreground">STATEMENT FOR</h3>
                <p className="font-medium text-base">{customer.name}</p>
                {customer.fatherName && <p>S/o {customer.fatherName}</p>}
                <p>{customer.village || customer.address}</p>
                <p>Phone: {customer.phone}</p>
            </div>
            <div className="text-right">
                <h2 className="text-xl font-semibold uppercase text-muted-foreground">Customer Statement</h2>
                <p className="mt-2"><span className="font-medium">Statement Date:</span> {generatedDate}</p>
            </div>
        </div>

        {/* Summary Section */}
        <Card className="mb-8">
            <CardHeader>
                <CardTitle>Account Summary</CardTitle>
            </CardHeader>
            <CardContent>
                 <div className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-4 text-sm">
                     <div className="space-y-1">
                        <div className="text-muted-foreground">Total Inflow</div>
                        <div className="font-bold text-lg">{summary.totalInflow} bags</div>
                    </div>
                    <div className="space-y-1">
                        <div className="text-muted-foreground">Total Outflow</div>
                        <div className="font-bold text-lg">{summary.totalOutflow} bags</div>
                    </div>
                    <div className="space-y-1">
                        <div className="text-muted-foreground">Balance Stock</div>
                        <div className="font-bold text-lg">{summary.balanceStock} bags</div>
                    </div>
                    <div className="space-y-1">
                        <div className="text-muted-foreground">Total Billed</div>
                        <div className="font-bold text-lg">{formatCurrency(summary.totalBilled)}</div>
                    </div>
                    <div className="space-y-1">
                        <div className="text-muted-foreground">Total Paid</div>
                        <div className="font-bold text-lg text-green-600">{formatCurrency(summary.totalPaid)}</div>
                    </div>
                    <div className="space-y-1">
                        <div className="text-muted-foreground">Balance Due</div>
                        <div className="font-bold text-lg text-destructive">{formatCurrency(summary.balanceDue)}</div>
                    </div>
                 </div>
            </CardContent>
        </Card>

        {/* Transaction History */}
        <div className="mb-8">
            <h3 className="text-lg font-semibold mb-4">Transaction History</h3>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Record ID</TableHead>
                        <TableHead>Commodity</TableHead>
                        <TableHead>Dates</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Bags In/Out/Bal</TableHead>
                        <TableHead className="text-right">Billed</TableHead>
                        <TableHead className="text-right">Paid</TableHead>
                        <TableHead className="text-right">Balance</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {recordsWithBalance.map(record => (
                        <TableRow key={record.id}>
                            <TableCell className="font-mono text-xs">{record.id}</TableCell>
                            <TableCell>{record.commodityDescription}</TableCell>
                            <TableCell className="text-xs">
                                <div>In: {format(toDate(record.storageStartDate), 'dd-MM-yy')}</div>
                                <div className="text-muted-foreground">
                                    Out: {record.storageEndDate ? format(toDate(record.storageEndDate), 'dd-MM-yy') : 'Active'}
                                </div>
                            </TableCell>
                            <TableCell>
                                <Badge variant={record.storageEndDate ? "secondary" : "default"} className={record.storageEndDate ? 'bg-zinc-100 text-zinc-800' : 'bg-green-100 text-green-800'}>
                                    {record.storageEndDate ? 'Completed' : 'Active'}
                                </Badge>
                            </TableCell>
                            <TableCell className="text-right font-mono">
                                {record.bagsIn || 0} / {record.bagsOut || 0} / {record.bagsStored}
                            </TableCell>
                            <TableCell className="text-right font-mono">{formatCurrency(record.totalBilled)}</TableCell>
                            <TableCell className="text-right font-mono text-green-600">{formatCurrency(record.amountPaid)}</TableCell>
                            <TableCell className={`text-right font-mono font-bold ${record.balanceDue > 0 ? 'text-destructive' : ''}`}>{formatCurrency(record.balanceDue)}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
                    <TableFooter>
                    <TableRow className="bg-muted/50">
                        <TableCell colSpan={5} className="text-right font-bold text-base">Grand Totals</TableCell>
                        <TableCell className="text-right font-mono font-bold text-base">{formatCurrency(summary.totalBilled)}</TableCell>
                        <TableCell className="text-right font-mono font-bold text-base text-green-600">{formatCurrency(summary.totalPaid)}</TableCell>
                        <TableCell className="text-right font-mono font-bold text-base text-destructive">{formatCurrency(summary.balanceDue)}</TableCell>
                    </TableRow>
                </TableFooter>
            </Table>
        </div>

        {/* Footer */}
        <div className="mt-20 pt-10 flex justify-between text-center text-sm print-show">
            <div className="w-1/2">
                <div className="border-t border-gray-400 mx-4 pt-2">Manager Signature</div>
            </div>
            <div className="w-1/2">
                    <div className="border-t border-gray-400 mx-4 pt-2">Customer Signature</div>
            </div>
        </div>

        <p className="text-xs text-muted-foreground text-center mt-8">This is a computer-generated document.</p>
    </div>
  );
});

CustomerStatement.displayName = 'CustomerStatement';
