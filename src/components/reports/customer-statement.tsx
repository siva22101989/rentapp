'use client';

import { useMemo, forwardRef } from 'react';
import type { Customer, StorageRecord, UnloadingRecord, WarehouseInfo } from '@/lib/definitions';
import { formatCurrency, toDate } from '@/lib/utils';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '../ui/table';
import { Card, CardContent } from '../ui/card';
import { format } from 'date-fns';
import { Separator } from '../ui/separator';

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
        // Inflow Entry
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

        // Outflow Entries - Explicitly using record.id as the "Inflow Bill No"
        if (Array.isArray(record.outflows)) {
            record.outflows.forEach((outflow, idx) => {
                events.push({
                    date: toDate(outflow.date),
                    description: `Outflow from Bill #${record.id}`,
                    invoiceId: record.id, 
                    bagsIn: 0,
                    bagsOut: outflow.bagsWithdrawn,
                    hamali: 0,
                    rent: outflow.rentBilled || 0,
                    credit: outflow.discount || 0,
                });
            });
        }

        // Payments linked to this Storage Record
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
    
    // Sort events by date, then by Invoice ID for consistency
    const sortedEvents = events.sort((a, b) => {
        const dateDiff = a.date.getTime() - b.date.getTime();
        if (dateDiff !== 0) return dateDiff;
        return a.invoiceId.localeCompare(b.invoiceId);
    });

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
    });
    
    const totals = { totalBagsIn, totalBagsOut, totalHamali, totalRent, totalCredit, finalBalance: runningBalance };

    return { lineItems, totals };

  }, [records, unloadingRecords]);
  
  const generatedTimestamp = useMemo(() => format(new Date(), 'dd/MM/yyyy, hh:mm:ss a'), []);

  return (
    <div ref={ref} className="bg-white p-4 sm:p-8 printable-area text-foreground font-sans text-xs">
        <header className="text-left mb-4">
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight uppercase">Sri Lakshmi WareHouse</h1>
            <p className="text-sm font-semibold text-muted-foreground mt-1">Statement of Account - {customer.name}</p>
            <p className="text-[10px] text-muted-foreground">Generated: {generatedTimestamp}</p>
            <Separator className="bg-[#3498db] h-[2px] mt-4" />
        </header>

        <div className="grid grid-cols-2 gap-8 mb-8 mt-6">
            <Card className="shadow-none border border-slate-200 bg-slate-50/30">
                <CardContent className="p-4 space-y-2">
                    <div className="flex justify-between items-center text-sm border-b border-slate-200 pb-1">
                        <span className="font-bold text-slate-700">Total Bags In:</span>
                        <span className="font-mono text-slate-900">{totals.totalBagsIn}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm border-b border-slate-200 pb-1">
                        <span className="font-bold text-slate-700">Total Bags Out:</span>
                        <span className="font-mono text-slate-900">{totals.totalBagsOut}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm font-bold text-slate-900 pt-1">
                        <span>Balance Stock:</span>
                        <span className="font-mono text-base">{totals.totalBagsIn - totals.totalBagsOut}</span>
                    </div>
                </CardContent>
            </Card>

            <Card className="shadow-none border border-slate-200 bg-slate-50/30">
                <CardContent className="p-4 space-y-2">
                    <div className="flex justify-between items-center text-sm border-b border-slate-200 pb-1">
                        <span className="font-bold text-slate-700">Total Hamali:</span>
                        <span className="font-mono text-slate-900">{formatCurrency(totals.totalHamali)}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm border-b border-slate-200 pb-1">
                        <span className="font-bold text-slate-700">Total Rent:</span>
                        <span className="font-mono text-slate-900">{formatCurrency(totals.totalRent)}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm border-b border-slate-200 pb-1">
                        <span className="font-bold text-slate-700">Total Paid:</span>
                        <span className="font-mono text-green-600">{formatCurrency(totals.totalCredit)}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm font-bold pt-1">
                        <span className="text-slate-900">Balance Due:</span>
                        <span className="font-mono text-destructive text-base">{formatCurrency(totals.finalBalance)}</span>
                    </div>
                </CardContent>
            </Card>
        </div>

        <div className="overflow-hidden border border-slate-300 rounded-sm">
            <Table className="w-full border-collapse">
                <TableHeader>
                    <TableRow className="bg-[#3498db] hover:bg-[#3498db] border-none h-9">
                        <TableHead className="text-white font-bold h-9 border border-slate-300 px-2 text-center uppercase">Date</TableHead>
                        <TableHead className="text-white font-bold h-9 border border-slate-300 px-2 text-center uppercase">Description</TableHead>
                        <TableHead className="text-white font-bold h-9 border border-slate-300 px-2 text-center uppercase">Bill No</TableHead>
                        <TableHead className="text-white font-bold h-9 border border-slate-300 px-2 text-center uppercase">Bags In</TableHead>
                        <TableHead className="text-white font-bold h-9 border border-slate-300 px-2 text-center uppercase">Bags Out</TableHead>
                        <TableHead className="text-white font-bold h-9 border border-slate-300 px-2 text-center uppercase">Hamali</TableHead>
                        <TableHead className="text-white font-bold h-9 border border-slate-300 px-2 text-center uppercase">Rent</TableHead>
                        <TableHead className="text-white font-bold h-9 border border-slate-300 px-2 text-center uppercase">Credit</TableHead>
                        <TableHead className="text-white font-bold h-9 border border-slate-300 px-2 text-center uppercase">Balance</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {lineItems.map((item, index) => (
                        <TableRow key={index} className="border-b border-slate-300 hover:bg-slate-50/50 odd:bg-slate-50/20 h-8">
                            <TableCell className="py-1 px-2 whitespace-nowrap border border-slate-300 text-center">{format(item.date, 'dd/MM/yyyy')}</TableCell>
                            <TableCell className="py-1 px-2 font-medium border border-slate-300 text-center">{item.description}</TableCell>
                            <TableCell className="py-1 px-2 font-mono border border-slate-300 text-center">{item.invoiceId}</TableCell>
                            <TableCell className="py-1 px-2 border border-slate-300 text-center font-mono">{item.bagsIn || ''}</TableCell>
                            <TableCell className="py-1 px-2 border border-slate-300 text-center font-mono">{item.bagsOut || ''}</TableCell>
                            <TableCell className="py-1 px-2 border border-slate-300 text-center font-mono">{item.hamali > 0 ? formatCurrency(item.hamali) : ''}</TableCell>
                            <TableCell className="py-1 px-2 border border-slate-300 text-center font-mono">{item.rent > 0 ? formatCurrency(item.rent) : ''}</TableCell>
                            <TableCell className="py-1 px-2 border border-slate-300 text-center font-mono text-green-700">{item.credit > 0 ? formatCurrency(item.credit) : ''}</TableCell>
                            <TableCell className="py-1 px-2 border border-slate-300 text-center font-mono font-bold">{formatCurrency(item.balance)}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
                 <TableFooter>
                    <TableRow className="bg-slate-100 hover:bg-slate-100 font-bold border-t-2 border-slate-400 h-9">
                        <TableCell colSpan={3} className="text-right border border-slate-300 uppercase px-2">Grand Total Portfolio:</TableCell>
                        <TableCell className="text-center border border-slate-300 font-mono px-2">{totals.totalBagsIn}</TableCell>
                        <TableCell className="text-center border border-slate-300 font-mono px-2">{totals.totalBagsOut}</TableCell>
                        <TableCell className="text-center border border-slate-300 font-mono px-2">{formatCurrency(totals.totalHamali)}</TableCell>
                        <TableCell className="text-center border border-slate-300 font-mono px-2">{formatCurrency(totals.totalRent)}</TableCell>
                        <TableCell className="text-center border border-slate-300 font-mono text-green-700 px-2">{formatCurrency(totals.totalCredit)}</TableCell>
                        <TableCell className="text-center border border-slate-300 font-mono text-destructive text-sm px-2">{formatCurrency(totals.finalBalance)}</TableCell>
                    </TableRow>
                 </TableFooter>
            </Table>
        </div>
        
        <div className="mt-16 flex flex-col items-end text-center space-y-1">
            <div className="w-72 border-t border-slate-400 pt-4">
                <p className="text-slate-800 font-bold text-[11px] uppercase tracking-wider">AUTHORIZED MANAGER SIGNATURE</p>
                <p className="text-[#3498db] font-bold text-[10px] uppercase mt-1">SRI LAKSHMI WAREHOUSE</p>
            </div>
            <div className="text-[9px] text-slate-500 italic mt-6 space-y-0.5">
                <p>Report validity verified on {format(new Date(), 'dd/MM/yyyy, hh:mm a')}</p>
                <p>This is a computer generated statement.</p>
            </div>
        </div>
    </div>
  );
});

CustomerStatement.displayName = 'CustomerStatement';
