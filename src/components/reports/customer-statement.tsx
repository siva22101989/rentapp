'use client';

import { useMemo, forwardRef } from 'react';
import type { Customer, StorageRecord, UnloadingRecord, WarehouseInfo } from '@/lib/definitions';
import { formatCurrency, toDate } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
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
    
    // 1. Process Unloading Records (Preliminary entries before godown)
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

    // 2. Process Storage Records (Godown entries)
    (records || []).forEach(record => {
        const inflowDebit = record.hamaliPayable || 0;
        
        events.push({
            date: toDate(record.storageStartDate),
            description: `Inflow - ${record.commodityDescription}`,
            billNo: record.id,
            bagsIn: record.bagsIn,
            bagsOut: 0,
            hamali: inflowDebit,
            rent: 0,
            credit: 0,
            sortDate: toDate(record.storageStartDate).getTime(),
            type: 'INFLOW_STORAGE'
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
                type: 'OTHER_CHARGE'
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
    
    // Sort all events chronologically
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
  }, [customer, records, unloadingRecords]);
  
  const timestamp = useMemo(() => format(new Date(), 'dd/MM/yyyy, h:mm a'), []);

  return (
    <div ref={ref} className="bg-white p-4 printable-area text-slate-800 font-sans max-w-5xl mx-auto border shadow-sm">
        {/* Header */}
        <header className="mb-4 pb-2 border-b-2 border-[#3498db]">
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-xl font-black text-[#1e293b] tracking-tighter uppercase leading-tight">{warehouseInfo?.name || "Sri Lakshmi WareHouse"}</h1>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-none">Statement of Account</p>
                </div>
                <div className="text-right">
                    <p className="text-[14px] font-black text-slate-900 uppercase leading-none">{customer?.name || "Unnamed Customer"}</p>
                    <p className="text-[10px] text-slate-500 mt-1 leading-none">{customer?.village || 'N/A'} • {customer?.phone}</p>
                </div>
            </div>
        </header>

        {/* Summary Row */}
        <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 space-y-1">
                <h3 className="text-[9px] font-black text-slate-400 uppercase tracking-widest border-b pb-1 mb-1">Inventory Summary</h3>
                <div className="flex justify-between items-center text-[10px]">
                    <span className="text-slate-500">TOTAL BAGS IN</span>
                    <span className="font-mono font-bold text-slate-900">{totals.totalBagsIn}</span>
                </div>
                <div className="flex justify-between items-center text-[10px]">
                    <span className="text-slate-500">TOTAL BAGS OUT</span>
                    <span className="font-mono font-bold text-slate-900">{totals.totalBagsOut}</span>
                </div>
                <div className="flex justify-between items-center pt-1 border-t border-dashed">
                    <span className="font-black text-slate-700 text-[10px]">BALANCE STOCK</span>
                    <span className="font-black text-[12px] font-mono text-primary">{totals.balanceStock}</span>
                </div>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 space-y-1">
                <h3 className="text-[9px] font-black text-slate-400 uppercase tracking-widest border-b pb-1 mb-1">Financial Standings</h3>
                <div className="flex justify-between items-center text-[10px]">
                    <span className="text-slate-500">HAMALI + RENT</span>
                    <span className="font-mono font-bold text-slate-900">{formatCurrency(totals.totalHamali + totals.totalRent)}</span>
                </div>
                <div className="flex justify-between items-center text-[10px]">
                    <span className="text-slate-500">TOTAL PAID</span>
                    <span className="font-mono font-bold text-green-600">{formatCurrency(totals.totalCredit)}</span>
                </div>
                <div className="flex justify-between items-center pt-1 border-t border-dashed">
                    <span className="font-black text-slate-700 text-[10px]">TOTAL DUE</span>
                    <span className="font-black text-[12px] font-mono text-destructive">{formatCurrency(totals.finalBalance)}</span>
                </div>
            </div>
        </div>

        {/* Ledger Table */}
        <div className="overflow-hidden border border-slate-200 rounded-sm">
            <Table className="w-full">
                <TableHeader>
                    <TableRow className="bg-[#3498db] hover:bg-[#3498db] border-none h-8">
                        <TableHead className="text-white font-black text-[9px] border-r border-sky-400/50 text-center uppercase p-1">Date</TableHead>
                        <TableHead className="text-white font-black text-[9px] border-r border-sky-400/50 text-left uppercase p-1">Description</TableHead>
                        <TableHead className="text-white font-black text-[9px] border-r border-sky-400/50 text-center uppercase p-1">Invoice</TableHead>
                        <TableHead className="text-white font-black text-[9px] border-r border-sky-400/50 text-center uppercase p-1">Bags In</TableHead>
                        <TableHead className="text-white font-black text-[9px] border-r border-sky-400/50 text-center uppercase p-1">Bags Out</TableHead>
                        <TableHead className="text-white font-black text-[9px] border-r border-sky-400/50 text-right uppercase p-1">Hamali</TableHead>
                        <TableHead className="text-white font-black text-[9px] border-r border-sky-400/50 text-right uppercase p-1">Rent</TableHead>
                        <TableHead className="text-white font-black text-[9px] border-r border-sky-400/50 text-right uppercase p-1">Credit</TableHead>
                        <TableHead className="text-white font-black text-[9px] text-right uppercase p-1">Balance</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {lineItems.map((item, index) => (
                        <TableRow key={index} className="border-b border-slate-100 hover:bg-slate-50 transition-colors h-7">
                            <TableCell className="text-center text-[10px] font-medium text-slate-500 whitespace-nowrap p-1">{format(item.date, 'dd/MM/yy')}</TableCell>
                            <TableCell className="text-left text-[10px] font-bold text-slate-700 p-1">{item.description}</TableCell>
                            <TableCell className="text-center text-[10px] font-mono text-slate-400 p-1">{item.billNo}</TableCell>
                            <TableCell className="text-center text-[10px] font-mono font-bold text-sky-600 p-1">{item.bagsIn || ''}</TableCell>
                            <TableCell className="text-center text-[10px] font-mono font-bold text-orange-600 p-1">{item.bagsOut || ''}</TableCell>
                            <TableCell className="text-right text-[10px] font-mono text-slate-600 p-1">{item.hamali > 0 ? formatCurrency(item.hamali) : ''}</TableCell>
                            <TableCell className="text-right text-[10px] font-mono text-slate-600 p-1">{item.rent > 0 ? formatCurrency(item.rent) : ''}</TableCell>
                            <TableCell className="text-right text-[10px] font-mono text-green-600 font-bold p-1">{item.credit > 0 ? formatCurrency(item.credit) : ''}</TableCell>
                            <TableCell className="text-right text-[10px] font-mono font-bold bg-slate-50/30 p-1">{formatCurrency(item.balance)}</TableCell>
                        </TableRow>
                    ))}
                    {lineItems.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={9} className="py-8 text-center text-slate-300 font-black uppercase tracking-widest text-[10px] italic">No Transactions</TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </div>

        {/* Footer */}
        <footer className="mt-6 pt-2 border-t border-slate-100 flex justify-between items-end">
            <div className="text-[9px] text-slate-400 italic leading-tight">
                <p>Computer-generated statement. Please notify errors within 7 days.</p>
                <p>Generated on: {timestamp}</p>
            </div>
            <div className="text-center min-w-[150px]">
                <div className="h-6 border-b border-slate-300 mb-1"></div>
                <p className="text-[10px] font-black text-slate-800 uppercase">Authorized Signature</p>
            </div>
        </footer>
    </div>
  );
});

CustomerStatement.displayName = 'CustomerStatement';