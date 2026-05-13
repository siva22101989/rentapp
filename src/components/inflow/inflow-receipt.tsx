
'use client';

import React, { useState, useEffect } from 'react';
import type { Customer, StorageRecord, WarehouseInfo, UnloadingRecord } from '@/lib/definitions';
import { format, differenceInDays } from 'date-fns';
import { toDate, formatCurrency } from '@/lib/utils';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '../ui/table';


export const InflowReceipt = React.forwardRef<HTMLDivElement, { record: StorageRecord, customer: Customer, warehouseInfo: WarehouseInfo | null, unloadingRecord?: UnloadingRecord }>(({ record, customer, warehouseInfo, unloadingRecord }, ref) => {
    const [formattedDate, setFormattedDate] = useState('');
    const [dryingDays, setDryingDays] = useState<number | null>(null);
    
    useEffect(() => {
        if (record && record.storageStartDate) {
            const startDate = toDate(record.storageStartDate);
            setFormattedDate(format(startDate, 'dd/MM/yyyy'));
        }
        if (record?.inflowType === 'Plot' && record.dryingStartDate && record.dryingEndDate) {
            const start = toDate(record.dryingStartDate);
            const end = toDate(record.dryingEndDate);
            if (end >= start) {
                setDryingDays(differenceInDays(end, start) + 1);
            }
        }
    }, [record]);


    if (!record || !customer) {
        return (
            <div className="w-full max-w-2xl mx-auto bg-background p-4 sm:p-6">
                <p>Loading receipt...</p>
            </div>
        );
    }
    
    const hamaliRate = record.hamaliRate ?? (record.bagsIn > 0 ? record.hamaliPayable / record.bagsIn : 0);

    if (record.inflowType === 'Plot') {
        return (
            <div ref={ref} className="bg-white p-4 sm:p-6 border-2 border-black font-sans text-lg text-black">
                {/* Header */}
                <div className="text-center mb-4">
                    <h1 className="text-2xl font-bold tracking-wider">{warehouseInfo?.name || 'GrainDost'}</h1>
                    <p className="text-sm">{warehouseInfo?.addressLine1 || 'Survey No. 165,237/2, Owk - Koilakuntla Road, OWK - 518 122,'}</p>
                    <p className="text-sm">{warehouseInfo?.addressLine2 || 'Owk (M), Kurnool (Dt.), A.P.'} Cell: {warehouseInfo?.phone || '9703503423, 9160606633'}</p>
                    <h2 className="font-bold underline text-center mt-4 text-base">INFLOW BILL (FROM PLOT)</h2>
                </div>

                {/* Customer Details */}
                <div className="grid grid-cols-2 gap-x-4 mb-4 text-base">
                    <div>
                        <p><span className="font-bold">Bill No.:</span> {record.id}</p>
                        <p><span className="font-bold">Depositor Name:</span> {customer.name}</p>
                        <p><span className="font-bold">Address:</span> {customer.village || 'N/A'}</p>
                        <p><span className="font-bold">Phone:</span> {customer.phone || 'N/A'}</p>
                    </div>
                    <div className="text-right">
                        <p><span className="font-bold">Date:</span> {formattedDate}</p>
                    </div>
                </div>

                {/* Particulars Section */}
                <div className="border-y-2 border-black py-2 mb-4">
                    <h2 className="font-bold text-center mb-2 text-base">PARTICULARS OF DEPOSIT (FROM PLOT)</h2>
                    <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-base">
                        <p><span className="font-bold">1. Storage ID:</span> {record.id}</p>
                        <p><span className="font-bold">Storage Date:</span> {formattedDate}</p>
                        <p><span className="font-bold">Unloading Bill No.:</span> {unloadingRecord?.billNo || 'N/A'}</p>
                        <p><span className="font-bold">Unloading Date:</span> {unloadingRecord ? format(toDate(unloadingRecord.unloadingDate), 'dd/MM/yy') : 'N/A'}</p>
                        
                        <p className="col-span-2"><span className="font-bold">2. Commodity:</span> {record.commodityDescription}</p>
                        
                        <p><span className="font-bold">Unloaded Bags:</span> {unloadingRecord?.bagsUnloaded || 'N/A'}</p>
                        <p><span className="font-bold">Bags for Plot:</span> {record.bagsForDrying || 'N/A'}</p>
                        <p><span className="font-bold">Bags Packed (Stock):</span> {record.bagsIn}</p>
                        <p></p>
                        
                        <p><span className="font-bold">3. Godown No.:</span> {record.location || 'N/A'}</p>
                        <p><span className="font-bold">Lot No.:</span> {record.location || 'N/A'}</p>
                        
                         <p className="col-span-2"><span className="font-bold">Drying Period:</span> {record.dryingStartDate ? format(toDate(record.dryingStartDate), 'dd/MM/yy') : 'N/A'} to {record.dryingEndDate ? format(toDate(record.dryingEndDate), 'dd/MM/yy') : 'N/A'} ({dryingDays ?? 'N/A'} days)</p>
                    </div>
                </div>

                {/* Charges Table */}
                <Table className="text-lg">
                    <TableHeader>
                        <TableRow>
                            <TableHead className="text-black font-bold">PARTICULARS</TableHead>
                            <TableHead className="text-center text-black font-bold">Calculation</TableHead>
                            <TableHead className="text-right text-black font-bold">Amount</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {record.hamaliDetails && record.hamaliDetails.length > 0 ? (
                            record.hamaliDetails.map((item, index) => (
                                <TableRow key={index}>
                                    <TableCell className="py-1">{item.description}</TableCell>
                                    <TableCell className="text-center font-mono text-base py-1">{item.bags && item.rate ? `${item.bags} bags x ${formatCurrency(item.rate)}` : '-'}</TableCell>
                                    <TableCell className="text-right font-mono py-1">{formatCurrency(item.amount)}</TableCell>
                                </TableRow>
                            ))
                        ) : (
                            record.hamaliPayable > 0 ? (
                                <TableRow>
                                    <TableCell colSpan={2} className="py-1">Total Hamali Charges</TableCell>
                                    <TableCell className="text-right font-mono py-1">{formatCurrency(record.hamaliPayable)}</TableCell>
                                </TableRow>
                            ) : null
                        )}
                    </TableBody>
                    <TableFooter>
                        <TableRow className="font-bold border-t-2 border-black">
                            <TableCell colSpan={2} className="text-right">TOTAL HAMALI</TableCell>
                            <TableCell className="text-right font-mono">{formatCurrency(record.hamaliPayable)}</TableCell>
                        </TableRow>
                    </TableFooter>
                </Table>

                {/* Signatures */}
                <div className="mt-16 pt-8 flex justify-between text-center">
                    <div className="w-1/2">
                        <div className="mt-12 border-t border-gray-400 mx-4 pt-1">Depositor Signature</div>
                    </div>
                    <div className="w-1/2">
                        <div className="mt-12 border-t border-gray-400 mx-4 pt-1">Authorized Manager Signature</div>
                        <p className="text-xs mt-1">For {warehouseInfo?.name || 'GrainDost'}</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div ref={ref} className="bg-white p-4 sm:p-6 border-2 border-black font-sans text-lg text-black">
            {/* Header */}
            <div className="text-center mb-4">
                <h1 className="text-2xl font-bold tracking-wider">{warehouseInfo?.name || 'GrainDost'}</h1>
                <p className="text-sm">{warehouseInfo?.addressLine1 || 'Survey No. 165,237/2, Owk - Koilakuntla Road, OWK - 518 122,'}</p>
                <p className="text-sm">{warehouseInfo?.addressLine2 || 'Owk (M), Kurnool (Dt.), A.P.'} Cell: {warehouseInfo?.phone || '9703503423, 9160606633'}</p>
                 <h2 className="font-bold underline text-center mt-4 text-lg">INFLOW BILL</h2>
            </div>
    
            {/* Customer Details */}
            <div className="grid grid-cols-2 gap-x-4 mb-4 text-base">
                <div>
                    <p><span className="font-bold">Storage ID:</span> {record.id}</p>
                    <p><span className="font-bold">Depositor Name:</span> {customer.name}</p>
                    <p><span className="font-bold">Address:</span> {customer.village || 'N/A'}</p>
                    <p><span className="font-bold">Phone:</span> {customer.phone || 'N/A'}</p>
                </div>
                <div className="text-right">
                    <p><span className="font-bold">Date:</span> {formattedDate}</p>
                </div>
            </div>
    
            {/* Particulars Section */}
            <div className="border-y-2 border-black py-2 mb-4">
                <h2 className="font-bold text-center mb-2 text-base">PARTICULARS OF DEPOSIT</h2>
                <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-base">
                    <p><span className="font-bold">1. Storage ID:</span> {record.id}</p>
                    <p><span className="font-bold">Date:</span> {formattedDate}</p>
                    <p><span className="font-bold">2. Commodity:</span> {record.commodityDescription}</p>
                    <p><span className="font-bold">Quantity:</span> {record.weight ? `${record.weight} Kgs` : 'N/A'}</p>
                    <p><span className="font-bold">No. of Bags:</span> {record.bagsIn}</p>
                    <p><span className="font-bold">Net Weight:</span> {record.weight ? `${record.weight} Kgs` : 'N/A'}</p>
                    <p><span className="font-bold">3. Godown No.:</span> {record.location || 'N/A'}</p>
                    <p><span className="font-bold">Lot No.:</span> {record.location || 'N/A'}</p>
                    <p><span className="font-bold">4. Lorry/Tractor No.:</span> {record.lorryTractorNo || 'N/A'}</p>
                </div>
            </div>
            
            {/* Charges Table */}
            <Table className="text-lg">
                 <TableHeader>
                    <TableRow>
                        <TableHead className="text-black font-bold">PARTICULARS</TableHead>
                        <TableHead className="text-center text-black font-bold">Calculation</TableHead>
                        <TableHead className="text-right text-black font-bold">Amount</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                     {record.hamaliPayable > 0 && (
                        <TableRow>
                            <TableCell>1. Unloading Charges (Hamali)</TableCell>
                            <TableCell className="text-center font-mono text-base">{record.bagsIn} bags x {formatCurrency(hamaliRate)}</TableCell>
                            <TableCell className="text-right font-mono">{formatCurrency(record.hamaliPayable)}</TableCell>
                        </TableRow>
                    )}
                    {record.khataAmount && record.khataAmount > 0 && (
                        <TableRow>
                            <TableCell>2. Khata (Weighbridge) Charges</TableCell>
                             <TableCell></TableCell>
                            <TableCell className="text-right font-mono">{formatCurrency(record.khataAmount)}</TableCell>
                        </TableRow>
                    )}
                </TableBody>
                <TableFooter>
                    <TableRow className="font-bold border-t-2 border-black">
                        <TableCell colSpan={2} className="text-right">TOTAL</TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency((record.hamaliPayable || 0) + (record.khataAmount || 0))}</TableCell>
                    </TableRow>
                </TableFooter>
            </Table>
            
            {/* Signatures */}
            <div className="mt-16 pt-8 flex justify-between text-center">
                <div className="w-1/2">
                    <div className="mt-12 border-t border-gray-400 mx-4 pt-1">Depositor Signature</div>
                </div>
                <div className="w-1/2">
                    <div className="mt-12 border-t border-gray-400 mx-4 pt-1">Authorized Manager Signature</div>
                    <p className="text-xs mt-1">For {warehouseInfo?.name || 'GrainDost'}</p>
                </div>
            </div>
        </div>
    );
});
InflowReceipt.displayName = 'InflowReceipt';
