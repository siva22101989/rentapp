
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

  const { lineItems, totals } = useMemo(() => {
    const events: any[] = [];
    
    // 1. Process Unloading Records (Vehicle Gate Entries)
    (unloadingRecords || []).forEach(unloading => {
        const totalHamali = unloading.totalHamali || 0;
        
        if (totalHamali > 0) {
            events.push({
                date: toDate(unloading.unloadingDate),
                description: `Vehicle Unloading: ${unloading.commodityDescription}`,
                billNo: unloading.billNo || unloading.id,
                bags: unloading.bagsUnloaded,
                hamali: totalHamali,
                rent: 0,
                paid: 0,
                sortDate: toDate(unloading.unloadingDate).getTime(),
                type: 'INFLOW_UNLOADING'
            });
        }

        (unloading.payments || []).forEach((payment, pIdx) => {
            events.push({
                date: toDate(payment.date),
                description: `Payment (Ref: ${unloading.billNo || unloading.id})`,
                billNo: unloading.billNo || unloading.id,
                bags: 0,
                hamali: 0,
                rent: 0,
                paid: payment.amount || 0,
                sortDate: toDate(payment.date).getTime() + pIdx,
                type: 'PAYMENT'
            });
        });
    });

    // 2. Process Storage Records (Godown Inflows & Withdrawals)
    (records || []).forEach(record => {
        const inflowDebit = record.hamaliPayable || 0;
        if (inflowDebit > 0) {
            events.push({
                date: toDate(record.storageStartDate),
                description: record.inflowType === 'Plot' ? `Godown Stacking: ${record.commodityDescription}` : `Direct Stacking: ${record.commodityDescription}`,
                billNo: record.id,
                bags: record.bagsIn,
                hamali: inflowDebit,
                rent: 0,
                paid: 0,
                sortDate: toDate(record.storageStartDate).getTime(),
                type: 'INFLOW_STORAGE'
            });
        }
        
        if (record.khataAmount && record.khataAmount > 0) {
            events.push({
                date: toDate(record.storageStartDate),
                description: `Khata / Weighbridge Charges`,
                billNo: record.id,
                bags: 0,
                hamali: record.khataAmount,
                rent: 0,
                paid: 0,
                sortDate: toDate(record.storageStartDate).getTime() + 2,
                type: 'OTHER_CHARGE'
            });
        }

        if (Array.isArray(record.outflows)) {
            record.outflows.forEach((outflow, idx) => {
                const pattiNo = `${record.id}-${idx + 1}`;
                events.push({
                    date: toDate(outflow.date),
                    description: `Rent Billed: Withdrawal of ${outflow.bagsWithdrawn} bags`,
                    billNo: pattiNo, 
                    bags: -outflow.bagsWithdrawn,
                    hamali: 0,
                    rent: outflow.rentBilled || 0,
                    paid: 0,
                    sortDate: toDate(outflow.date).getTime() + 3,
                    type: 'OUTFLOW'
                });

                if (outflow.discount && outflow.discount > 0) {
                    events.push({
                        date: toDate(outflow.date),
                        description: `Discount (Bill #${pattiNo})`,
                        billNo: pattiNo,
                        bags: 0,
                        hamali: 0,
                        rent: 0,
                        paid: outflow.discount,
                        sortDate: toDate(outflow.date).getTime() + 4,
                        type: 'DISCOUNT'
                    });
                }
            });
        }

        (record.payments || []).forEach((payment, pIdx) => {
            events.push({
                date: toDate(payment.date),
                description: payment.type === 'discount' ? `Rebate/Discount Applied` : (payment.type === 'hamali' ? `Hamali Payment Received` : `Rent/Storage Payment Received`),
                billNo: record.id,
                bags: 0,
                hamali: 0,
                rent: 0,
                paid: payment.amount || 0,
                sortDate: toDate(payment.date).getTime() + 5 + pIdx,
                type: 'PAYMENT'
            });
        });
    });
    
    const sortedEvents = events.sort((a, b) => a.sortDate - b.sortDate);

    let runningBalance = 0;
    let runningStock = 0;
    let totalHamali = 0;
    let totalRent = 0;
    let totalPaid = 0;

    const lineItems = sortedEvents.map(event => {
        const debit = (event.hamali || 0) + (event.rent || 0);
        const credit = event.paid || 0;
        
        runningBalance += (debit - credit);
        runningStock += (event.bags || 0);
        
        totalHamali += (event.hamali || 0);
        totalRent += (event.rent || 0);
        totalPaid += credit;
        
        return { 
            ...event, 
            totalStock: runningStock,
            balance: runningBalance
        };
    });
    
    return { 
        lineItems: [...lineItems].reverse(), 
        totals: { 
            totalHamali, 
            totalRent, 
            totalPaid, 
            finalBalance: runningBalance,
            finalStock: runningStock
        } 
    };
  }, [records, unloadingRecords]);
  
  const timestamp = useMemo(() => format(new Date(), 'dd/MM/yyyy, hh:mm a'), []);

  return (
    <div ref={ref} className="bg-white p-4 sm:p-8 printable-area text-black font-sans text-[11px] leading-tight">
        <header className="text-center mb-8 border-b-2 border-slate-900 pb-6">
            <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase">{warehouseInfo?.name || 'Sri Lakshmi Warehouse'}</h1>
            <p className="text-xs font-bold text-slate-600 mt-1 uppercase tracking-widest">{warehouseInfo?.addressLine1} {warehouseInfo?.addressLine2}</p>
            <p className="text-xs font-bold text-slate-600">PH: {warehouseInfo?.phone}</p>
            <div className="mt-4 inline-block bg-slate-900 text-white px-6 py-1.5 font-bold text-sm uppercase tracking-[0.2em]">Customer Account Statement</div>
        </header>

        <div className="grid grid-cols-2 gap-8 mb-6">
            <div className="space-y-1.5 text-left border-l-4 border-slate-900 pl-4">
                <p className="flex justify-between w-full max-w-[300px]"><span className="font-bold text-slate-500 uppercase tracking-tighter">Depositor</span><span className="font-black text-slate-900">: {customer.name}</span></p>
                <p className="flex justify-between w-full max-w-[300px]"><span className="font-bold text-slate-500 uppercase tracking-tighter">Village</span><span className="font-bold text-slate-900">: {customer.village || 'N/A'}</span></p>
                <p className="flex justify-between w-full max-w-[300px]"><span className="font-bold text-slate-500 uppercase tracking-tighter">Contact</span><span className="font-bold text-slate-900">: {customer.phone}</span></p>
            </div>
            <div className="text-right flex flex-col justify-end">
                <p className="text-[10px] text-slate-500 uppercase font-bold">Statement Generated: {timestamp}</p>
                <div className="mt-2">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Net Balance Due</p>
                    <p className="text-3xl font-black text-destructive tracking-tighter">{formatCurrency(totals.finalBalance)}</p>
                </div>
            </div>
        </div>

        <div className="overflow-hidden border-2 border-slate-900 rounded-sm">
            <Table className="w-full border-collapse">
                <TableHeader>
                    <TableRow className="bg-slate-900 hover:bg-slate-900 h-10">
                        <TableHead className="text-white font-black border-r border-slate-700 px-2 text-center uppercase w-[70px]">Date</TableHead>
                        <TableHead className="text-white font-black border-r border-slate-700 px-2 text-center uppercase w-[90px]">Inflow Bill No</TableHead>
                        <TableHead className="text-white font-black border-r border-slate-700 px-2 text-center uppercase w-[60px]">WR (Bags)</TableHead>
                        <TableHead className="text-white font-black border-r border-slate-700 px-2 text-center uppercase w-[70px]">Total Stock</TableHead>
                        <TableHead className="text-white font-black border-r border-slate-700 px-2 text-right uppercase w-[90px]">Hamali Amount</TableHead>
                        <TableHead className="text-white font-black border-r border-slate-700 px-2 text-right uppercase w-[90px]">Rent Amount</TableHead>
                        <TableHead className="text-white font-black border-r border-slate-700 px-2 text-right uppercase w-[90px]">Paid Amount</TableHead>
                        <TableHead className="text-white font-black px-3 text-right uppercase w-[110px]">Balance Amount</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {lineItems.map((item, index) => (
                        <TableRow key={index} className="border-b border-slate-200 hover:bg-slate-50 h-8 group">
                            <TableCell className="p-2 border-r border-slate-200 text-center font-bold text-slate-600">{format(item.date, 'dd/MM/yy')}</TableCell>
                            <TableCell className="p-2 border-r border-slate-200 text-center font-mono font-black text-slate-900">{item.billNo}</TableCell>
                            <TableCell className={`p-2 border-r border-slate-200 text-center font-mono font-bold ${item.bags > 0 ? 'text-primary' : item.bags < 0 ? 'text-destructive' : 'text-slate-400'}`}>
                                {item.bags !== 0 ? item.bags : '-'}
                            </TableCell>
                            <TableCell className="p-2 border-r border-slate-200 text-center font-mono font-black text-slate-900 bg-slate-50">{item.totalStock}</TableCell>
                            <TableCell className="p-2 border-r border-slate-200 text-right font-mono font-bold text-slate-600">{item.hamali > 0 ? formatCurrency(item.hamali).replace('₹', '') : '-'}</TableCell>
                            <TableCell className="p-2 border-r border-slate-200 text-right font-mono font-bold text-slate-600">{item.rent > 0 ? formatCurrency(item.rent).replace('₹', '') : '-'}</TableCell>
                            <TableCell className="p-2 border-r border-slate-200 text-right font-mono text-green-700 font-black">{item.paid > 0 ? formatCurrency(item.paid).replace('₹', '') : '-'}</TableCell>
                            <TableCell className="p-2 px-3 text-right font-mono font-black bg-slate-100/50 group-hover:bg-slate-100">{formatCurrency(item.balance).replace('₹', '')}</TableCell>
                        </TableRow>
                    ))}
                    {lineItems.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={8} className="p-12 text-center text-slate-400 font-bold uppercase tracking-widest italic">No transaction history available.</TableCell>
                        </TableRow>
                    )}
                </TableBody>
                 <TableFooter>
                    <TableRow className="bg-slate-900 text-white font-black border-t-2 border-slate-900 h-10">
                        <TableCell colSpan={2} className="text-right border-r border-slate-700 uppercase px-3 tracking-widest text-[9px]">Grand Totals:</TableCell>
                        <TableCell className="text-center border-r border-slate-700 font-mono text-xs">-</TableCell>
                        <TableCell className="text-center border-r border-slate-700 font-mono text-xs">{totals.finalStock}</TableCell>
                        <TableCell className="text-right border-r border-slate-700 font-mono text-xs">{formatCurrency(totals.totalHamali).replace('₹', '')}</TableCell>
                        <TableCell className="text-right border-r border-slate-700 font-mono text-xs">{formatCurrency(totals.totalRent).replace('₹', '')}</TableCell>
                        <TableCell className="text-right border-r border-slate-700 font-mono text-xs text-green-300">{formatCurrency(totals.totalPaid).replace('₹', '')}</TableCell>
                        <TableCell className="text-right font-mono text-sm bg-destructive text-white px-3">{formatCurrency(totals.finalBalance).replace('₹', '')}</TableCell>
                    </TableRow>
                 </TableFooter>
            </Table>
        </div>
        
        <div className="mt-16 flex justify-between text-center gap-12">
            <div className="flex-1 max-w-[250px]">
                <div className="border-t-2 border-slate-900 pt-2">
                    <p className="text-slate-900 font-black text-[10px] uppercase tracking-tighter">Customer Signature</p>
                </div>
            </div>
            {warehouseInfo?.bankDetails && (
                <div className="flex-1 bg-slate-50 border-2 border-dashed border-slate-300 p-4 text-left">
                    <p className="text-[9px] font-black uppercase text-slate-400 mb-1">Bank Payment Info</p>
                    <p className="font-bold text-slate-700 whitespace-pre-wrap leading-tight">{warehouseInfo.bankDetails}</p>
                </div>
            )}
            <div className="flex-1 max-w-[250px]">
                <div className="border-t-2 border-slate-900 pt-2">
                    <p className="text-slate-900 font-black text-[10px] uppercase tracking-tighter">Manager / Accountant</p>
                    <p className="text-primary font-black text-[9px] uppercase mt-1 tracking-widest">{warehouseInfo?.name || 'Sri Lakshmi Warehouse'}</p>
                </div>
            </div>
        </div>

        <footer className="text-[8px] text-slate-400 font-bold uppercase mt-12 text-center border-t pt-4 border-slate-100">
            <p>Computer generated document - No physical signature required for audit purposes.</p>
        </footer>
    </div>
  );
});

CustomerStatement.displayName = 'CustomerStatement';
