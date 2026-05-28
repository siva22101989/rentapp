'use client';

import { useMemo, forwardRef } from 'react';
import type { Customer, StorageRecord, UnloadingRecord, WarehouseInfo, Commodity, Lot, PaymentType } from '@/lib/definitions';
import { formatCurrency, toDate } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { format } from 'date-fns';
import { ActionsMenu } from '@/components/dashboard/actions-menu';
import { OutflowActionsMenu } from './outflow-actions-menu';
import { PaymentActionsMenu } from './payment-actions-menu';
import { UnloadingTableActionsMenu } from '../unloading/unloading-table-actions-menu';

type CustomerStatementProps = {
  customer: Customer;
  records: StorageRecord[];
  unloadingRecords: UnloadingRecord[];
  warehouseInfo: WarehouseInfo | null;
  allRecords: StorageRecord[];
  commodities: Commodity[];
  lots: Lot[];
  customers: Customer[];
};

export const CustomerStatement = forwardRef<HTMLDivElement, CustomerStatementProps>(({ 
    customer, 
    records, 
    unloadingRecords, 
    warehouseInfo,
    allRecords,
    commodities,
    lots,
    customers
}, ref) => {

  const { lineItems, totals } = useMemo(() => {
    const events: any[] = [];

    const getPaymentDesc = (type?: string, recordType?: 'storage' | 'unloading') => {
        if (!type) return recordType === 'unloading' ? 'Hamali Payment' : 'Payment Received';
        switch (type) {
            case 'rent': return 'Rent Payment';
            case 'hamali': return 'Hamali Payment';
            case 'unloading': return 'Hamali Payment';
            case 'discount': return 'Discount Applied';
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

    // 1. Process Unloading Records
    (unloadingRecords || []).forEach(unloading => {
        const totalHamali = unloading.totalHamali || 0;
        const billNo = String(unloading.billNo || unloading.id).replace(/\D/g, '');
        if (totalHamali > 0) {
            totalHamaliBilled += totalHamali;
            events.push({
                date: toDate(unloading.unloadingDate),
                description: `Inflow (Unloading) - ${unloading.commodityDescription}`,
                billNo: billNo,
                lotNo: unloading.location || 'N/A',
                bagsIn: unloading.bagsUnloaded,
                bagsOut: 0,
                hamali: totalHamali,
                rent: 0,
                credit: 0,
                sortDate: toDate(unloading.unloadingDate).getTime(),
                recordType: 'unloading',
                sourceRecord: unloading,
            });
        }

        (unloading.payments || []).forEach((payment, pIdx) => {
            totalHamaliPaid += payment.amount;
            events.push({
                date: toDate(payment.date),
                description: getPaymentDesc(payment.type, 'unloading'),
                billNo: billNo,
                lotNo: '', // Payments don't need a lot reference
                bagsIn: 0,
                bagsOut: 0,
                hamali: 0,
                rent: 0,
                credit: payment.amount || 0,
                sortDate: toDate(payment.date).getTime() + pIdx,
                recordType: 'payment',
                paymentType: 'unloading',
                paymentIndex: pIdx,
                sourceRecord: unloading,
                paymentData: payment
            });
        });
    });

    // 2. Process Storage Records
    (records || []).forEach(record => {
        const billNo = String(record.id).replace(/\D/g, '');
        totalHamaliBilled += record.hamaliPayable || 0;
        
        // Inflow Event
        events.push({
            date: toDate(record.storageStartDate),
            description: `Inflow (Storage) - ${record.commodityDescription}`,
            billNo: billNo,
            lotNo: record.location || 'N/A',
            bagsIn: record.bagsIn,
            bagsOut: 0,
            hamali: record.hamaliPayable || 0,
            rent: 0,
            credit: 0,
            sortDate: toDate(record.storageStartDate).getTime(),
            recordType: 'storage',
            sourceRecord: record,
        });
        
        // Khata Event (Rent Category)
        if (record.khataAmount && record.khataAmount > 0) {
            totalRentBilled += record.khataAmount;
            events.push({
                date: toDate(record.storageStartDate),
                description: `Khata Income (Weighbridge)`,
                billNo: billNo,
                lotNo: record.location || 'N/A',
                bagsIn: 0,
                bagsOut: 0,
                hamali: 0,
                rent: record.khataAmount,
                credit: 0,
                sortDate: toDate(record.storageStartDate).getTime() + 2,
                recordType: 'storage',
                sourceRecord: record,
            });
        }

        // Outflow Events (Rent Category)
        if (Array.isArray(record.outflows)) {
            record.outflows.forEach((outflow, idx) => {
                const rentVal = outflow.rentBilled || 0;
                totalRentBilled += rentVal;
                events.push({
                    date: toDate(outflow.date),
                    description: `Outflow Withdrawal`,
                    billNo: `${billNo}-${idx + 1}`, // Updated to show Patti No
                    lotNo: record.location || 'N/A',
                    bagsIn: 0,
                    bagsOut: outflow.bagsWithdrawn,
                    hamali: 0,
                    rent: rentVal,
                    credit: 0,
                    sortDate: toDate(outflow.date).getTime() + 3,
                    recordType: 'outflow',
                    sourceRecord: record,
                    outflowData: outflow,
                    outflowIndex: idx,
                });
            });
        }

        // Payments
        (record.payments || []).forEach((payment, pIdx) => {
            const isHamali = payment.type === 'hamali' || payment.type === 'unloading';
            if (isHamali) totalHamaliPaid += payment.amount;
            else totalRentPaid += payment.amount;

            events.push({
                date: toDate(payment.date),
                description: getPaymentDesc(payment.type, 'storage'),
                billNo: billNo,
                lotNo: '', // Payments don't need a lot reference
                bagsIn: 0,
                bagsOut: 0,
                hamali: 0,
                rent: 0,
                credit: payment.amount || 0,
                sortDate: toDate(payment.date).getTime() + 5 + pIdx,
                recordType: 'payment',
                paymentType: 'storage',
                paymentIndex: pIdx,
                sourceRecord: record,
                paymentData: payment
            });
        });
    });
    
    const sortedEvents = events.sort((a, b) => a.sortDate - b.sortDate);

    let runningBalance = 0;
    let totalBagsIn = 0;
    let totalBagsOut = 0;
    let totalCredit = 0;

    const lineItems = sortedEvents.map(event => {
        const debit = (event.hamali || 0) + (event.rent || 0);
        const credit = event.credit || 0;
        runningBalance += (debit - credit);
        
        totalBagsIn += (event.bagsIn || 0);
        totalBagsOut += (event.bagsOut || 0);
        totalCredit += credit;

        return { ...event, balance: runningBalance };
    });
    
    return { 
        lineItems, 
        totals: { 
            totalBagsIn, 
            totalBagsOut, 
            balanceStock: totalBagsIn - totalBagsOut, 
            totalHamaliBilled, 
            totalHamaliPaid,
            hamaliBalance: totalHamaliBilled - totalHamaliPaid,
            totalRentBilled, 
            totalRentPaid,
            rentBalance: totalRentBilled - totalRentPaid,
            totalCredit, 
            finalBalance: runningBalance 
        } 
    };
  }, [records, unloadingRecords]);
  
  const timestamp = useMemo(() => format(new Date(), 'dd/MM/yy, h:mm a'), []);

  const renderActions = (item: any) => {
      switch (item.recordType) {
          case 'storage':
              return <ActionsMenu record={item.sourceRecord} customers={customers} allRecords={allRecords} />;
          case 'unloading':
              return <UnloadingTableActionsMenu record={{...item.sourceRecord, hamaliPending: 0}} customers={customers} commodities={commodities} lots={lots} storageRecords={allRecords} />;
          case 'outflow':
              const originalBillNo = String(item.sourceRecord.id).replace(/\D/g, '');
              return (
                  <OutflowActionsMenu 
                    record={item.sourceRecord} 
                    customer={customer} 
                    warehouseInfo={warehouseInfo} 
                    outflow={item.outflowData} 
                    outflowIndex={item.outflowIndex} 
                    deliveryOrderNo={`${originalBillNo}-${item.outflowIndex + 1}`} 
                    deliveryOrderDate={item.date} 
                    commodities={commodities} 
                    lots={lots} 
                    allRecords={allRecords} 
                  />
              );
          case 'payment':
              return (
                  <PaymentActionsMenu 
                    event={{
                        date: item.date,
                        customerId: customer.id,
                        description: item.description,
                        recordId: String(item.sourceRecord.id || item.sourceRecord.billNo),
                        amount: item.credit,
                        type: (item.paymentData.type || 'other') as PaymentType,
                        recordType: item.paymentType,
                        paymentIndex: item.paymentIndex
                    }} 
                  />
              );
          default:
              return null;
      }
  }

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
                <p><span className="font-bold uppercase text-[10px] text-slate-500">Phone No:</span> {customer?.phone || 'N/A'}</p>
            </div>
            <div className="sm:text-right text-[10px] text-slate-400 font-bold uppercase">
                <p>Generation Date: {timestamp}</p>
            </div>
        </div>

        <div className="border-2 border-slate-900 p-3 rounded-md bg-slate-50 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5 border-b md:border-b-0 md:border-r border-slate-200 pb-3 md:pb-0 md:pr-6">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Stock Summary</h3>
                    <div className="flex justify-between text-[13px]"><span>Bags In (Total History):</span><span className="font-mono font-bold">{totals.totalBagsIn}</span></div>
                    <div className="flex justify-between text-[13px]"><span>Bags Out (Total History):</span><span className="font-mono font-bold">{totals.totalBagsOut}</span></div>
                    <div className="flex justify-between items-center border-t border-slate-300 pt-1.5 mt-1.5 text-primary font-black">
                        <span className="uppercase text-[11px]">Current Godown Stock:</span>
                        <span className="font-mono text-lg">{totals.balanceStock}</span>
                    </div>
                </div>

                <div className="space-y-2 md:pl-2">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Financial Summary</h3>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[12px]">
                        <div className="space-y-0.5 border-r pr-2">
                            <p className="uppercase text-[9px] font-bold text-slate-400">Hamali Status</p>
                            <div className="flex justify-between"><span>Billed:</span><span className="font-mono">{formatCurrency(totals.totalHamaliBilled)}</span></div>
                            <div className="flex justify-between text-green-700"><span>Paid:</span><span className="font-mono">{formatCurrency(totals.totalHamaliPaid)}</span></div>
                            <div className="flex justify-between font-bold border-t pt-0.5 text-orange-600"><span>Due:</span><span className="font-mono">{formatCurrency(totals.hamaliBalance)}</span></div>
                        </div>
                        <div className="space-y-0.5">
                            <p className="uppercase text-[9px] font-bold text-slate-400">Rent Status</p>
                            <div className="flex justify-between"><span>Billed:</span><span className="font-mono">{formatCurrency(totals.totalRentBilled)}</span></div>
                            <div className="flex justify-between text-green-700"><span>Paid:</span><span className="font-mono">{formatCurrency(totals.totalRentPaid)}</span></div>
                            <div className="flex justify-between font-bold border-t pt-0.5 text-blue-600"><span>Due:</span><span className="font-mono">{formatCurrency(totals.rentBalance)}</span></div>
                        </div>
                    </div>
                    <div className="flex justify-between items-center border-t-2 border-slate-900 pt-1.5 mt-1.5 text-destructive font-black">
                        <span className="uppercase text-[11px]">Total Balance Due:</span>
                        <span className="font-mono text-lg">{formatCurrency(totals.finalBalance)}</span>
                    </div>
                </div>
            </div>
        </div>

        <div className="table-scroll-container border-y-2 border-black">
            <Table className="w-full text-[13px]">
                <TableHeader>
                    <TableRow className="border-b border-black bg-slate-50">
                        <TableHead className="font-bold text-black border-r border-slate-200 text-center p-2 uppercase text-[9px]">Date</TableHead>
                        <TableHead className="font-bold text-black border-r border-slate-200 p-2 uppercase text-[9px]">Description</TableHead>
                        <TableHead className="font-bold text-black border-r border-slate-200 text-center p-2 uppercase text-[9px]">Ref ID</TableHead>
                        <TableHead className="font-bold text-black border-r border-slate-200 text-center p-2 uppercase text-[9px]">Lot</TableHead>
                        <TableHead className="font-bold text-black border-r border-slate-200 text-center p-2 uppercase text-[9px]">In</TableHead>
                        <TableHead className="font-bold text-black border-r border-slate-200 text-center p-2 uppercase text-[9px]">Out</TableHead>
                        <TableHead className="font-bold text-black border-r border-slate-200 text-right p-2 uppercase text-[9px]">Hamali (+)</TableHead>
                        <TableHead className="font-bold text-black border-r border-slate-200 text-right p-2 uppercase text-[9px]">Rent (+)</TableHead>
                        <TableHead className="font-bold text-black border-r border-slate-200 text-right p-2 uppercase text-[9px]">Paid (-)</TableHead>
                        <TableHead className="font-bold text-black text-right p-2 uppercase text-[9px]">Balance</TableHead>
                        <TableHead className="font-bold text-black text-right p-2 uppercase text-[9px] print-hide">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {lineItems.map((item, index) => (
                        <TableRow key={index} className="border-b border-slate-100 h-8 hover:bg-slate-50/50">
                            <TableCell className="p-1 text-center whitespace-nowrap">{format(item.date, 'dd/MM/yy')}</TableCell>
                            <TableCell className="p-1 font-medium">{item.description}</TableCell>
                            <TableCell className="p-1 text-center font-mono text-slate-400">{item.billNo}</TableCell>
                            <TableCell className="p-1 text-center font-mono text-slate-600">{item.lotNo || '-'}</TableCell>
                            <TableCell className="p-1 text-center font-mono">{item.bagsIn || ''}</TableCell>
                            <TableCell className="p-1 text-center font-mono">{item.bagsOut || ''}</TableCell>
                            <TableCell className="p-1 text-right font-mono">{item.hamali > 0 ? formatCurrency(item.hamali) : ''}</TableCell>
                            <TableCell className="p-1 text-right font-mono">{item.rent > 0 ? formatCurrency(item.rent) : ''}</TableCell>
                            <TableCell className="p-1 text-right font-mono text-green-700 font-bold">{item.credit > 0 ? formatCurrency(item.credit) : ''}</TableCell>
                            <TableCell className="p-1 text-right font-mono font-black">{formatCurrency(item.balance)}</TableCell>
                            <TableCell className="p-1 text-right print-hide">{renderActions(item)}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
                <TableFooter>
                    <TableRow className="bg-slate-100 font-black border-t-2 border-black h-10">
                        <TableCell colSpan={4} className="p-2 text-right uppercase text-[9px] tracking-tight">Totals</TableCell>
                        <TableCell className="p-2 text-center font-mono">{totals.totalBagsIn}</TableCell>
                        <TableCell className="p-2 text-center font-mono">{totals.totalBagsOut}</TableCell>
                        <TableCell className="p-2 text-right font-mono">{formatCurrency(totals.totalHamaliBilled)}</TableCell>
                        <TableCell className="p-2 text-right font-mono">{formatCurrency(totals.totalRentBilled)}</TableCell>
                        <TableCell className="p-2 text-right font-mono text-green-800">{formatCurrency(totals.totalCredit)}</TableCell>
                        <TableCell className="p-2 text-right font-mono text-[14px]">{formatCurrency(totals.finalBalance)}</TableCell>
                        <TableCell className="print-hide" />
                    </TableRow>
                </TableFooter>
            </Table>
        </div>

        <div className="mt-16 flex justify-end">
            <div className="w-64 border-t-2 border-black text-center pt-2">
                <p className="font-black text-[12px] uppercase tracking-widest text-slate-800">Authorized Manager Signature</p>
                <p className="text-[10px] text-slate-400 mt-1 uppercase">Audit Division</p>
            </div>
        </div>
    </div>
  );
});

CustomerStatement.displayName = 'CustomerStatement';