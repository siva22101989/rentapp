'use client';

import { useMemo, forwardRef } from 'react';
import type { Customer, StorageRecord, UnloadingRecord, WarehouseInfo, Commodity, Lot, PaymentType, CustomerPayment } from '@/lib/definitions';
import { formatCurrency, toDate } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { format } from 'date-fns';

type CustomerStatementProps = {
  customer: Customer;
  records: StorageRecord[];
  unloadingRecords: UnloadingRecord[];
  warehouseInfo: WarehouseInfo | null;
  allRecords: StorageRecord[];
  commodities: Commodity[];
  lots: Lot[];
  customers: Customer[];
  customerPayments?: CustomerPayment[];
};

export const CustomerStatement = forwardRef<HTMLDivElement, CustomerStatementProps>(({ 
    customer, 
    records = [], 
    unloadingRecords = [], 
    warehouseInfo,
    allRecords = [],
    commodities = [],
    lots = [],
    customers = [],
    customerPayments = []
}, ref) => {

  const { lineItems, totals } = useMemo(() => {
    const rawEvents: any[] = [];

    const getPaymentDesc = (type?: string, recordType?: 'storage' | 'unloading' | 'bulk') => {
        if (recordType === 'bulk') return 'Bulk Account Payment';
        if (!type) return recordType === 'unloading' ? 'Hamali Payment' : 'Payment Received';
        switch (type) {
            case 'rent': return 'Rent Payment';
            case 'hamali': return 'Hamali Payment';
            case 'unloading': return 'Hamali Payment';
            case 'discount': return 'Adjustment Applied';
            case 'interest': return 'Interest Payment';
            case 'principal': return 'Principal Repayment';
            case 'repayment': return 'Loan Repayment';
            case 'other': return 'Misc Payment';
            default: return 'Payment Received';
        }
    };
    
    let totalHamaliBilled = 0;
    let totalHamaliPaid = 0;
    let totalRentBilled = 0;
    let totalRentPaid = 0;
    let totalDiscounts = 0;
    let totalBagsIn = 0;
    let totalBagsOut = 0;

    // 1. Process Unloading Records
    (unloadingRecords || []).forEach(unloading => {
        const totalHamali = Number(unloading.totalHamali) || 0;
        const cleanId = String(unloading.billNo || unloading.id || '').replace(/\D/g, ''); 
        const bags = Number(unloading.bagsUnloaded) || 0;
        
        if (totalHamali > 0 || bags > 0) {
            totalHamaliBilled += totalHamali;
            totalBagsIn += bags;
            rawEvents.push({
                date: toDate(unloading.unloadingDate),
                description: `Inflow (Unloading) - ${unloading.commodityDescription || 'Misc'}`,
                billNo: cleanId,
                lotNo: unloading.location || 'N/A',
                bagsIn: bags,
                bagsOut: 0,
                hamali: totalHamali,
                rent: 0,
                discount: 0,
                credit: 0,
                sortDate: toDate(unloading.unloadingDate).getTime(),
                recordType: 'unloading',
            });
        }

        if (Array.isArray(unloading.payments)) {
            unloading.payments.forEach((payment, pIdx) => {
                const amt = Number(payment.amount) || 0;
                const isDiscount = payment.type === 'discount';

                if (isDiscount) {
                    totalDiscounts += amt;
                    rawEvents.push({
                        date: toDate(payment.date),
                        description: 'Adjustment / Discount',
                        billNo: cleanId,
                        lotNo: '', bagsIn: 0, bagsOut: 0, hamali: 0, rent: 0,
                        discount: amt, credit: 0,
                        sortDate: toDate(payment.date).getTime() + 1,
                    });
                } else {
                    totalHamaliPaid += amt;
                    rawEvents.push({
                        date: toDate(payment.date),
                        description: getPaymentDesc(payment.type, 'unloading'),
                        billNo: cleanId,
                        lotNo: '', bagsIn: 0, bagsOut: 0, hamali: 0, rent: 0,
                        discount: 0, credit: amt,
                        sortDate: toDate(payment.date).getTime() + 1,
                    });
                }
            });
        }
    });

    // 2. Process Storage Records
    (records || []).forEach(record => {
        const cleanId = String(record.id || '').replace(/\D/g, ''); 
        const hamaliBilledOnInflow = Number(record.hamaliPayable) || 0;
        const historicalBagsOut = Array.isArray(record.outflows) 
            ? record.outflows.reduce((s, o) => s + (Number(o.bagsWithdrawn) || 0), 0) 
            : (Number(record.bagsOut) || 0);
        const inflowBags = Number(record.bagsIn) || (Number(record.bagsStored || 0) + historicalBagsOut);
        
        totalHamaliBilled += hamaliBilledOnInflow;
        totalBagsIn += inflowBags;
        
        rawEvents.push({
            date: toDate(record.storageStartDate),
            description: `Inflow (Godown) - ${record.commodityDescription || 'Misc'}`,
            billNo: cleanId,
            lotNo: record.location || 'N/A',
            bagsIn: inflowBags, bagsOut: 0, hamali: hamaliBilledOnInflow, rent: 0, discount: 0, credit: 0,
            sortDate: toDate(record.storageStartDate).getTime(),
        });
        
        if (record.khataAmount && record.khataAmount > 0) {
            const khata = Number(record.khataAmount);
            totalRentBilled += khata;
            rawEvents.push({
                date: toDate(record.storageStartDate),
                description: `Khata Income (Weighbridge)`,
                billNo: cleanId,
                lotNo: '', bagsIn: 0, bagsOut: 0, hamali: 0, rent: khata, discount: 0, credit: 0,
                sortDate: toDate(record.storageStartDate).getTime() + 2,
            });
        }

        if (Array.isArray(record.outflows)) {
            record.outflows.forEach((outflow, idx) => {
                const pattiNoRaw = String(outflow.pattiNo || '').replace(/\D/g, '');
                const displayId = pattiNoRaw || cleanId;
                const rentVal = Number(outflow.rentBilled) || 0;
                const withdrawn = Number(outflow.bagsWithdrawn) || 0;
                const discVal = Number(outflow.discount) || 0;
                
                totalRentBilled += rentVal;
                totalBagsOut += withdrawn;
                totalDiscounts += discVal;

                rawEvents.push({
                    date: toDate(outflow.date),
                    description: `Withdrawal - ${record.commodityDescription}`,
                    billNo: displayId,
                    lotNo: record.location || 'N/A',
                    bagsIn: 0, bagsOut: withdrawn, hamali: 0, rent: rentVal, discount: discVal, credit: 0,
                    sortDate: toDate(outflow.date).getTime() + 3,
                });
            });
        }

        if (Array.isArray(record.payments)) {
            record.payments.forEach((payment, pIdx) => {
                const amt = Number(payment.amount) || 0;
                const isHamali = payment.type === 'hamali' || payment.type === 'unloading';
                const isDiscount = payment.type === 'discount';
                if (isDiscount) {
                    totalDiscounts += amt;
                    rawEvents.push({
                        date: toDate(payment.date),
                        description: 'Adjustment / Discount',
                        billNo: cleanId,
                        lotNo: '', bagsIn: 0, bagsOut: 0, hamali: 0, rent: 0, discount: amt, credit: 0,
                        sortDate: toDate(payment.date).getTime() + 5,
                    });
                } else {
                    if (isHamali) totalHamaliPaid += amt;
                    else totalRentPaid += amt;
                    rawEvents.push({
                        date: toDate(payment.date),
                        description: getPaymentDesc(payment.type, 'storage'),
                        billNo: cleanId,
                        lotNo: '', bagsIn: 0, bagsOut: 0, hamali: 0, rent: 0, discount: 0, credit: amt,
                        sortDate: toDate(payment.date).getTime() + 5,
                    });
                }
            });
        }
    });

    // 3. Process Account-Level Bulk Payments
    (customerPayments || []).filter(cp => cp.customerId === customer.id).forEach((cp, idx) => {
        const amt = Number(cp.amount) || 0;
        if (cp.isDiscount) {
            totalDiscounts += amt;
            rawEvents.push({
                date: toDate(cp.date),
                description: 'Adjustment / Discount (Bulk)',
                billNo: cp.refNo || 'BULK',
                lotNo: 'ACCOUNT',
                bagsIn: 0, bagsOut: 0, hamali: 0, rent: 0, discount: amt, credit: 0,
                sortDate: toDate(cp.date).getTime() + 10,
            });
        } else {
            if (cp.type === 'hamali') totalHamaliPaid += amt;
            else totalRentPaid += amt;

            rawEvents.push({
                date: toDate(cp.date),
                description: `Bulk Account Payment (${cp.type.toUpperCase()})`,
                billNo: cp.refNo || 'BULK',
                lotNo: 'ACCOUNT',
                bagsIn: 0, bagsOut: 0, hamali: 0, rent: 0, discount: 0, credit: amt,
                sortDate: toDate(cp.date).getTime() + 10,
            });
        }
    });
    
    const sortedEvents = (rawEvents || []).sort((a, b) => a.sortDate - b.sortDate);

    // Grouping Pass: Combine consecutive payments/discounts of same type and date
    const lineItems: any[] = [];
    let currentBalance = 0;

    sortedEvents.forEach((event, idx) => {
        const prev = lineItems[lineItems.length - 1];
        const isFinancialOnly = (event.credit > 0 || event.discount > 0) && event.bagsIn === 0 && event.bagsOut === 0 && event.hamali === 0 && event.rent === 0;
        
        const sameDate = prev && format(toDate(prev.date), 'ddMMyy') === format(toDate(event.date), 'ddMMyy');
        const sameDesc = prev && prev.description === event.description;

        if (isFinancialOnly && prev && sameDate && sameDesc) {
            // Update the existing row
            prev.credit += event.credit;
            prev.discount += event.discount;
            prev.balance += (event.hamali + event.rent - event.credit - event.discount);
            currentBalance = prev.balance;
        } else {
            // New row
            const debit = (Number(event.hamali) || 0) + (Number(event.rent) || 0);
            const creditTotal = (Number(event.credit) || 0) + (Number(event.discount) || 0);
            currentBalance += (debit - creditTotal);
            
            lineItems.push({ 
                ...event, 
                balance: currentBalance,
                // Ensure unique IDs for display
                rowId: `${event.billNo}-${idx}`
            });
        }
    });

    const finalBalance = Math.max(0, currentBalance);
    const hamaliDueReconciled = Math.max(0, totalHamaliBilled - totalHamaliPaid);
    const rentDueReconciled = Math.max(0, finalBalance - hamaliDueReconciled);
    
    return { 
        lineItems, 
        totals: { 
            totalBagsIn, totalBagsOut, balanceStock: Math.max(0, totalBagsIn - totalBagsOut), 
            totalHamaliBilled, totalHamaliPaid, hamaliBalance: hamaliDueReconciled,
            totalRentBilled, totalRentPaid, rentBalance: rentDueReconciled,
            totalDiscounts, totalCredit: totalHamaliPaid + totalRentPaid + totalDiscounts, 
            finalBalance: finalBalance
        } 
    };
  }, [records, unloadingRecords, customerPayments, customer.id]);
  
  const timestamp = useMemo(() => format(new Date(), 'dd/MM/yy, h:mm a'), []);

  return (
    <div ref={ref} className="bg-white p-3 sm:p-6 text-black font-sans text-sm border-2 border-black rounded-lg shadow-sm w-full mx-auto overflow-hidden">
        <style jsx>{`
            table.no-border, table.no-border td { border: none !important; }
            @media screen {
                .statement-table-container { overflow-x: auto; -webkit-overflow-scrolling: touch; }
                .statement-table { min-width: 800px; width: 100%; }
            }
        `}</style>

        <div className="text-center mb-6 border-b-2 border-black pb-2">
            <h1 className="text-xl sm:text-2xl font-bold uppercase tracking-tight">{warehouseInfo?.name || "SRI LAKSHMI WAREHOUSE"}</h1>
            <p className="text-[10px] sm:text-[11px] uppercase font-semibold text-slate-600 leading-tight">{warehouseInfo?.addressLine1} {warehouseInfo?.addressLine2} | Cell: {warehouseInfo?.phone}</p>
            <h2 className="text-sm sm:text-md font-bold underline mt-2 uppercase tracking-widest">Statement of Account</h2>
        </div>

        <div className="flex flex-col sm:flex-row justify-between mb-4 gap-2 text-[12px] sm:text-[13px]">
            <div className="space-y-0.5">
                <p><span className="font-bold uppercase text-[10px] text-slate-500">Customer:</span> <span className="font-bold text-base">{customer?.name}</span></p>
                <p><span className="font-bold uppercase text-[10px] text-slate-500">Village:</span> {customer?.village || 'N/A'}</p>
                <p><span className="font-bold uppercase text-[10px] text-slate-500">Phone:</span> {customer?.phone || 'N/A'}</p>
            </div>
            <div className="sm:text-right text-[10px] text-slate-400 font-bold uppercase">
                <p>Audit Generation: {timestamp}</p>
            </div>
        </div>

        <div className="border-2 border-slate-900 p-3 sm:p-4 rounded-xl bg-slate-50 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-8">
                <div className="space-y-2 border-b md:border-b-0 md:border-r border-slate-200 pb-3 md:pb-0 md:pr-10">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2">Physical Stock Inventory</h3>
                    <div className="flex justify-between text-[12px] sm:text-[13px]"><span>Total Inflow (History):</span><span className="font-mono font-bold">{totals.totalBagsIn}</span></div>
                    <div className="flex justify-between text-[12px] sm:text-[13px]"><span>Total Outflow:</span><span className="font-mono font-bold text-orange-600">{totals.totalBagsOut}</span></div>
                    <div className="flex justify-between items-center border-t border-slate-300 pt-2 mt-2 text-primary font-black">
                        <span className="uppercase text-[11px] tracking-wider">Godown Balance:</span>
                        <span className="font-mono text-lg sm:text-xl">{totals.balanceStock}</span>
                    </div>
                </div>

                <div className="space-y-3 md:pl-2">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-1">Financial Reconciliation</h3>
                    <div className="grid grid-cols-2 gap-x-4 sm:gap-x-8 gap-y-2 text-[11px] sm:text-[12px]">
                        <div className="space-y-0.5 border-r border-slate-100 pr-2 sm:pr-4">
                            <p className="uppercase text-[9px] font-bold text-slate-400">Labor/Rent</p>
                            <div className="flex justify-between"><span>Hamali Due:</span><span className="font-mono">{formatCurrency(totals.hamaliBalance)}</span></div>
                            <div className="flex justify-between"><span>Rent Due:</span><span className="font-mono">{formatCurrency(totals.rentBalance)}</span></div>
                        </div>
                        <div className="space-y-0.5 flex flex-col justify-center">
                            <p className="uppercase text-[9px] font-bold text-slate-400">Net Due</p>
                            <p className="text-lg sm:text-xl font-mono font-black text-destructive">{formatCurrency(totals.finalBalance)}</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div className="statement-table-container border-y-2 border-black">
            <Table className="statement-table w-full text-[11px] sm:text-[13px]">
                <TableHeader>
                    <TableRow className="border-b border-black bg-slate-50 h-10">
                        <TableHead className="font-bold text-black border-r border-slate-200 text-center p-1 uppercase text-[9px]">Date</TableHead>
                        <TableHead className="font-bold text-black border-r border-slate-200 p-1 uppercase text-[9px]">Description</TableHead>
                        <TableHead className="font-bold text-black border-r border-slate-200 text-center p-1 uppercase text-[9px]">In</TableHead>
                        <TableHead className="font-bold text-black border-r border-slate-200 text-center p-1 uppercase text-[9px]">Out</TableHead>
                        <TableHead className="font-bold text-black border-r border-slate-200 text-right p-1 uppercase text-[9px]">Hamali</TableHead>
                        <TableHead className="font-bold text-black border-r border-slate-200 text-right p-1 uppercase text-[9px]">Rent</TableHead>
                        <TableHead className="font-bold text-black border-r border-slate-200 text-right p-1 uppercase text-[9px]">Disc</TableHead>
                        <TableHead className="font-bold text-black border-r border-slate-200 text-right p-1 uppercase text-[9px]">Paid</TableHead>
                        <TableHead className="font-bold text-black text-right p-1 uppercase text-[9px]">Balance</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {lineItems.map((item) => (
                        <TableRow key={item.rowId} className="border-b border-slate-100 h-9 hover:bg-slate-50/50">
                            <TableCell className="p-1 text-center whitespace-nowrap">{format(item.date, 'dd/MM/yy')}</TableCell>
                            <TableCell className="p-1 font-medium tracking-tight text-[11px] sm:text-[12px]">{item.description}</TableCell>
                            <TableCell className="p-1 text-center font-mono">{item.bagsIn || ''}</TableCell>
                            <TableCell className="p-1 text-center font-mono text-orange-600 font-bold">{item.bagsOut || ''}</TableCell>
                            <TableCell className="p-1 text-right font-mono">{item.hamali > 0 ? formatCurrency(item.hamali) : ''}</TableCell>
                            <TableCell className="p-1 text-right font-mono">{item.rent > 0 ? formatCurrency(item.rent) : ''}</TableCell>
                            <TableCell className="p-1 text-right font-mono text-blue-600 font-bold">{item.discount > 0 ? formatCurrency(item.discount) : ''}</TableCell>
                            <TableCell className="p-1 text-right font-mono text-green-700 font-black">{item.credit > 0 ? formatCurrency(item.credit) : ''}</TableCell>
                            <TableCell className="p-1 text-right font-mono font-black">{formatCurrency(item.balance)}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
                <TableFooter>
                    <TableRow className="bg-slate-900 text-white font-black border-t-2 border-black h-12">
                        <TableCell colSpan={2} className="p-2 text-right uppercase text-[9px] sm:text-[10px]">Grand Totals</TableCell>
                        <TableCell className="p-1 text-center font-mono">{totals.totalBagsIn}</TableCell>
                        <TableCell className="p-1 text-center font-mono text-orange-400">{totals.totalBagsOut}</TableCell>
                        <TableCell className="p-1 text-right font-mono">{formatCurrency(totals.totalHamaliBilled)}</TableCell>
                        <TableCell className="p-1 text-right font-mono">{formatCurrency(totals.totalRentBilled)}</TableCell>
                        <TableCell className="p-1 text-right font-mono text-blue-300">{formatCurrency(totals.totalDiscounts)}</TableCell>
                        <TableCell className="p-1 text-right font-mono text-green-400">{formatCurrency(totals.totalHamaliPaid + totals.totalRentPaid)}</TableCell>
                        <TableCell className="p-1 text-right font-mono text-[12px] sm:text-base">{formatCurrency(totals.finalBalance)}</TableCell>
                    </TableRow>
                </TableFooter>
            </Table>
        </div>

        <div className="mt-12 sm:mt-20 flex justify-between">
             <div className="w-32 sm:w-64 border-t border-slate-300 text-center pt-2">
                <p className="font-bold text-[10px] sm:text-[11px] uppercase tracking-widest text-slate-500">Customer</p>
            </div>
            <div className="w-32 sm:w-64 border-t-2 border-black text-center pt-2">
                <p className="font-black text-[10px] sm:text-[12px] uppercase tracking-widest text-slate-800">Authorized Manager</p>
            </div>
        </div>
    </div>
  );
});

CustomerStatement.displayName = 'CustomerStatement';