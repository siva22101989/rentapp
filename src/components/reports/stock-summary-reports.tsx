'use client';

import React, { useMemo } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { format } from "date-fns";
import type { Customer, StorageRecord, WarehouseInfo } from "@/lib/definitions";
import { formatCurrency, toDate } from '@/lib/utils';

type BaseProps = {
    records: StorageRecord[];
    customers: Customer[];
    warehouseInfo: WarehouseInfo | null;
    title: string;
};

/**
 * Report 1: Commodity-wise Stock List
 */
export function CommodityStockReport({ records, warehouseInfo, title }: BaseProps) {
    const generatedDate = useMemo(() => format(new Date(), 'dd/MM/yy, hh:mm a'), []);
    
    const summary = useMemo(() => {
        const active = records.filter(r => !r.storageEndDate && r.bagsStored > 0);
        const map: Record<string, { bags: number; weight: number; lots: Set<string> }> = {};
        
        active.forEach(r => {
            const cat = r.commodityDescription || 'Uncategorized';
            if (!map[cat]) map[cat] = { bags: 0, weight: 0, lots: new Set() };
            map[cat].bags += r.bagsStored;
            map[cat].weight += r.weight || 0;
            if (r.location) map[cat].lots.add(r.location);
        });

        return Object.entries(map).sort((a, b) => b[1].bags - a[1].bags);
    }, [records]);

    const totalBags = summary.reduce((acc, [, d]) => acc + d.bags, 0);

    return (
        <div className="bg-white p-6 rounded-xl border shadow-sm printable-area">
            <div className="mb-6 text-center border-b pb-4">
                <h2 className="text-xl font-bold uppercase tracking-tight leading-none text-primary text-center">{warehouseInfo?.name || "SRI LAKSHMI WAREHOUSE"}</h2>
                <h3 className="font-bold uppercase text-slate-500 tracking-widest text-[12px] mt-2 text-center">{title}</h3>
                <p className="text-[10px] text-slate-400 mt-1 text-center">Report Generated: {generatedDate}</p>
            </div>

            <Table className="text-[13px]">
                <TableHeader>
                    <TableRow className="bg-slate-50 border-y-2 border-black">
                        <TableHead className="text-center font-black uppercase text-[10px]">Commodity Name</TableHead>
                        <TableHead className="text-center font-black uppercase text-[10px]">Unique Lots</TableHead>
                        <TableHead className="text-center font-black uppercase text-[10px]">Total Weight (Kg)</TableHead>
                        <TableHead className="text-center font-black uppercase text-[10px]">Current Stock (Bags)</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {summary.map(([name, data]) => (
                        <TableRow key={name} className="h-10 border-b">
                            <TableCell className="text-center font-bold uppercase">{name}</TableCell>
                            <TableCell className="text-center font-mono">{data.lots.size}</TableCell>
                            <TableCell className="text-center font-mono">{data.weight.toLocaleString()}</TableCell>
                            <TableCell className="text-center font-mono font-black text-lg text-primary">{data.bags}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
                <TableFooter>
                    <TableRow className="bg-slate-50 text-black font-black h-12">
                        <TableCell colSpan={3} className="text-right uppercase text-[10px] tracking-widest">Total Godown Capacity Occupied</TableCell>
                        <TableCell className="text-center font-mono text-xl">{totalBags}</TableCell>
                    </TableRow>
                </TableFooter>
            </Table>
        </div>
    );
}

/**
 * Report 2: Customer-wise Commodity Stock
 */
export function CustomerCommodityStockReport({ records, customers, warehouseInfo, title }: BaseProps) {
    const generatedDate = useMemo(() => format(new Date(), 'dd/MM/yy, hh:mm a'), []);
    
    const summary = useMemo(() => {
        const active = records.filter(r => !r.storageEndDate && r.bagsStored > 0);
        const map: Record<string, Record<string, number>> = {};
        
        active.forEach(r => {
            if (!map[r.customerId]) map[r.customerId] = {};
            const cat = r.commodityDescription || 'Uncategorized';
            map[r.customerId][cat] = (map[r.customerId][cat] || 0) + r.bagsStored;
        });

        return Object.entries(map).map(([cId, stocks]) => ({
            customerName: customers.find(c => c.id === cId)?.name || 'Unknown',
            stocks: Object.entries(stocks).sort((a,b) => b[1] - a[1])
        })).sort((a, b) => a.customerName.localeCompare(b.customerName));
    }, [records, customers]);

    return (
        <div className="bg-white p-6 rounded-xl border shadow-sm printable-area">
            <div className="mb-6 text-center border-b pb-4">
                <h2 className="text-xl font-bold uppercase tracking-tight leading-none text-primary text-center">{warehouseInfo?.name || "SRI LAKSHMI WAREHOUSE"}</h2>
                <h3 className="font-bold uppercase text-slate-500 tracking-widest text-[12px] mt-2 text-center">{title}</h3>
                <p className="text-[10px] text-slate-400 mt-1 text-center">Full Inventory Ledger: {generatedDate}</p>
            </div>

            <Table className="text-[13px]">
                <TableHeader>
                    <TableRow className="bg-slate-50 border-y-2 border-black">
                        <TableHead className="text-center font-black uppercase text-[10px]">Customer Name</TableHead>
                        <TableHead className="text-center font-black uppercase text-[10px]">Commodity</TableHead>
                        <TableHead className="text-center font-black uppercase text-[10px]">Stock Balance (Bags)</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {summary.map((group) => (
                        <React.Fragment key={group.customerName}>
                            {group.stocks.map(([commodity, bags], idx) => (
                                <TableRow key={idx} className="h-9 border-b hover:bg-slate-50">
                                    <TableCell className="text-center font-bold uppercase">{idx === 0 ? group.customerName : ''}</TableCell>
                                    <TableCell className="text-center font-medium text-slate-600">{commodity}</TableCell>
                                    <TableCell className="text-center font-mono font-bold text-primary">{bags}</TableCell>
                                </TableRow>
                            ))}
                        </React.Fragment>
                    ))}
                    {summary.length === 0 && (
                         <TableRow><TableCell colSpan={3} className="text-center py-20 text-muted-foreground italic">No active inventory found.</TableCell></TableRow>
                    )}
                </TableBody>
            </Table>
        </div>
    );
}

/**
 * Report 3: Lot-wise Detailed Inventory
 */
export function LotWiseInventoryReport({ records, customers, warehouseInfo, title }: BaseProps) {
    const generatedDate = useMemo(() => format(new Date(), 'dd/MM/yy, hh:mm a'), []);
    
    const groupedLots = useMemo(() => {
        const active = records.filter(r => !r.storageEndDate && r.bagsStored > 0);
        const map: Record<string, { total: number; records: any[] }> = {};
        
        active.forEach(r => {
            const lot = r.location || 'Unassigned';
            if (!map[lot]) map[lot] = { total: 0, records: [] };
            map[lot].total += r.bagsStored;
            map[lot].records.push({
                ...r,
                customerName: customers.find(c => c.id === r.customerId)?.name || 'Unknown'
            });
        });

        return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }));
    }, [records, customers]);

    return (
        <div className="bg-white p-6 rounded-xl border shadow-sm printable-area">
            <div className="mb-6 text-center border-b pb-4">
                <h2 className="text-xl font-bold uppercase tracking-tight leading-none text-primary text-center">{warehouseInfo?.name || "SRI LAKSHMI WAREHOUSE"}</h2>
                <h3 className="font-bold uppercase text-slate-500 tracking-widest text-[12px] mt-2 text-center">{title}</h3>
                <p className="text-[10px] text-slate-400 mt-1 text-center">Generated: {generatedDate}</p>
            </div>

            <Table className="text-[13px]">
                <TableHeader>
                    <TableRow className="bg-slate-50 border-y-2 border-black">
                        <TableHead className="text-center font-black uppercase text-[10px] w-24">Lot No</TableHead>
                        <TableHead className="text-center font-black uppercase text-[10px]">Inflow Date</TableHead>
                        <TableHead className="text-center font-black uppercase text-[10px]">Customer / Product</TableHead>
                        <TableHead className="text-center font-black uppercase text-[10px]">Storage ID</TableHead>
                        <TableHead className="text-center font-black uppercase text-[10px]">Bags</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {groupedLots.map(([lotName, data]) => (
                        <React.Fragment key={lotName}>
                            <TableRow className="bg-primary/5 h-8">
                                <TableCell className="text-center font-black text-primary border-r-2 border-primary/20">{lotName}</TableCell>
                                <TableCell colSpan={3} className="text-right uppercase text-[9px] font-black text-slate-400 pr-4">Lot {lotName} Subtotal</TableCell>
                                <TableCell className="text-center font-mono font-black text-primary border-l-2 border-primary/20">{data.total}</TableCell>
                            </TableRow>
                            {data.records.map((r, idx) => (
                                <TableRow key={idx} className="h-9 border-b last:border-b-2">
                                    <TableCell></TableCell>
                                    <TableCell className="text-center font-mono text-slate-500">{format(toDate(r.storageStartDate), 'dd/MM/yy')}</TableCell>
                                    <TableCell className="text-center leading-tight">
                                        <div className="font-bold uppercase">{r.customerName}</div>
                                        <div className="text-[10px] text-slate-400">{r.commodityDescription}</div>
                                    </TableCell>
                                    <TableCell className="text-center font-mono text-slate-400">{r.id}</TableCell>
                                    <TableCell className="text-center font-mono font-bold">{r.bagsStored}</TableCell>
                                </TableRow>
                            ))}
                        </React.Fragment>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}