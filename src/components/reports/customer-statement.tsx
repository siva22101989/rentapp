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
    <div ref={ref} className="bg-white p-8 printable-area text-slate-800 font-sans">
        {/* Header Section */}
        <div className="text-center mb-8 border-b-2 border-black pb-6">
            <h1 className="text-3xl font-bold uppercase tracking-tight">{warehouseInfo?.name || "SRI LAKSHMI WAREHOUSE"}</h1>
            <p className="text-sm text-slate-500 mt-1">
                {warehouseInfo?.addressLine1} {warehouseInfo?.addressLine2}
            </p>
            <p className="text-sm font-semibold mt-1">Cell: {warehouseInfo?.phone}</p>
            <h2 className="text-xl font-bold underline mt-6 uppercase tracking-widest">Statement of Account</h2>
        </div>

        {/* Customer Information */}
        <div className="grid grid-cols-2 gap-8 mb-8">
            <div className="space-y-1">
                <p><span className="font-bold inline-block w-32 uppercase text-xs text-slate-500">Customer Name:</span> <span className="font-bold text-lg">{customer?.name}</span></p>
                <p><span className="font-bold inline-block w-32 uppercase text-xs text-slate-500">Father's Name:</span> {customer?.fatherName || 'N/A'}</p>
                <p><span className="font-bold inline-block w-32 uppercase text-xs text-slate-500">Village/Town:</span> {customer?.village || 'N/A'}</p>
                <p><span className="font-bold inline-block w-32 uppercase text-xs text-slate-500">Phone No:</span> {customer?.phone}</p>
            </div>
            <div className="flex flex-col items-end justify-end space-y-1">
                <p className="text-xs text-slate-400">Statement Generated On</p>
                <p className="font-mono font-bold text-sm bg-slate-100 px-3 py-1 rounded">{timestamp}</p>
            </div>
        </div>

        {/* Account Table */}
        <div className="border-2 border-black rounded-lg overflow-hidden">
            <Table className="w-full text-[14px]">
                <TableHeader>
                    <TableRow className="bg-slate-50 border-b-2 border-black">
                        <TableHead className="font-bold text-black border-r border-slate-300 text-center">Date</TableHead>
                        <TableHead className="font-bold text-black border-r border-slate-300">Description</TableHead>
                        <TableHead className="font-bold text-black border-r border-slate-300 text-center">Ref ID</TableHead>
                        <TableHead className="font-bold text-black border-r border-slate-300 text-center">Bags In</TableHead>
                        <TableHead className="font-bold text-black border-r border-slate-300 text-center">Bags Out</TableHead>
                        <TableHead className="font-bold text-black border-r border-slate-300 text-right">Hamali</TableHead>
                        <TableHead className="font-bold text-black border-r border-slate-300 text-right">Rent</TableHead>
                        <TableHead className="font-bold text-black border-r border-slate-300 text-right">Credit</TableHead>
                        <TableHead className="font-bold text-black text-right bg-slate-100">Balance</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {lineItems.map((item, index) => (
                        <TableRow key={index} className="border-b border-slate-200 hover:bg-slate-50/50">
                            <TableCell className="p-2 text-center whitespace-nowrap text-slate-500">{format(item.date, 'dd/MM/yy')}</TableCell>
                            <TableCell className="p-2 font-medium">{item.description}</TableCell>
                            <TableCell className="p-2 text-center font-mono text-slate-400">{item.billNo}</TableCell>
                            <TableCell className="p-2 text-center font-mono text-blue-600">{item.bagsIn || ''}</TableCell>
                            <TableCell className="p-2 text-center font-mono text-orange-600">{item.bagsOut || ''}</TableCell>
                            <TableCell className="p-2 text-right font-mono">{item.hamali > 0 ? formatCurrency(item.hamali) : ''}</TableCell>
                            <TableCell className="p-2 text-right font-mono">{item.rent > 0 ? formatCurrency(item.rent) : ''}</TableCell>
                            <TableCell className="p-2 text-right font-mono text-green-600 font-bold">{item.credit > 0 ? formatCurrency(item.credit) : ''}</TableCell>
                            <TableCell className="p-2 text-right font-mono font-bold bg-slate-50/50">{formatCurrency(item.balance)}</TableCell>
                        </TableRow>
                    ))}
                    {lineItems.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={9} className="py-20 text-center text-slate-400 italic font-medium">No transactions found for this account.</TableCell>
                        </TableRow>
                    )}
                </TableBody>
                <TableFooter>
                    <TableRow className="bg-slate-50 border-t-2 border-black font-bold">
                        <TableCell colSpan={3} className="p-3 text-right uppercase text-xs tracking-wider">Total Summaries</TableCell>
                        <TableCell className="p-3 text-center font-mono text-blue-700">{totals.totalBagsIn}</TableCell>
                        <TableCell className="p-3 text-center font-mono text-orange-700">{totals.totalBagsOut}</TableCell>
                        <TableCell className="p-3 text-right font-mono">{formatCurrency(totals.totalHamali)}</TableCell>
                        <TableCell className="p-3 text-right font-mono">{formatCurrency(totals.totalRent)}</TableCell>
                        <TableCell className="p-3 text-right font-mono text-green-700">{formatCurrency(totals.totalCredit)}</TableCell>
                        <TableCell className="p-3 text-right font-mono text-lg bg-slate-900 text-white">{formatCurrency(totals.finalBalance)}</TableCell>
                    </TableRow>
                </TableFooter>
            </Table>
        </div>

        {/* Footer Metrics */}
        <div className="mt-8 grid grid-cols-2 gap-12">
            <div className="space-y-2">
                <h4 className="font-bold text-xs uppercase text-slate-400 tracking-widest border-b pb-1">Inventory Metrics</h4>
                <div className="flex justify-between items-center py-1">
                    <span className="text-sm">Bags Received (Inflow):</span>
                    <span className="font-mono font-bold">{totals.totalBagsIn}</span>
                </div>
                <div className="flex justify-between items-center py-1">
                    <span className="text-sm">Bags Withdrawn (Outflow):</span>
                    <span className="font-mono font-bold">{totals.totalBagsOut}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-t pt-2 mt-1">
                    <span className="text-sm font-bold">Current Stock in Godown:</span>
                    <span className="font-mono font-bold text-lg text-primary">{totals.balanceStock}</span>
                </div>
            </div>
            
            <div className="space-y-2">
                <h4 className="font-bold text-xs uppercase text-slate-400 tracking-widest border-b pb-1">Financial Reconciliation</h4>
                <div className="flex justify-between items-center py-1">
                    <span className="text-sm">Total Liabilities (Billed):</span>
                    <span className="font-mono font-bold">{formatCurrency(totals.totalHamali + totals.totalRent)}</span>
                </div>
                <div className="flex justify-between items-center py-1">
                    <span className="text-sm">Total Payments (Received):</span>
                    <span className="font-mono font-bold text-green-600">{formatCurrency(totals.totalCredit)}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-t pt-2 mt-1">
                    <span className="text-sm font-bold">Closing Balance Due:</span>
                    <span className="font-mono font-bold text-lg text-destructive">{formatCurrency(totals.finalBalance)}</span>
                </div>
            </div>
        </div>

        {/* Signatures */}
        <div className="mt-24 pt-12 border-t border-slate-200 flex justify-between items-end">
            <div className="text-[10px] text-slate-400 font-medium italic">
                <p>This is a computer-generated ledger.</p>
                <p>Digital Audit ID: {customer?.id?.substring(0,8)}</p>
            </div>
            <div className="text-center min-w-[250px]">
                <div className="h-0.5 bg-slate-300 mb-2"></div>
                <p className="font-bold text-sm uppercase tracking-widest">Authorized Signature</p>
                <p className="text-[10px] text-slate-400 uppercase">Sri Lakshmi Warehouse</p>
            </div>
        </div>
    </div>
  );
});

CustomerStatement.displayName = 'CustomerStatement';