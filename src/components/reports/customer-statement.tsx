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
    records = [], 
    unloadingRecords = [], 
    warehouseInfo,
    allRecords = [],
    commodities = [],
    lots = [],
    customers = []
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
            events.push({
                date: toDate(unloading.unloadingDate),
                description: `Inflow (Unloading) - ${unloading.commodityDescription || 'Misc'}`,
                billNo: cleanId,
                lotNo: unloading.location || 'N/A',
                bagsIn: bags,
                bagsOut: 0,
                hamali: totalHamali,
                rent: 0,
                credit: 0,
                sortDate: toDate(unloading.unloadingDate).getTime(),
                recordType: 'unloading',
                sourceRecord: unloading,
            });
        }

        if (Array.isArray(unloading.payments)) {
            unloading.payments.forEach((payment, pIdx) => {
                const amt = Number(payment.amount) || 0;
                totalHamaliPaid += amt;
                events.push({
                    date: toDate(payment.date),
                    description: getPaymentDesc(payment.type, 'unloading'),
                    billNo: cleanId,
                    lotNo: '', 
                    bagsIn: 0,
                    bagsOut: 0,
                    hamali: 0,
                    rent: 0,
                    credit: amt,
                    sortDate: toDate(payment.date).getTime() + pIdx,
                    recordType: 'payment',
                    paymentType: 'unloading',
                    paymentIndex: pIdx,
                    sourceRecord: unloading,
                    paymentData: payment
                });
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
        
        events.push({
            date: toDate(record.storageStartDate),
            description: `Inflow (Godown) - ${record.commodityDescription || 'Misc'}`,
            billNo: cleanId,
            lotNo: record.location || 'N/A',
            bagsIn: inflowBags,
            bagsOut: 0,
            hamali: hamaliBilledOnInflow,
            rent: 0,
            credit: 0,
            sortDate: toDate(record.storageStartDate).getTime(),
            recordType: 'storage',
            sourceRecord: record,
        });
        
        if (record.khataAmount && record.khataAmount > 0) {
            const khata = Number(record.khataAmount);
            totalRentBilled += khata;
            events.push({
                date: toDate(record.storageStartDate),
                description: `Khata Income (Weighbridge)`,
                billNo: cleanId,
                lotNo: '', 
                bagsIn: 0,
                bagsOut: 0,
                hamali: 0,
                rent: khata,
                credit: 0,
                sortDate: toDate(record.storageStartDate).getTime() + 2,
                recordType: 'storage',
                sourceRecord: record,
            });
        }

        // Process Outflows with Consolidation Logic
        const outflowGroups: Record<string, any> = {};
        if (Array.isArray(record.outflows)) {
            record.outflows.forEach((outflow, idx) => {
                const pattiNoRaw = String(outflow.pattiNo || '').replace(/\D/g, '');
                const displayId = pattiNoRaw || cleanId; // Fallback to Inflow ID if Outflow Bill No is missing

                const rentVal = Number(outflow.rentBilled) || 0;
                const withdrawn = Number(outflow.bagsWithdrawn) || 0;
                
                totalRentBilled += rentVal;
                totalBagsOut += withdrawn;

                // Grouping by Bill No for consolidated rows
                if (outflowGroups[displayId]) {
                    outflowGroups[displayId].bagsOut += withdrawn;
                    outflowGroups[displayId].rent += rentVal;
                    if (record.location && !outflowGroups[displayId].lotNo.includes(record.location)) {
                        outflowGroups[displayId].lotNo = outflowGroups[displayId].lotNo === 'Multiple' ? 'Multiple' : 'Multiple';
                    }
                } else {
                    outflowGroups[displayId] = {
                        date: toDate(outflow.date),
                        description: `Outflow Withdrawal`,
                        billNo: displayId,
                        lotNo: record.location || 'N/A',
                        bagsIn: 0,
                        bagsOut: withdrawn,
                        hamali: 0,
                        rent: rentVal,
                        credit: 0,
                        sortDate: toDate(outflow.date).getTime() + 3 + idx,
                        recordType: 'outflow',
                        sourceRecord: record,
                        outflowData: outflow,
                        outflowIndex: idx,
                    };
                }
            });
        }
        Object.values(outflowGroups).forEach(og => events.push(og));

        if (Array.isArray(record.payments)) {
            record.payments.forEach((payment, pIdx) => {
                const amt = Number(payment.amount) || 0;
                const isHamali = payment.type === 'hamali' || payment.type === 'unloading';
                if (isHamali) totalHamaliPaid += amt;
                else totalRentPaid += amt;

                events.push({
                    date: toDate(payment.date),
                    description: getPaymentDesc(payment.type, 'storage'),
                    billNo: cleanId,
                    lotNo: '', 
                    bagsIn: 0,
                    bagsOut: 0,
                    hamali: 0,
                    rent: 0,
                    credit: amt,
                    sortDate: toDate(payment.date).getTime() + 5 + pIdx,
                    recordType: 'payment',
                    paymentType: 'storage',
                    paymentIndex: pIdx,
                    sourceRecord: record,
                    paymentData: payment
                });
            });
        }
    });
    
    const sortedEvents = (events || []).sort((a, b) => (a.sortDate || 0) - (b.sortDate || 0));

    let runningBalance = 0;
    const lineItems = sortedEvents.map(event => {
        const debit = (Number(event.hamali) || 0) + (Number(event.rent) || 0);
        const credit = Number(event.credit) || 0;
        runningBalance += (debit - credit);
        return { ...event, balance: runningBalance };
    });
    
    return { 
        lineItems, 
        totals: { 
            totalBagsIn, 
            totalBagsOut, 
            balanceStock: Math.max(0, totalBagsIn - totalBagsOut), 
            totalHamaliBilled, 
            totalHamaliPaid,
            hamaliBalance: Math.max(0, totalHamaliBilled - totalHamaliPaid),
            totalRentBilled, 
            totalRentPaid,
            rentBalance: Math.max(0, totalRentBilled - totalRentPaid),
            totalCredit: totalHamaliPaid + totalRentPaid, 
            finalBalance: Math.max(0, runningBalance)
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
                <p><span className="font-bold uppercase text-[10px] text-slate-500">Customer:</span> <span className="font-bold text-base">{customer?.name}</span></p>
                <p><span className="font-bold uppercase text-[10px] text-slate-500">Father's Name:</span> {customer?.fatherName || 'N/A'}</p>
                <p><span className="font-bold uppercase text-[10px] text-slate-500">Village:</span> {customer?.village || 'N/A'}</p>
                <p><span className="font-bold uppercase text-[10px] text-slate-500">Phone No:</span> {customer?.phone || 'N/A'}</p>
            </div>
            <div className="sm:text-right text-[10px] text-slate-400 font-bold uppercase">
                <p>Audit Generation: {timestamp}</p>
            </div>
        </div>

        <div className="border-2 border-slate-900 p-4 rounded-xl bg-slate-50 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2 border-b md:border-b-0 md:border-r border-slate-200 pb-3 md:pb-0 md:pr-10">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2">Physical Stock Inventory</h3>
                    <div className="flex justify-between text-[13px]"><span>Total Inflow (History):</span><span className="font-mono font-bold">{totals.totalBagsIn}</span></div>
                    <div className="flex justify-between text-[13px]"><span>Total Outflow:</span><span className="font-mono font-bold text-orange-600">{totals.totalBagsOut}</span></div>
                    <div className="flex justify-between items-center border-t border-slate-300 pt-2 mt-2 text-primary font-black">
                        <span className="uppercase text-[11px] tracking-wider">Current Godown Balance:</span>
                        <span className="font-mono text-xl underline underline-offset-4 decoration-primary/30">{totals.balanceStock}</span>
                    </div>
                </div>

                <div className="space-y-3 md:pl-2">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-1">Financial Reconciliation</h3>
                    <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-[12px]">
                        <div className="space-y-0.5 border-r border-slate-100 pr-4">
                            <p className="uppercase text-[9px] font-bold text-slate-400">Hamali (Handling)</p>
                            <div className="flex justify-between"><span>Billed:</span><span className="font-mono">{formatCurrency(totals.totalHamaliBilled)}</span></div>
                            <div className="flex justify-between text-green-700"><span>Paid:</span><span className="font-mono">{formatCurrency(totals.totalHamaliPaid)}</span></div>
                            <div className="flex justify-between font-bold border-t pt-0.5 text-orange-600"><span>Due:</span><span className="font-mono">{formatCurrency(totals.hamaliBalance)}</span></div>
                        </div>
                        <div className="space-y-0.5">
                            <p className="uppercase text-[9px] font-bold text-slate-400">Warehouse Rent</p>
                            <div className="flex justify-between"><span>Billed:</span><span className="font-mono">{formatCurrency(totals.totalRentBilled)}</span></div>
                            <div className="flex justify-between text-green-700"><span>Paid:</span><span className="font-mono">{formatCurrency(totals.totalRentPaid)}</span></div>
                            <div className="flex justify-between font-bold border-t pt-0.5 text-blue-600"><span>Due:</span><span className="font-mono">{formatCurrency(totals.rentBalance)}</span></div>
                        </div>
                    </div>
                    <div className="flex justify-between items-center border-t-2 border-slate-900 pt-2 mt-2 text-destructive font-black">
                        <span className="uppercase text-[11px] tracking-widest">Total Outstanding Due:</span>
                        <span className="font-mono text-xl">{formatCurrency(totals.finalBalance)}</span>
                    </div>
                </div>
            </div>
        </div>

        <div className="table-scroll-container border-y-2 border-black">
            <Table className="w-full text-[13px]">
                <TableHeader>
                    <TableRow className="border-b border-black bg-slate-50 h-10">
                        <TableHead className="font-bold text-black border-r border-slate-200 text-center p-2 uppercase text-[9px]">Date</TableHead>
                        <TableHead className="font-bold text-black border-r border-slate-200 p-2 uppercase text-[9px]">Description</TableHead>
                        <TableHead className="font-bold text-black border-r border-slate-200 text-center p-2 uppercase text-[9px]">Bill No</TableHead>
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
                    {lineItems.map((item, index) => {
                        const viewBillLink = item.recordType === 'outflow' && item.billNo 
                            ? `/outflow/receipt?pattiNo=${item.billNo}` 
                            : null;

                        return (
                            <TableRow key={index} className="border-b border-slate-100 h-9 hover:bg-slate-50/50">
                                <TableCell className="p-1 text-center whitespace-nowrap">{format(item.date, 'dd/MM/yy')}</TableCell>
                                <TableCell className="p-1 font-medium tracking-tight">{item.description}</TableCell>
                                <TableCell className="p-1 text-center font-mono font-bold text-slate-400">
                                    {viewBillLink ? (
                                        <a href={viewBillLink} target="_blank" className="text-primary hover:underline">{item.billNo}</a>
                                    ) : item.billNo}
                                </TableCell>
                                <TableCell className="p-1 text-center font-mono text-slate-600">{item.lotNo || ''}</TableCell>
                                <TableCell className="p-1 text-center font-mono">{item.bagsIn || ''}</TableCell>
                                <TableCell className="p-1 text-center font-mono text-orange-600 font-bold">{item.bagsOut || ''}</TableCell>
                                <TableCell className="p-1 text-right font-mono">{item.hamali > 0 ? formatCurrency(item.hamali) : ''}</TableCell>
                                <TableCell className="p-1 text-right font-mono">{item.rent > 0 ? formatCurrency(item.rent) : ''}</TableCell>
                                <TableCell className="p-1 text-right font-mono text-green-700 font-black">{item.credit > 0 ? formatCurrency(item.credit) : ''}</TableCell>
                                <TableCell className="p-1 text-right font-mono font-black">{formatCurrency(item.balance)}</TableCell>
                                <TableCell className="p-1 text-right print-hide">
                                    {item.recordType === 'storage' && <ActionsMenu record={item.sourceRecord} customers={customers} allRecords={allRecords} />}
                                    {item.recordType === 'unloading' && <UnloadingTableActionsMenu record={{...item.sourceRecord, hamaliPending: 0}} customers={customers} commodities={commodities} lots={lots} storageRecords={allRecords} />}
                                    {item.recordType === 'outflow' && <OutflowActionsMenu record={item.sourceRecord} customer={customer} warehouseInfo={warehouseInfo} outflow={item.outflowData} outflowIndex={item.outflowIndex} deliveryOrderNo={item.billNo} deliveryOrderDate={item.date} commodities={commodities} lots={lots} allRecords={allRecords} />}
                                    {item.recordType === 'payment' && <PaymentActionsMenu event={{ date: item.date, customerId: customer.id, description: item.description, recordId: String(item.sourceRecord.id || item.sourceRecord.billNo || ''), amount: item.credit, type: (item.paymentData?.type || 'other') as PaymentType, recordType: item.paymentType, paymentIndex: item.paymentIndex }} />}
                                </TableCell>
                            </TableRow>
                        );
                    })}
                </TableBody>
                <TableFooter>
                    <TableRow className="bg-slate-900 text-white font-black border-t-2 border-black h-12">
                        <TableCell colSpan={4} className="p-2 text-right uppercase text-[10px] tracking-[0.2em]">Audit Grand Totals</TableCell>
                        <TableCell className="p-2 text-center font-mono">{totals.totalBagsIn}</TableCell>
                        <TableCell className="p-2 text-center font-mono text-orange-400">{totals.totalBagsOut}</TableCell>
                        <TableCell className="p-2 text-right font-mono">{formatCurrency(totals.totalHamaliBilled)}</TableCell>
                        <TableCell className="p-2 text-right font-mono">{formatCurrency(totals.totalRentBilled)}</TableCell>
                        <TableCell className="p-2 text-right font-mono text-green-400">{formatCurrency(totals.totalCredit)}</TableCell>
                        <TableCell className="p-2 text-right font-mono text-base">{formatCurrency(totals.finalBalance)}</TableCell>
                        <TableCell className="print-hide" />
                    </TableRow>
                </TableFooter>
            </Table>
        </div>

        <div className="mt-20 flex justify-between">
             <div className="w-64 border-t border-slate-300 text-center pt-2">
                <p className="font-bold text-[11px] uppercase tracking-widest text-slate-500">Customer Acknowledgment</p>
            </div>
            <div className="w-64 border-t-2 border-black text-center pt-2">
                <p className="font-black text-[12px] uppercase tracking-widest text-slate-800">Authorized Auditor Signature</p>
                <p className="text-[10px] text-slate-400 mt-1 uppercase">Operations Division</p>
            </div>
        </div>
    </div>
  );
});

CustomerStatement.displayName = 'CustomerStatement';
