
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
            setFormattedDate(format(startDate, 'dd/MM/yy'));
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

    if (record.inflowType === 'Plot') {
        return (
            <div ref={ref} className="printable-area bg-white p-4 border-2 border-black font-sans text-xs" style={{ fontFamily: "'Courier New', Courier, monospace" }}>
                <div className="text-center mb-2">
                    <div className="text-xs">Cell: {warehouseInfo?.phone || '9703503423, 9160606633'}</div>
                    <h1 className="text-base font-bold text-blue-900">{warehouseInfo?.name || 'SRI LAKSHMI WAREHOUSE'}</h1>
                    {warehouseInfo?.ownerName && <p className="text-xs">Prop: {warehouseInfo.ownerName}</p>}
                    <p className="text-xs">{warehouseInfo?.addressLine1 || 'Survey No. 165,237/2, Owk - Koilakuntla Road, OWK - 518 122,'}</p>
                    <p className="text-xs">{warehouseInfo?.addressLine2 || 'Owk (M), Kurnool (Dt.), A.P.'}</p>
                </div>

                <h2 className="font-bold underline text-center text-sm">INFLOW BILL (FROM PLOT)</h2>
                
                <div className="flex justify-between items-baseline my-1 text-xs">
                    <div><span className="font-bold">Bill No.</span> {record.id}</div>
                    <div><span className="font-bold">Date:</span> {formattedDate}</div>
                </div>

                <div className="space-y-0.5 mb-1 text-xs">
                    <div className="flex"><span className="w-1/3 font-bold">CUSTOMER</span><span>: {customer.name}</span></div>
                    {customer.fatherName && <div className="flex"><span className="w-1/3 font-bold">FATHER'S NAME</span><span>: {customer.fatherName}</span></div>}
                    <div className="flex"><span className="w-1/3 font-bold">VILLAGE</span><span>: {customer.village || 'N/A'}</span></div>
                    <div className="flex"><span className="w-1/3 font-bold">PRODUCT</span><span>: {record.commodityDescription}</span></div>
                    <div className="flex"><span className="w-1/3 font-bold">LOT No.</span><span>: {record.location}</span></div>
                </div>
                
                <div className="my-2 p-2 border-y">
                    <h3 className="text-xs font-bold text-center mb-1">PROCESS DATES</h3>
                    <div className="grid grid-cols-3 gap-x-2 text-center">
                        <div>
                            <p className="font-semibold">Unloading</p>
                            <p>{unloadingRecord ? format(toDate(unloadingRecord.unloadingDate), 'dd/MM/yy') : 'N/A'}</p>
                        </div>
                        <div>
                            <p className="font-semibold">Drying Start</p>
                            <p>{record.dryingStartDate ? format(toDate(record.dryingStartDate), 'dd/MM/yy') : 'N/A'}</p>
                        </div>
                        <div>
                            <p className="font-semibold">Storage Start</p>
                            <p>{record.dryingEndDate ? format(toDate(record.dryingEndDate), 'dd/MM/yy') : 'N/A'}</p>
                        </div>
                    </div>
                    <p className="text-center mt-1"><span className="font-bold">Total Drying Days:</span> {dryingDays ?? 'N/A'}</p>
                </div>

                <div className="mb-2 p-2 bg-gray-100 rounded-md text-black">
                    <h3 className="text-xs font-bold mb-1">STOCK SUMMARY</h3>
                    <div className="grid grid-cols-2 gap-4 text-center">
                        <div>
                            <p className="text-xs">Bags for Plot</p>
                            <p className="font-bold">{record.bagsForDrying || 'N/A'}</p>
                        </div>
                        <div>
                            <p className="text-xs">Bags Packed (Stock)</p>
                            <p className="font-bold">{record.bagsIn}</p>
                        </div>
                    </div>
                </div>

                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="text-black h-auto py-1">Description</TableHead>
                            <TableHead className="text-center text-black h-auto py-1">Calculation</TableHead>
                            <TableHead className="text-right text-black h-auto py-1">Amount</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {record.hamaliDetails && record.hamaliDetails.length > 0 ? (
                            record.hamaliDetails.map((item, index) => (
                                <TableRow key={index}>
                                    <TableCell className="py-1">{item.description}</TableCell>
                                    <TableCell className="text-center font-mono text-xs py-1">{item.bags && item.rate ? `${item.bags} bags x ${formatCurrency(item.rate)}` : '-'}</TableCell>
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
                        <TableRow>
                            <TableCell colSpan={2} className="text-right font-bold py-1">Total Hamali</TableCell>
                            <TableCell className="text-right font-bold font-mono py-1">{formatCurrency(record.hamaliPayable)}</TableCell>
                        </TableRow>
                    </TableFooter>
                </Table>


                    <div className="mt-8 pt-4 flex justify-between text-center">
                    <div className="w-1/2">
                        <div className="mt-8 border-t border-gray-400 mx-4 pt-1">Manager Signature</div>
                    </div>
                    <div className="w-1/2">
                        <div className="mt-8 border-t border-gray-400 mx-4 pt-1">Customer Signature</div>
                    </div>
                </div>
            </div>
    );
    }

    return (
        <div ref={ref} className="bg-white p-4 border-2 border-black font-sans text-xs" style={{ fontFamily: "'Courier New', Courier, monospace" }}>
            <div className="text-center mb-4">
                <p className="text-xs">Cell: {warehouseInfo?.phone || 'N/A'}</p>
                <h1 className="text-lg font-bold text-blue-900">{warehouseInfo?.name || 'SRI LAKSHMI WAREHOUSE'}</h1>
                <p className="text-xs">{warehouseInfo?.addressLine1 || 'Address Line 1'}</p>
                <p className="text-xs">{warehouseInfo?.addressLine2 || 'Address Line 2'}</p>
            </div>
            
            <h2 className="text-sm font-bold underline text-center mb-2">GODOWN RECEIPT</h2>

            <div className="flex justify-between items-baseline mb-4">
                <div><span className="font-bold">Bill No.</span> {record.id}</div>
                <div><span className="font-bold">Date:</span> {formattedDate}</div>
            </div>

            <div className="space-y-1">
                <div className="flex">
                    <span className="w-1/3 font-bold">LORRY / TRACTOR No.</span>
                    <span>: {record.lorryTractorNo || 'N/A'}</span>
                </div>
                <div className="flex">
                    <span className="w-1/3 font-bold">NAME OF THE FARMER</span>
                    <span>: {customer.name}</span>
                </div>
                <div className="flex">
                    <span className="w-1/3 font-bold">VILLAGE</span>
                    <span>: {customer.village || 'N/A'}</span>
                </div>
                <div className="flex">
                    <span className="w-1/3 font-bold">COMMODITY</span>
                    <span>: {record.commodityDescription}</span>
                </div>
                <div className="flex">
                    <span className="w-1/3 font-bold">NO. OF BAGS</span>
                    <span>: {record.bagsIn || 0}</span>
                </div>
                <div className="flex">
                    <span className="w-1/3 font-bold">LOT NO.</span>
                    <span>: {record.location}</span>
                </div>
                    <div className="flex">
                    <span className="w-1/3 font-bold">HAMALI PAYABLE</span>
                    <span>: {formatCurrency(record.hamaliPayable)}</span>
                </div>
            </div>
        </div>
    );
});
InflowReceipt.displayName = 'InflowReceipt';
