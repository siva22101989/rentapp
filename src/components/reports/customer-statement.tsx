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
    
    // 1. Process Unloading Records (Charges and Payments)
    (unloadingRecords || []).forEach(unloading => {
        const remainingBags = Math.max(0, (unloading.bagsUnloaded || 0) - (unloading.bagsSentToDrying || 0));
        const remainingHamali = remainingBags * (unloading.hamaliPerBag || 0);

        if (remainingHamali > 0) {
            events.push({
                date: toDate(unloading.unloadingDate),
                description: `Unloading - ${unloading.commodityDescription}`,
                invoiceId: unloading.billNo || unloading.id,
                bagsIn: remainingBags,
                bagsOut: 0,
                hamali: remainingHamali,
                rent: 0,
                credit: 0,
            });
        }

        (unloading.payments || []).forEach(payment => {
            events.push({
                date: toDate(payment.date),
                description: `Payment (Unloading #${unloading.billNo})`,
                invoiceId: unloading.billNo || unloading.id,
                bagsIn: 0,
                bagsOut: 0,
                hamali: 0,
                rent: 0,
                credit: payment.amount || 0,
            });
        });
    });

    // 2. Process Storage Records (Inflow, Outflow, Payments)
    (records || []).forEach(record => {
        // Inflow Line Item
        const inflowDebit = (record.hamaliPayable || 0) + (record.khataAmount || 0);
        events.push({
            date: toDate(record.storageStartDate),
            description: `Inflow - ${record.commodityDescription}`,
            invoiceId: record.id,
            bagsIn: record.bagsIn,
            bagsOut: 0,
            hamali: inflowDebit,
            rent: 0,
            credit: 0,
        });

        // Outflow Line Items
        if (Array.isArray(record.outflows)) {
            record.outflows.forEach((outflow, idx) => {
                const deliveryNo = record.outflows && record.outflows.length > 1 ? `${record.id}-${idx + 1}` : record.id;
                events.push({
                    date: toDate(outflow.date),
                    description: `Outflow`,
                    invoiceId: deliveryNo,
                    bagsIn: 0,
                    bagsOut: outflow.bagsWithdrawn,
                    hamali: 0,
                    rent: outflow.rentBilled || 0,
                    credit: outflow.discount || 0, // Discounts count as credits against balance
                });
            });
        }

        // Standard Payments
        (record.payments || []).forEach(payment => {
            events.push({
                date: toDate(payment.date),
                description: `Payment (Storage ID #${record.id})`,
                invoiceId: record.id,
                bagsIn: 0,
                bagsOut: 0,
                hamali: 0,
                rent: 0,
                credit: payment.amount || 0,
            });
        });
    });
    
    // Sort all events chronologically
    const sortedEvents = events.sort((a, b) => a.date.getTime() - b.date.getTime());

    let runningBalance = 0;
    let totalBagsIn = 0;
    let totalBagsOut = 0;
    let totalHamali = 0;
    let totalRent = 0;
    let totalCredit = 0;

    const lineItems = sortedEvents.map(event => {
        runningBalance += (event.hamali + event.rent) - event.credit;
        
        totalBagsIn += event.bagsIn;
        totalBagsOut += event.bagsOut;
        totalHamali += event.hamali;
        totalRent += event.rent;
        totalCredit += event.credit;

        return { ...event, balance: runningBalance };
    }).reverse(); // Most recent at the top for viewing, though chronological for balance
    
    const totals = { totalBagsIn, totalBagsOut, totalHamali, totalRent, totalCredit, finalBalance: runningBalance };

    return { lineItems, totals };

  }, [records, unloadingRecords]);
  
  const generatedDate = useMemo(() => format(new Date(), 'dd MMM yyyy, hh:mm a'), []);

  return (
    <div ref={ref} className="bg-white p-4 sm:p-8 printable-area text-foreground font-sans text-xs">
        <header className="text-center mb-6">
            <h1 className="text-2xl font-bold text-primary uppercase tracking-wider mb-1">SRI LAKSHMI WAREHOUSE</h1>
            <p className="text-sm text-muted-foreground">{warehouseInfo?.addressLine1 || ''} {warehouseInfo?.addressLine2 || ''} | Cell: {warehouseInfo?.phone || ''}</p>
            <h2 className="text-lg font-bold mt-4 underline uppercase">Statement of Account</h2>
        </header>

        <div className="flex justify-between items-end mb-6 border-b pb-4">
             <div className="space-y-1">
                <p className="text-[10px] text-muted-foreground font-bold uppercase">Customer Details:</p>
                <p className="font-bold text-lg text-slate-900">{customer.name}</p>
                {customer.fatherName && <p className="text-sm font-medium">S/O: {customer.fatherName}</p>}
                <p className="text-sm">{customer.village || 'N/A'}</p>
                <p className="text-sm">{customer.phone}</p>
            </div>
            <div className="text-right space-y-1">
                 <p className="text-sm"><span className="font-bold">Date:</span> {format(new Date(), 'dd/MM/yyyy')}</p>
                 <div className="mt-2 p-2 bg-slate-900 text-white rounded text-center">
                    <p className="text-[10px] uppercase font-bold opacity-80">Final Balance Due</p>
                    <p className="text-lg font-bold font-mono">{formatCurrency(totals.finalBalance)}</p>
                 </div>
            </div>
        </div>

        <div className="overflow-hidden border rounded-lg shadow-sm mb-8">
            <Table className="w-full border-collapse">
                <TableHeader>
                    <TableRow className="bg-[#3498db] hover:bg-[#3498db] border-none">
                        <TableHead className="text-white font-bold h-10 border-r border-white/20">Date</TableHead>
                        <TableHead className="text-white font-bold h-10 border-r border-white/20">Description</TableHead>
                        <TableHead className="text-white font-bold h-10 border-r border-white/20">Invoice No</TableHead>
                        <TableHead className="text-white font-bold h-10 border-r border-white/20 text-right">Bags In</TableHead>
                        <TableHead className="text-white font-bold h-10 border-r border-white/20 text-right">Bags Out</TableHead>
                        <TableHead className="text-white font-bold h-10 border-r border-white/20 text-right">Hamali</TableHead>
                        <TableHead className="text-white font-bold h-10 border-r border-white/20 text-right">Rent</TableHead>
                        <TableHead className="text-white font-bold h-10 border-r border-white/20 text-right">Credit</TableHead>
                        <TableHead className="text-white font-bold h-10 text-right">Balance</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {lineItems.map((item, index) => (
                        <TableRow key={index} className="border-b hover:bg-slate-50/50 odd:bg-slate-50/20">
                            <TableCell className="py-2 whitespace-nowrap border-r">{format(item.date, 'dd/MM/yyyy')}</TableCell>
                            <TableCell className="py-2 font-medium border-r">{item.description}</TableCell>
                            <TableCell className="py-2 font-mono border-r">{item.invoiceId}</TableCell>
                            <TableCell className="py-2 text-right border-r font-mono">{item.bagsIn || ''}</TableCell>
                            <TableCell className="py-2 text-right border-r font-mono">{item.bagsOut || ''}</TableCell>
                            <TableCell className="py-2 text-right border-r font-mono">{item.hamali > 0 ? formatCurrency(item.hamali) : ''}</TableCell>
                            <TableCell className="py-2 text-right border-r font-mono">{item.rent > 0 ? formatCurrency(item.rent) : ''}</TableCell>
                            <TableCell className="py-2 text-right border-r font-mono text-green-700">{item.credit > 0 ? formatCurrency(item.credit) : ''}</TableCell>
                            <TableCell className="py-2 text-right font-mono font-bold">{formatCurrency(item.balance)}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
                 <TableFooter>
                    <TableRow className="bg-slate-100 hover:bg-slate-100 font-bold border-t-2 border-slate-300">
                        <TableCell colSpan={3} className="text-right uppercase">Closing Totals:</TableCell>
                        <TableCell className="text-right font-mono">{totals.totalBagsIn}</TableCell>
                        <TableCell className="text-right font-mono">{totals.totalBagsOut}</TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(totals.totalHamali)}</TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(totals.totalRent)}</TableCell>
                        <TableCell className="text-right font-mono text-green-700">{formatCurrency(totals.totalCredit)}</TableCell>
                        <TableCell className="text-right font-mono text-destructive text-sm">{formatCurrency(totals.finalBalance)}</TableCell>
                    </TableRow>
                 </TableFooter>
            </Table>
        </div>
        
        <div className="mt-16 flex flex-col items-end text-center space-y-1">
            <div className="w-72 border-t border-slate-400 pt-4">
                <p className="text-[#1e293b] font-bold text-xs uppercase tracking-wider">AUTHORIZED MANAGER SIGNATURE</p>
                <p className="text-primary font-bold text-[10px] uppercase mt-1">SRI LAKSHMI WAREHOUSE</p>
            </div>
            <div className="text-[9px] text-slate-500 italic mt-6 space-y-0.5">
                <p>Report validity verified on {generatedDate}</p>
                <p>This is a computer generated statement.</p>
            </div>
        </div>
    </div>
  );
});

CustomerStatement.displayName = 'CustomerStatement';
