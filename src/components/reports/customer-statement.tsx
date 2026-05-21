'use client';

import { useMemo, forwardRef } from 'react';
import type { Customer, StorageRecord, UnloadingRecord, WarehouseInfo } from '@/lib/definitions';
import { formatCurrency, toDate } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '../ui/table';
import { format } from 'date-fns';

type CustomerStatementProps = {
  customer: Customer;
  records: StorageRecord[];
  unloadingRecords: UnloadingRecord[];
  warehouseInfo: WarehouseInfo | null;
};

export const CustomerStatement = forwardRef<HTMLDivElement, CustomerStatementProps>(({ customer, records, unloadingRecords, warehouseInfo }, ref) => {

  const { lineItems, totals } = useMemo(() => {
    const events: any[] = [];
    
    // 1. Process Unloading Records (Charges and Payments)
    (unloadingRecords || []).forEach(unloading => {
        const totalHamali = unloading.totalHamali || 0;
        if (totalHamali > 0) {
            events.push({
                date: toDate(unloading.unloadingDate),
                description: `Inflow - ${unloading.commodityDescription}`,
                billNo: unloading.billNo || unloading.id,
                bagsIn: unloading.bagsUnloaded,
                bagsOut: 0,
                hamali: totalHamali,
                rent: 0,
                credit: 0,
                sortDate: toDate(unloading.unloadingDate).getTime(),
                type: 'INFLOW_UNLOADING'
            });
        }

        (unloading.payments || []).forEach((payment, pIdx) => {
            events.push({
                date: toDate(payment.date),
                description: `Payment Received`,
                billNo: unloading.billNo || unloading.id,
                bagsIn: 0,
                bagsOut: 0,
                hamali: 0,
                rent: 0,
                credit: payment.amount || 0,
                sortDate: toDate(payment.date).getTime() + pIdx,
                type: 'PAYMENT'
            });
        });
    });

    // 2. Process Storage Records (Inflow, Outflow, Payments, Khata)
    (records || []).forEach(record => {
        // Record the Inflow
        events.push({
            date: toDate(record.storageStartDate),
            description: `Inflow - ${record.commodityDescription}`,
            billNo: record.id,
            bagsIn: record.bagsIn,
            bagsOut: 0,
            hamali: record.hamaliPayable || 0,
            rent: 0,
            credit: 0,
            sortDate: toDate(record.storageStartDate).getTime(),
            type: 'INFLOW_STORAGE'
        });
        
        // Khata amount if any
        if (record.khataAmount && record.khataAmount > 0) {
            events.push({
                date: toDate(record.storageStartDate),
                description: `Khata Income`,
                billNo: record.id,
                bagsIn: 0,
                bagsOut: 0,
                hamali: record.khataAmount,
                rent: 0,
                credit: 0,
                sortDate: toDate(record.storageStartDate).getTime() + 2,
                type: 'OTHER_CHARGE'
            });
        }

        // Outflows
        if (Array.isArray(record.outflows)) {
            record.outflows.forEach((outflow, idx) => {
                events.push({
                    date: toDate(outflow.date),
                    description: `Outflow`,
                    billNo: record.id, 
                    bagsIn: 0,
                    bagsOut: outflow.bagsWithdrawn,
                    hamali: 0,
                    rent: outflow.rentBilled || 0,
                    credit: 0,
                    sortDate: toDate(outflow.date).getTime() + 3,
                    type: 'OUTFLOW'
                });

                if (outflow.discount && outflow.discount > 0) {
                    events.push({
                        date: toDate(outflow.date),
                        description: `Discount Applied`,
                        billNo: record.id,
                        bagsIn: 0,
                        bagsOut: 0,
                        hamali: 0,
                        rent: 0,
                        credit: outflow.discount,
                        sortDate: toDate(outflow.date).getTime() + 4,
                        type: 'DISCOUNT'
                    });
                }
            });
        }

        // Payments directly on the record
        (record.payments || []).forEach((payment, pIdx) => {
            events.push({
                date: toDate(payment.date),
                description: payment.type === 'discount' ? `Discount Applied` : `Payment Received`,
                billNo: record.id,
                bagsIn: 0,
                bagsOut: 0,
                hamali: 0,
                rent: 0,
                credit: payment.amount || 0,
                sortDate: toDate(payment.date).getTime() + 5 + pIdx,
                type: 'PAYMENT'
            });
        });
    });
    
    // Sort all events by date
    const sortedEvents = events.sort((a, b) => a.sortDate - b.sortDate);

    // Calculate running balance and totals
    let runningBalance = 0;
    let totalBagsIn = 0;
    let totalBagsOut = 0;
    let totalHamali = 0;
    let totalRent = 0;
    let totalCredit = 0;

    const lineItems = sortedEvents.map(event => {
        const debit = (event.hamali || 0) + (event.rent || 0);
        const credit = event.credit || 0;
        runningBalance += (debit - credit);
        
        totalBagsIn += (event.bagsIn || 0);
        totalBagsOut += (event.bagsOut || 0);
        totalHamali += (event.hamali || 0);
        totalRent += (event.rent || 0);
        totalCredit += credit;

        return {
            ...event,
            balance: runningBalance
        };
    });
    
    return {
        lineItems,
        totals: {
            totalBagsIn,
            totalBagsOut,
            balanceStock: totalBagsIn - totalBagsOut,
            totalHamali,
            totalRent,
            totalCredit,
            finalBalance: runningBalance
        }
    };
  }, [records, unloadingRecords]);
  
  const timestamp = useMemo(() => format(new Date(), 'dd/MM/yyyy, h:mm a'), []);

  return (
    <div ref={ref} className="bg-white p-4 sm:p-8 printable-area text-slate-900 font-sans">
        <div className="text-center mb-6 border-b pb-4">
            <h1 className="text-2xl font-bold uppercase">{warehouseInfo?.name || "SRI LAKSHMI WAREHOUSE"}</h1>
            <p className="text-xs text-slate-500">
                {warehouseInfo?.addressLine1} {warehouseInfo?.addressLine2} | Cell: {warehouseInfo?.phone}
            </p>
            <h2 className="text-lg font-bold underline mt-4 uppercase tracking-widest">Statement of Account</h2>
        </div>

        <div className="flex flex-col sm:flex-row justify-between mb-6 gap-4 text-[14px]">
            <div className="space-y-0.5">
                <p><span className="font-bold">Customer:</span> {customer?.name}</p>
                <p><span className="font-bold">Village:</span> {customer?.village || 'N/A'}</p>
                <p><span className="font-bold">Phone:</span> {customer?.phone}</p>
            </div>
            <div className="sm:text-right text-xs text-slate-500">
                <p>Generated: {timestamp}</p>
            </div>
        </div>

        <div className="border border-slate-900 rounded overflow-hidden">
            <Table className="w-full text-[13px]">
                <TableHeader>
                    <TableRow className="bg-slate-50 border-b border-slate-900">
                        <TableHead className="font-bold text-black border-r border-slate-300 text-center p-1">Date</TableHead>
                        <TableHead className="font-bold text-black border-r border-slate-300 p-1">Description</TableHead>
                        <TableHead className="font-bold text-black border-r border-slate-300 text-center p-1">Ref</TableHead>
                        <TableHead className="font-bold text-black border-r border-slate-300 text-center p-1">In</TableHead>
                        <TableHead className="font-bold text-black border-r border-slate-300 text-center p-1">Out</TableHead>
                        <TableHead className="font-bold text-black border-r border-slate-300 text-right p-1">Charges</TableHead>
                        <TableHead className="font-bold text-black border-r border-slate-300 text-right p-1">Paid</TableHead>
                        <TableHead className="font-bold text-black text-right bg-slate-100 p-1">Balance</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {lineItems.map((item, index) => {
                        const debit = (item.hamali || 0) + (item.rent || 0);
                        return (
                        <TableRow key={index} className="border-b border-slate-200 h-7">
                            <TableCell className="p-1 text-center whitespace-nowrap">{format(item.date, 'dd/MM/yy')}</TableCell>
                            <TableCell className="p-1">{item.description}</TableCell>
                            <TableCell className="p-1 text-center font-mono text-slate-400">{item.billNo}</TableCell>
                            <TableCell className="p-1 text-center font-mono">{item.bagsIn || ''}</TableCell>
                            <TableCell className="p-1 text-center font-mono">{item.bagsOut || ''}</TableCell>
                            <TableCell className="p-1 text-right font-mono">{debit > 0 ? formatCurrency(debit) : ''}</TableCell>
                            <TableCell className="p-1 text-right font-mono text-green-600 font-bold">{item.credit > 0 ? formatCurrency(item.credit) : ''}</TableCell>
                            <TableCell className="p-1 text-right font-mono font-bold bg-slate-50/50">{formatCurrency(item.balance)}</TableCell>
                        </TableRow>
                    )})}
                    {lineItems.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={8} className="py-12 text-center text-slate-400 italic">No transactions found.</TableCell>
                        </TableRow>
                    )}
                </TableBody>
                <TableFooter>
                    <TableRow className="bg-slate-50 border-t border-slate-900 font-bold">
                        <TableCell colSpan={3} className="p-2 text-right uppercase text-[10px]">Summary</TableCell>
                        <TableCell className="p-2 text-center font-mono">{totals.totalBagsIn}</TableCell>
                        <TableCell className="p-2 text-center font-mono">{totals.totalBagsOut}</TableCell>
                        <TableCell className="p-2 text-right font-mono">{formatCurrency(totals.totalHamali + totals.totalRent)}</TableCell>
                        <TableCell className="p-2 text-right font-mono text-green-700">{formatCurrency(totals.totalCredit)}</TableCell>
                        <TableCell className="p-2 text-right font-mono text-[15px] bg-slate-900 text-white">{formatCurrency(totals.finalBalance)}</TableCell>
                    </TableRow>
                </TableFooter>
            </Table>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-8 text-[14px]">
            <div className="border p-4 rounded bg-slate-50">
                <h4 className="font-bold border-b mb-2 pb-1 uppercase text-xs">Stock Summary</h4>
                <div className="flex justify-between"><span>Bags In:</span><span className="font-mono">{totals.totalBagsIn}</span></div>
                <div className="flex justify-between"><span>Bags Out:</span><span className="font-mono">{totals.totalBagsOut}</span></div>
                <div className="flex justify-between border-t mt-1 pt-1 font-bold text-primary"><span>Current Godown Stock:</span><span className="font-mono">{totals.balanceStock}</span></div>
            </div>
            <div className="border p-4 rounded bg-slate-50">
                <h4 className="font-bold border-b mb-2 pb-1 uppercase text-xs">Financial Summary</h4>
                <div className="flex justify-between"><span>Total Billed:</span><span className="font-mono">{formatCurrency(totals.totalHamali + totals.totalRent)}</span></div>
                <div className="flex justify-between text-green-600"><span>Total Paid:</span><span className="font-mono">{formatCurrency(totals.totalCredit)}</span></div>
                <div className="flex justify-between border-t mt-1 pt-1 font-bold text-destructive"><span>Balance Due:</span><span className="font-mono">{formatCurrency(totals.finalBalance)}</span></div>
            </div>
        </div>

        <div className="mt-20 flex justify-between items-end border-t pt-4 border-slate-200">
            <div className="text-[10px] text-slate-400 italic">
                <p>This is a computer generated ledger.</p>
            </div>
            <div className="text-center min-w-[200px]">
                <div className="h-[1px] bg-slate-400 mb-2"></div>
                <p className="font-bold text-xs uppercase">Authorized Signature</p>
                <p className="text-[10px] text-slate-500">SRI LAKSHMI WAREHOUSE</p>
            </div>
        </div>
    </div>
  );
});

CustomerStatement.displayName = 'CustomerStatement';