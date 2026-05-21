
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
    
    // 1. Process Unloading Records
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

    // 2. Process Storage Records
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
  
  const timestamp = useMemo(() => format(new Date(), 'dd/MM/yyyy, h:mm a'), []);

  return (
    <div ref={ref} className="bg-white p-6 printable-area text-slate-800 font-sans max-w-6xl mx-auto border shadow-sm rounded-xl">
        <header className="mb-6 pb-4 border-b-2 border-[#3498db] flex justify-between items-center">
            <div className="flex-1">
                <h1 className="text-2xl font-black text-[#1e293b] tracking-tighter uppercase leading-tight">{warehouseInfo?.name || "SRI LAKSHMI WAREHOUSE"}</h1>
                <p className="text-[12px] font-black text-slate-400 uppercase tracking-[0.2em]">Audit Ledger • Statement of Account</p>
                <div className="mt-1 text-[12px] text-slate-500 font-medium">
                    <p>{warehouseInfo?.addressLine1}</p>
                    <p>{warehouseInfo?.addressLine2}</p>
                </div>
            </div>
            <div className="text-right bg-slate-900 text-white p-4 px-8 rounded-xl shadow-lg border-b-4 border-[#3498db] min-w-[350px]">
                <p className="text-[10px] font-bold text-sky-400 uppercase tracking-[0.2em] mb-1">Customer Identification</p>
                <p className="text-2xl font-black uppercase leading-tight tracking-tight text-white">{customer?.name || "Unnamed Customer"}</p>
                <p className="text-[12px] text-slate-400 font-bold mt-1 uppercase">{customer?.village || 'Village: N/A'} • {customer?.phone}</p>
            </div>
        </header>

        {/* High-Density Summary Ledger - Side-by-side blocks precisely matching reference */}
        <div className="grid grid-cols-2 gap-8 mb-8 text-[13px]">
            {/* Left Box: Inventory Status */}
            <div className="bg-slate-50/80 border border-slate-200 rounded-lg overflow-hidden shadow-sm">
                <div className="flex justify-between items-center px-4 py-2 border-b border-slate-200">
                    <span className="font-bold text-slate-600 tracking-tight">Total Bags In:</span>
                    <span className="font-mono font-bold text-slate-800">{totals.totalBagsIn}</span>
                </div>
                <div className="flex justify-between items-center px-4 py-2 border-b border-slate-200">
                    <span className="font-bold text-slate-600 tracking-tight">Total Bags Out:</span>
                    <span className="font-mono font-bold text-slate-800">{totals.totalBagsOut}</span>
                </div>
                <div className="flex justify-between items-center px-4 py-2 border-b border-slate-200">
                    <span className="font-black text-slate-900 uppercase">Balance Stock:</span>
                    <span className="font-mono font-black text-slate-900 text-[15px]">{totals.balanceStock}</span>
                </div>
                <div className="h-[37px] bg-slate-50/50"></div> {/* Empty spacer to align height */}
            </div>

            {/* Right Box: Financial Status */}
            <div className="bg-slate-50/80 border border-slate-200 rounded-lg overflow-hidden shadow-sm">
                <div className="flex justify-between items-center px-4 py-2 border-b border-slate-200">
                    <span className="font-bold text-slate-600 tracking-tight">Total Hamali:</span>
                    <span className="font-mono font-bold text-slate-800">{formatCurrency(totals.totalHamali)}</span>
                </div>
                <div className="flex justify-between items-center px-4 py-2 border-b border-slate-200">
                    <span className="font-bold text-slate-600 tracking-tight">Total Rent:</span>
                    <span className="font-mono font-bold text-slate-800">{formatCurrency(totals.totalRent)}</span>
                </div>
                <div className="flex justify-between items-center px-4 py-2 border-b border-slate-200">
                    <span className="font-bold text-slate-600 tracking-tight">Total Paid:</span>
                    <span className="font-mono font-bold text-green-600">{formatCurrency(totals.totalCredit)}</span>
                </div>
                <div className="flex justify-between items-center px-4 py-2 bg-slate-100/50">
                    <span className="font-black text-slate-900 uppercase">Balance Due:</span>
                    <span className="font-mono font-black text-destructive text-[15px]">{formatCurrency(totals.finalBalance)}</span>
                </div>
            </div>
        </div>

        <div className="overflow-hidden border border-slate-200 rounded-xl shadow-sm">
            <Table className="w-full text-[13px]">
                <TableHeader>
                    <TableRow className="bg-[#3498db] hover:bg-[#3498db] border-none">
                        <TableHead className="py-2 text-white font-black border-r border-sky-400/50 text-center uppercase text-[10px]">Date</TableHead>
                        <TableHead className="py-2 text-white font-black border-r border-sky-400/50 text-left uppercase text-[10px]">Description</TableHead>
                        <TableHead className="py-2 text-white font-black border-r border-sky-400/50 text-center uppercase text-[10px]">Invoice No</TableHead>
                        <TableHead className="py-2 text-white font-black border-r border-sky-400/50 text-center uppercase text-[10px]">Bags In</TableHead>
                        <TableHead className="py-2 text-white font-black border-r border-sky-400/50 text-center uppercase text-[10px]">Bags Out</TableHead>
                        <TableHead className="py-2 text-white font-black border-r border-sky-400/50 text-right uppercase text-[10px]">Hamali</TableHead>
                        <TableHead className="py-2 text-white font-black border-r border-sky-400/50 text-right uppercase text-[10px]">Rent</TableHead>
                        <TableHead className="py-2 text-white font-black border-r border-sky-400/50 text-right uppercase text-[10px]">Credit</TableHead>
                        <TableHead className="py-2 text-white font-black text-right uppercase text-[10px]">Balance</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {lineItems.map((item, index) => (
                        <TableRow key={index} className="border-b border-slate-100 hover:bg-slate-50 transition-colors h-8">
                            <TableCell className="p-2 text-center font-bold text-slate-500 whitespace-nowrap">{format(item.date, 'dd/MM/yy')}</TableCell>
                            <TableCell className="p-2 text-left font-black text-slate-800 tracking-tighter uppercase">{item.description}</TableCell>
                            <TableCell className="p-2 text-center font-mono font-bold text-slate-400">{item.billNo}</TableCell>
                            <TableCell className="p-2 text-center font-mono font-black text-sky-600">{item.bagsIn || ''}</TableCell>
                            <TableCell className="p-2 text-center font-mono font-black text-orange-600">{item.bagsOut || ''}</TableCell>
                            <TableCell className="p-2 text-right font-mono font-bold text-slate-600">{item.hamali > 0 ? formatCurrency(item.hamali) : ''}</TableCell>
                            <TableCell className="p-2 text-right font-mono font-bold text-slate-600">{item.rent > 0 ? formatCurrency(item.rent) : ''}</TableCell>
                            <TableCell className="p-2 text-right font-mono text-green-600 font-black">{item.credit > 0 ? formatCurrency(item.credit) : ''}</TableCell>
                            <TableCell className="p-2 text-right font-mono font-black bg-slate-50/50">{formatCurrency(item.balance)}</TableCell>
                        </TableRow>
                    ))}
                    {lineItems.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={9} className="py-12 text-center text-slate-300 font-black uppercase tracking-widest text-[11px] italic">No Ledger Transactions Found</TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </div>

        <footer className="mt-6 pt-4 border-t border-slate-200 flex justify-between items-end">
            <div className="text-[10px] text-slate-400 font-bold italic leading-tight space-y-0.5">
                <p>Digital Statement. Verified audit trail.</p>
                <p>Generated on: {timestamp}</p>
            </div>
            <div className="text-center min-w-[200px]">
                <div className="h-10 border-b border-slate-300 mb-2"></div>
                <p className="text-[12px] font-black text-slate-800 uppercase tracking-wider">Authorized Manager</p>
                <p className="text-[10px] text-slate-400 font-bold uppercase">Sri Lakshmi WareHouse</p>
            </div>
        </footer>
    </div>
  );
});

CustomerStatement.displayName = 'CustomerStatement';
