
'use client';

import { useMemo, forwardRef } from 'react';
import type { Customer, StorageRecord, UnloadingRecord, WarehouseInfo } from '@/lib/definitions';
import { formatCurrency, toDate } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
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
        const billNo = String(unloading.billNo || unloading.id).replace(/\D/g, '');
        if (totalHamali > 0) {
            events.push({
                date: toDate(unloading.unloadingDate),
                description: `Inflow - ${unloading.commodityDescription}`,
                billNo: billNo,
                lotNo: unloading.location || 'N/A',
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
                billNo: billNo,
                lotNo: unloading.location || 'N/A',
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
        const billNo = String(record.id).replace(/\D/g, '');
        events.push({
            date: toDate(record.storageStartDate),
            description: `Inflow - ${record.commodityDescription}`,
            billNo: billNo,
            lotNo: record.location || 'N/A',
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
                billNo: billNo,
                lotNo: record.location || 'N/A',
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
                    billNo: billNo, 
                    lotNo: record.location || 'N/A',
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
                billNo: billNo,
                lotNo: record.location || 'N/A',
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
  
  const timestamp = useMemo(() => format(new Date(), 'dd/MM/yy, h:mm a'), []);

  return (
    <div ref={ref} className="bg-white p-4 sm:p-6 text-black font-sans text-sm printable-area border-2 border-black rounded-lg shadow-sm">
        <div className="text-center mb-6 border-b-2 border-black pb-2">
            <h1 className="text-2xl font-bold uppercase tracking-tight">{warehouseInfo?.name || "SRI LAKSHMI WAREHOUSE"}</h1>
            <p className="text-[11px] uppercase font-semibold text-slate-600">{warehouseInfo?.addressLine1} {warehouseInfo?.addressLine2} | Cell: {warehouseInfo?.phone}</p>
            <h2 className="text-md font-bold underline mt-2 uppercase tracking-widest">Statement of Account</h2>
        </div>

        <div className="flex flex-col sm:flex-row justify-between mb-4 gap-2 text-[13px]">
            <div className="space-y-0.5">
                <p><span className="font-bold uppercase text-[10px] text-slate-500">Customer:</span> <span className="font-bold">{customer?.name}</span></p>
                <p><span className="font-bold uppercase text-[10px] text-slate-500">Father's Name:</span> {customer?.fatherName || 'N/A'}</p>
                <p><span className="font-bold uppercase text-[10px] text-slate-500">Village:</span> {customer?.village || 'N/A'}</p>
            </div>
            <div className="sm:text-right text-[10px] text-slate-400 font-bold uppercase">
                <p>Generation Date: {timestamp}</p>
            </div>
        </div>

        <div className="border-2 border-slate-900 p-3 rounded-md bg-slate-50 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5 border-b md:border-b-0 md:border-r border-slate-200 pb-3 md:pb-0 md:pr-6">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Stock Summary</h3>
                    <div className="flex justify-between text-[13px]"><span>Bags In:</span><span className="font-mono font-bold">{totals.totalBagsIn}</span></div>
                    <div className="flex justify-between text-[13px]"><span>Bags Out:</span><span className="font-mono font-bold">{totals.totalBagsOut}</span></div>
                    <div className="flex justify-between items-center border-t border-slate-300 pt-1.5 mt-1.5 text-primary font-black">
                        <span className="uppercase text-[11px]">Godown Stock:</span>
                        <span className="font-mono text-lg">{totals.balanceStock}</span>
                    </div>
                </div>

                <div className="space-y-1.5 md:pl-2">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Financial Summary</h3>
                    <div className="flex justify-between text-[13px]"><span>Total Hamali Charged:</span><span className="font-mono">{formatCurrency(totals.totalHamali)}</span></div>
                    <div className="flex justify-between text-[13px]"><span>Total Rent Billed:</span><span className="font-mono font-bold">{formatCurrency(totals.totalRent)}</span></div>
                    <div className="flex justify-between text-green-700 font-bold border-t border-slate-200 pt-1 mt-1 text-[13px]"><span>Total Payments:</span><span className="font-mono">{formatCurrency(totals.totalCredit)}</span></div>
                    <div className="flex justify-between items-center border-t-2 border-slate-900 pt-1.5 mt-1.5 text-destructive font-black">
                        <span className="uppercase text-[11px]">Final Balance Due:</span>
                        <span className="font-mono text-lg">{formatCurrency(totals.finalBalance)}</span>
                    </div>
                </div>
            </div>
        </div>

        <div className="table-scroll-container border-y-2 border-black">
            <Table className="w-full text-[13px]">
                <TableHeader>
                    <TableRow className="border-b border-black bg-slate-50">
                        <TableHead className="font-bold text-black border-r border-slate-200 text-center p-2 uppercase text-[10px]">Date</TableHead>
                        <TableHead className="font-bold text-black border-r border-slate-200 p-2 uppercase text-[10px]">Description</TableHead>
                        <TableHead className="font-bold text-black border-r border-slate-200 text-center p-2 uppercase text-[10px]">Bill No</TableHead>
                        <TableHead className="font-bold text-black border-r border-slate-200 text-center p-2 uppercase text-[10px]">Lot No</TableHead>
                        <TableHead className="font-bold text-black border-r border-slate-200 text-center p-2 uppercase text-[10px]">In</TableHead>
                        <TableHead className="font-bold text-black border-r border-slate-200 text-center p-2 uppercase text-[10px]">Out</TableHead>
                        <TableHead className="font-bold text-black border-r border-slate-200 text-right p-2 uppercase text-[10px]">Hamali Charges</TableHead>
                        <TableHead className="font-bold text-black border-r border-slate-200 text-right p-2 uppercase text-[10px]">Paid</TableHead>
                        <TableHead className="font-bold text-black text-right p-2 uppercase text-[10px]">Balance</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {lineItems.map((item, index) => (
                        <TableRow key={index} className="border-b border-slate-100 h-8 hover:bg-slate-50/50">
                            <TableCell className="p-1 text-center whitespace-nowrap">{format(item.date, 'dd/MM/yy')}</TableCell>
                            <TableCell className="p-1 font-medium">{item.description}</TableCell>
                            <TableCell className="p-1 text-center font-mono">{item.billNo}</TableCell>
                            <TableCell className="p-1 text-center font-mono">{item.lotNo || 'N/A'}</TableCell>
                            <TableCell className="p-1 text-center font-mono">{item.bagsIn || ''}</TableCell>
                            <TableCell className="p-1 text-center font-mono">{item.bagsOut || ''}</TableCell>
                            <TableCell className="p-1 text-right font-mono">{(item.hamali || 0) + (item.rent || 0) > 0 ? formatCurrency((item.hamali || 0) + (item.rent || 0)) : ''}</TableCell>
                            <TableCell className="p-1 text-right font-mono text-green-700 font-bold">{item.credit > 0 ? formatCurrency(item.credit) : ''}</TableCell>
                            <TableCell className="p-1 text-right font-mono font-black">{formatCurrency(item.balance)}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
                <TableFooter>
                    <TableRow className="bg-slate-100 font-black border-t-2 border-black h-10">
                        <TableCell colSpan={4} className="p-2 text-right uppercase text-[10px] tracking-tight">Audit Totals</TableCell>
                        <TableCell className="p-2 text-center font-mono">{totals.totalBagsIn}</TableCell>
                        <TableCell className="p-2 text-center font-mono">{totals.totalBagsOut}</TableCell>
                        <TableCell className="p-2 text-right font-mono">{formatCurrency(totals.totalHamali + totals.totalRent)}</TableCell>
                        <TableCell className="p-2 text-right font-mono text-green-800">{formatCurrency(totals.totalCredit)}</TableCell>
                        <TableCell className="p-2 text-right font-mono text-[14px]">{formatCurrency(totals.finalBalance)}</TableCell>
                    </TableRow>
                </TableFooter>
            </Table>
        </div>

        <div className="mt-16 flex justify-end">
            <div className="w-64 border-t-2 border-black text-center pt-2">
                <p className="font-black text-[12px] uppercase tracking-widest text-slate-800">Authorized Manager Signature</p>
                <p className="text-[10px] text-slate-400 mt-1 uppercase">Sri Lakshmi Warehouse Audit Department</p>
            </div>
        </div>
    </div>
  );
});

CustomerStatement.displayName = 'CustomerStatement';
