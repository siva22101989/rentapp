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
        const remainingBags = Math.max(0, (unloading.bagsUnloaded || 0) - (unloading.bagsSentToDrying || 0));
        const remainingHamali = remainingBags * (unloading.hamaliPerBag || 0);

        if (remainingHamali > 0) {
            events.push({
                date: toDate(unloading.unloadingDate),
                description: `Unloading Charges (${remainingBags} truck bags in plot)`,
                invoiceId: unloading.billNo || unloading.id.substring(0, 5),
                bagsReceived: remainingBags,
                bagsDelivered: 0,
                debit: remainingHamali,
                credit: 0,
            });
        }

        (unloading.payments || []).forEach(payment => {
            events.push({
                date: toDate(payment.date),
                description: `Payment Received (Unloading Bill #${unloading.billNo})`,
                invoiceId: unloading.billNo || unloading.id.substring(0, 5),
                bagsReceived: 0,
                bagsDelivered: 0,
                debit: 0,
                credit: payment.amount || 0,
            });
        });
    });

    (records || []).forEach(record => {
        const truckBags = record.bagsForDrying || record.bagsIn;
        const godownBags = record.bagsIn;

        events.push({
            date: toDate(record.storageStartDate),
            description: `Handling/Hamali Charges: ${record.commodityDescription} (${truckBags} truck bags)`,
            invoiceId: record.id,
            bagsReceived: godownBags,
            bagsDelivered: 0,
            debit: record.hamaliPayable || 0,
            credit: 0,
        });
        
        if (record.khataAmount && record.khataAmount > 0) {
             events.push({
                date: toDate(record.storageStartDate),
                description: `Khata (Weighbridge) Charge`,
                invoiceId: record.id,
                bagsReceived: 0,
                bagsDelivered: 0,
                debit: record.khataAmount,
                credit: 0
            });
        }

        if (Array.isArray(record.outflows)) {
            record.outflows.forEach((outflow, index) => {
                const deliveryNo = record.outflows && record.outflows.length > 1 ? `${record.id}-${index + 1}` : record.id;
                events.push({
                    date: toDate(outflow.date),
                    description: `Outflow Rent: ${record.commodityDescription} (${outflow.bagsWithdrawn} bags)`,
                    invoiceId: deliveryNo,
                    bagsReceived: 0,
                    bagsDelivered: outflow.bagsWithdrawn,
                    debit: outflow.rentBilled || 0,
                    credit: 0,
                });
                if (outflow.discount && outflow.discount > 0) {
                    events.push({
                        date: toDate(outflow.date),
                        description: `Discount Applied`,
                        invoiceId: deliveryNo,
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
                description: `Payment Received (Storage ID #${record.id})`,
                invoiceId: record.id,
                bagsReceived: 0,
                bagsDelivered: 0,
                debit: 0,
                credit: payment.amount || 0,
            });
        });
    });
    
    const sortedEvents = events.sort((a, b) => b.date.getTime() - a.date.getTime());

    let runningBagsBalance = 0;
    let runningAmountBalance = 0;
    let totalBagsReceived = 0;
    let totalBagsDelivered = 0;
    let totalDebit = 0;
    let totalCredit = 0;

    const lineItems = [...sortedEvents].reverse().map(event => {
        runningBagsBalance += (event.bagsReceived || 0) - (event.bagsDelivered || 0);
        runningAmountBalance += (event.debit || 0) - (event.credit || 0);
        
        totalBagsReceived += event.bagsReceived || 0;
        totalBagsDelivered += event.bagsDelivered || 0;
        totalDebit += event.debit || 0;
        totalCredit += event.credit || 0;

        return { ...event, balanceBags: runningBagsBalance, balanceAmount: runningAmountBalance };
    }).reverse();
    
    const summary = {
        totalBagsIn: totalBagsReceived,
        totalBagsOut: totalBagsDelivered,
        balanceStock: runningBagsBalance,
        totalDebit: totalDebit,
        totalCredit: totalCredit,
        balanceDue: runningAmountBalance
    };

    return { lineItems, summary };

  }, [records, unloadingRecords]);
  
  const generatedDate = useMemo(() => format(new Date(), 'dd MMM yyyy, hh:mm a'), []);

  return (
    <div ref={ref} className="bg-white p-4 sm:p-6 printable-area text-foreground font-sans text-sm">
        <header className="text-center mb-4">
            <h1 className="text-xl font-bold text-primary">{warehouseInfo?.name || 'Sri Lakshmi Warehouse'}</h1>
            <p className="text-xs text-muted-foreground">{warehouseInfo?.addressLine1 || ''}, {warehouseInfo?.addressLine2 || ''}</p>
        </header>

        <h2 className="text-lg font-semibold mb-4 text-center underline uppercase tracking-tight">STATEMENT OF ACCOUNT</h2>
        
        <div className="flex justify-between items-start mb-4 text-sm">
             <div>
                <p className="text-muted-foreground text-xs uppercase font-bold">To:</p>
                <p className="font-bold text-base">{customer.name}</p>
                <p>{customer.village}</p>
            </div>
            <div className="text-right">
                 <p><span className="font-semibold">Date:</span> {format(new Date(), 'dd/MM/yyyy')}</p>
            </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4 p-4 border rounded-lg bg-secondary/30">
            <div>
                <h3 className="font-bold text-sm mb-2 underline">STOCK STATUS</h3>
                <div className="space-y-1 text-xs">
                    <div className="flex justify-between"><span className="text-muted-foreground">Bags Received:</span><span>{summary.totalBagsIn}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Bags Delivered:</span><span>{summary.totalBagsOut}</span></div>
                    <div className="flex justify-between font-bold border-t pt-1 mt-1"><span>Balance in Stock:</span><span>{summary.balanceStock}</span></div>
                </div>
            </div>
            <div>
                <h3 className="font-bold text-sm mb-2 underline">ACCOUNT SUMMARY</h3>
                <div className="space-y-1 text-xs">
                    <div className="flex justify-between"><span className="text-muted-foreground">Total Billed:</span><span>{formatCurrency(summary.totalDebit)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Total Payments:</span><span>{formatCurrency(summary.totalCredit)}</span></div>
                    <div className="flex justify-between font-bold border-t pt-1 mt-1"><span>Net Balance Due:</span><span className="text-destructive">{formatCurrency(summary.balanceDue)}</span></div>
                </div>
            </div>
        </div>

        <Table className="w-full text-[11px]">
            <TableHeader>
                <TableRow className="border-b-2 border-border bg-muted/50">
                    <TableHead className="p-1.5 font-bold">Date</TableHead>
                    <TableHead className="p-1.5 font-bold">Description</TableHead>
                    <TableHead className="p-1.5 font-bold">Storage ID</TableHead>
                    <TableHead className="p-1.5 text-right font-bold">In</TableHead>
                    <TableHead className="p-1.5 text-right font-bold">Out</TableHead>
                    <TableHead className="p-1.5 text-right font-bold">Balance</TableHead>
                    <TableHead className="p-1.5 text-right font-bold">Debit (+)</TableHead>
                    <TableHead className="p-1.5 text-right font-bold">Credit (-)</TableHead>
                    <TableHead className="p-1.5 text-right font-bold">Due</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {lineItems.map((item, index) => (
                    <TableRow key={index} className="border-b border-border/50">
                        <TableCell className="p-1.5 whitespace-nowrap">{format(item.date, 'dd/MM/yy')}</TableCell>
                        <TableCell className="p-1.5">{item.description}</TableCell>
                        <TableCell className="p-1.5 font-mono">{item.invoiceId}</TableCell>
                        <TableCell className="p-1.5 text-right">{item.bagsReceived || ''}</TableCell>
                        <TableCell className="p-1.5 text-right">{item.bagsDelivered || ''}</TableCell>
                        <TableCell className="p-1.5 text-right font-medium">{item.balanceBags}</TableCell>
                        <TableCell className="p-1.5 text-right font-mono text-destructive">{item.debit > 0 ? formatCurrency(item.debit) : ''}</TableCell>
                        <TableCell className="p-1.5 text-right font-mono text-green-600">{item.credit > 0 ? formatCurrency(item.credit) : ''}</TableCell>
                        <TableCell className="p-1.5 text-right font-mono font-bold">{formatCurrency(item.balanceAmount)}</TableCell>
                    </TableRow>
                ))}
            </TableBody>
             <TableFooter>
                <TableRow className="border-t-2 border-foreground font-bold bg-secondary/20">
                    <TableCell colSpan={3}>CLOSING TOTALS:</TableCell>
                    <TableCell className="text-right">{summary.totalBagsIn}</TableCell>
                    <TableCell className="text-right">{summary.totalBagsOut}</TableCell>
                    <TableCell className="text-right">{summary.balanceStock}</TableCell>
                    <TableCell className="text-right font-mono">{formatCurrency(summary.totalDebit)}</TableCell>
                    <TableCell className="text-right font-mono">{formatCurrency(summary.totalCredit)}</TableCell>
                    <TableCell className="text-right font-mono">{formatCurrency(summary.balanceDue)}</TableCell>
                </TableRow>
             </TableFooter>
        </Table>
        
        <div className="mt-16 pt-8 flex flex-col items-end text-center space-y-2">
            <div className="w-64 border-t border-slate-300 pt-4">
                <p className="text-[#1e293b] font-bold text-sm uppercase tracking-wider">Authorized Manager Signature</p>
                <p className="text-primary font-bold text-xs uppercase mt-1">{warehouseInfo?.name || 'Sri Lakshmi Warehouse'}</p>
            </div>
            <p className="text-[10px] text-slate-400">Report validity verified on {generatedDate}</p>
            <p className="text-[10px] text-slate-400 italic">This is a computer generated statement.</p>
        </div>
    </div>
  );
});

CustomerStatement.displayName = 'CustomerStatement';
