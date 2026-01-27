
'use client';

import { useMemo, forwardRef } from 'react';
import type { Customer, StorageRecord } from '@/lib/definitions';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { formatCurrency, toDate } from '@/lib/utils';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '../ui/table';
import { ArrowDown, ArrowUp, Banknote, CreditCard, Scale, Warehouse } from 'lucide-react';
import { format } from 'date-fns';
import { Badge } from '../ui/badge';

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

  return (
    <div ref={ref} className="bg-white p-4 rounded-lg printable-area">
        <div className="mb-6 text-center">
            <h2 className="text-2xl font-bold">Customer Statement</h2>
            <p className="text-xl font-medium text-primary">{customer.name}</p>
            <p className="text-sm text-muted-foreground">{customer.address} | {customer.phone}</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-6">
             <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Inflow</CardTitle>
                    <ArrowDown className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent><div className="text-2xl font-bold">{summary.totalInflow} bags</div></CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Outflow</CardTitle>
                    <ArrowUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent><div className="text-2xl font-bold">{summary.totalOutflow} bags</div></CardContent>
            </Card>
             <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Balance Stock</CardTitle>
                    <Warehouse className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent><div className="text-2xl font-bold">{summary.balanceStock} bags</div></CardContent>
            </Card>
             <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Billed</CardTitle>
                    <CreditCard className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent><div className="text-2xl font-bold">{formatCurrency(summary.totalBilled)}</div></CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Paid</CardTitle>
                    <Banknote className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent><div className="text-2xl font-bold text-green-600">{formatCurrency(summary.totalPaid)}</div></CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Balance Due</CardTitle>
                    <Scale className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent><div className="text-2xl font-bold text-destructive">{formatCurrency(summary.balanceDue)}</div></CardContent>
            </Card>
        </div>
        
        <Card>
            <CardHeader>
                <CardTitle>Transaction History</CardTitle>
            </CardHeader>
            <CardContent>
                 <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Record ID</TableHead>
                            <TableHead>Commodity</TableHead>
                            <TableHead>Dates</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Bags In/Out</TableHead>
                            <TableHead className="text-right">Billed</TableHead>
                            <TableHead className="text-right">Paid</TableHead>
                            <TableHead className="text-right">Balance</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {recordsWithBalance.map(record => (
                            <TableRow key={record.id}>
                                <TableCell className="font-mono">{record.id}</TableCell>
                                <TableCell>{record.commodityDescription}</TableCell>
                                <TableCell>
                                    <div className="flex flex-col">
                                        <span>In: {format(toDate(record.storageStartDate), 'dd MMM yyyy')}</span>
                                        <span className="text-muted-foreground">
                                            Out: {record.storageEndDate ? format(toDate(record.storageEndDate), 'dd MMM yyyy') : 'Active'}
                                        </span>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <Badge variant={record.storageEndDate ? 'secondary' : 'default'} className={record.storageEndDate ? 'bg-zinc-100 text-zinc-800' : 'bg-green-100 text-green-800'}>
                                        {record.storageEndDate ? 'Completed' : 'Active'}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="flex flex-col items-end">
                                        <span>{record.bagsIn || 0} / {record.bagsOut || 0}</span>
                                        <span className="font-bold">{record.bagsStored}</span>
                                    </div>
                                </TableCell>
                                <TableCell className="text-right font-mono">{formatCurrency(record.totalBilled)}</TableCell>
                                <TableCell className="text-right font-mono text-green-600">{formatCurrency(record.amountPaid)}</TableCell>
                                <TableCell className={`text-right font-mono font-bold ${record.balanceDue > 0 ? 'text-destructive' : ''}`}>{formatCurrency(record.balanceDue)}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                     <TableFooter>
                        <TableRow>
                            <TableCell colSpan={5} className="text-right font-bold text-lg">Grand Totals</TableCell>
                            <TableCell className="text-right font-mono font-bold text-lg">{formatCurrency(summary.totalBilled)}</TableCell>
                            <TableCell className="text-right font-mono font-bold text-lg text-green-600">{formatCurrency(summary.totalPaid)}</TableCell>
                            <TableCell className="text-right font-mono font-bold text-lg text-destructive">{formatCurrency(summary.balanceDue)}</TableCell>
                        </TableRow>
                    </TableFooter>
                </Table>
            </CardContent>
        </Card>
    </div>
  );
});

CustomerStatement.displayName = 'CustomerStatement';
