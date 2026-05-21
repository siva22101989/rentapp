
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
            });
        });
    });

    (records || []).forEach(record => {
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
        });
        
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
            });
        }

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
                });
            });
        }

        (record.payments || []).forEach((payment, pIdx) => {
            events.push({
                date: toDate(payment.date),
                description: payment.type === 'discount' ? `Discount` : `Payment`,
                billNo: record.id,
                bagsIn: 0,
                bagsOut: 0,
                hamali: 0,
                rent: 0,
                credit: payment.amount || 0,
                sortDate: toDate(payment.date).getTime() + 5 + pIdx,
            });
        });
    });
    
    const sortedEvents = events.sort((a, b) => a.sortDate - b.sortDate);

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

        return { ...event, balance: runningBalance };
    });
    
    return { lineItems, totals: { totalBagsIn, totalBagsOut, balanceStock: totalBagsIn - totalBagsOut, totalHamali, totalRent, totalCredit, finalBalance: runningBalance } };
  }, [records, unloadingRecords]);
  
  const timestamp = useMemo(() => format(new Date(), 'dd/MM/yy, h:mm a'), []);

  return (
    <div ref={ref} className="bg-white p-4 sm:p-6 text-black font-sans text-sm printable-area">
        <div className="text-center mb-6 border-b-2 border-black pb-2">
            <h1 className="text-xl font-bold uppercase">{warehouseInfo?.name || "SRI LAKSHMI WAREHOUSE"}</h1>
            <p className="text-[10px] uppercase">{warehouseInfo?.addressLine1} {warehouseInfo?.addressLine2} | Cell: {warehouseInfo?.phone}</p>
            <h2 className="text-md font-bold underline mt-2 uppercase">Statement of Account</h2>
        </div>

        <div className="flex flex-col sm:flex-row justify-between mb-4 gap-1 text-[13px]">
            <div>
                <p><span className="font-bold">Depositor:</span> {customer?.name}</p>
                <p><span className="font-bold">Village:</span> {customer?.village || 'N/A'}</p>
            </div>
            <div className="sm:text-right text-[11px] text-slate-500">
                <p>Date: {timestamp}</p>
            </div>
        </div>

        <div className="table-scroll-container border-y-2 border-black">
            <Table className="w-full text-[13px]">
                <TableHeader>
                    <TableRow className="border-b border-black">
                        <TableHead className="font-bold text-black border-r border-slate-200 text-center p-1">Date</TableHead>
                        <TableHead className="font-bold text-black border-r border-slate-200 p-1">Description</TableHead>
                        <TableHead className="font-bold text-black border-r border-slate-200 text-center p-1">In</TableHead>
                        <TableHead className="font-bold text-black border-r border-slate-200 text-center p-1">Out</TableHead>
                        <TableHead className="font-bold text-black border-r border-slate-200 text-right p-1">Charges</TableHead>
                        <TableHead className="font-bold text-black border-r border-slate-200 text-right p-1">Paid</TableHead>
                        <TableHead className="font-bold text-black text-right p-1">Balance</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {lineItems.map((item, index) => (
                        <TableRow key={index} className="border-b border-slate-100 h-7">
                            <TableCell className="p-1 text-center whitespace-nowrap">{format(item.date, 'dd/MM/yy')}</TableCell>
                            <TableCell className="p-1">{item.description}</TableCell>
                            <TableCell className="p-1 text-center font-mono">{item.bagsIn || ''}</TableCell>
                            <TableCell className="p-1 text-center font-mono">{item.bagsOut || ''}</TableCell>
                            <TableCell className="p-1 text-right font-mono">{(item.hamali || 0) + (item.rent || 0) > 0 ? formatCurrency((item.hamali || 0) + (item.rent || 0)) : ''}</TableCell>
                            <TableCell className="p-1 text-right font-mono text-green-700">{item.credit > 0 ? formatCurrency(item.credit) : ''}</TableCell>
                            <TableCell className="p-1 text-right font-mono font-bold">{formatCurrency(item.balance)}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
                <TableFooter>
                    <TableRow className="bg-slate-50 font-bold border-t-2 border-black">
                        <TableCell colSpan={2} className="p-1 text-right uppercase text-[11px]">Total Ledger Summary</TableCell>
                        <TableCell className="p-1 text-center font-mono">{totals.totalBagsIn}</TableCell>
                        <TableCell className="p-1 text-center font-mono">{totals.totalBagsOut}</TableCell>
                        <TableCell className="p-1 text-right font-mono">{formatCurrency(totals.totalHamali + totals.totalRent)}</TableCell>
                        <TableCell className="p-1 text-right font-mono text-green-700">{formatCurrency(totals.totalCredit)}</TableCell>
                        <TableCell className="p-1 text-right font-mono text-[14px]">{formatCurrency(totals.finalBalance)}</TableCell>
                    </TableRow>
                </TableFooter>
            </Table>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4 text-[13px] border p-2 bg-slate-50 rounded">
            <div className="space-y-1">
                <div className="flex justify-between"><span>Current Stock:</span><span className="font-bold">{totals.balanceStock} bags</span></div>
                <div className="flex justify-between"><span>Total Inflow:</span><span className="font-mono">{totals.totalBagsIn}</span></div>
            </div>
            <div className="space-y-1 border-l pl-4">
                <div className="flex justify-between text-destructive"><span>Balance Due:</span><span className="font-bold">{formatCurrency(totals.finalBalance)}</span></div>
                <div className="flex justify-between text-green-700"><span>Total Paid:</span><span className="font-mono">{formatCurrency(totals.totalCredit)}</span></div>
            </div>
        </div>

        <div className="mt-16 flex justify-end">
            <div className="w-64 border-t border-black text-center pt-1">
                <p className="font-bold text-[12px] uppercase">Manager Signature</p>
            </div>
        </div>
    </div>
  );
});

CustomerStatement.displayName = 'CustomerStatement';
